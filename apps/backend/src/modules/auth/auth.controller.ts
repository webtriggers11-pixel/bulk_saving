import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthResult,
  AuthTokens,
  MeResponse,
  OtpRequestResponse,
} from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { ResidentsService } from '../residents/residents.service';
import { toResidentDto } from '../residents/residents.mapper';
import { SocietiesService } from '../societies/societies.service';
import { AccessTokenGuard } from './access-token.guard';
import { CurrentAuth, type AuthContext } from './auth-context';
import { AuthService } from './auth.service';
import {
  AdminOtpRequestDto,
  AdminOtpVerifyDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshDto,
} from './auth.dto';
import { OtpService } from './otp.service';

@Controller()
export class AuthController {
  constructor(
    private readonly societies: SocietiesService,
    private readonly residents: ResidentsService,
    private readonly otp: OtpService,
    private readonly auth: AuthService,
  ) {}

  @Post('auth/otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: OtpRequestDto): Promise<OtpRequestResponse> {
    const society = await this.societies.findByInviteCode(dto.inviteCode);
    if (!society) {
      // No OTP is generated or sent for an unknown invite code.
      throw new BadRequestException({
        code: ErrorCode.INVALID_INVITE_CODE,
        message: 'Unknown invite code.',
      });
    }
    // societyId is derived from the invite code, never from the request body.
    const outcome = await this.otp.request(society.id, dto.phone);
    if (outcome.result === 'RATE_LIMITED') {
      throw new HttpException(
        { code: ErrorCode.OTP_RATE_LIMITED, message: 'Too many OTP requests. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Nothing but the acknowledgement: the OTP never leaves the server through this
    // response, in any environment (ADR-0020). The dev affordance lives in the stub
    // SMS channel, which production replaces.
    return { requested: true };
  }

  @Post('auth/otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: OtpVerifyDto): Promise<AuthResult> {
    const society = await this.societies.findByInviteCode(dto.inviteCode);
    if (!society) {
      throw new BadRequestException({
        code: ErrorCode.INVALID_INVITE_CODE,
        message: 'Unknown invite code.',
      });
    }

    const result = await this.otp.verify(society.id, dto.phone, dto.code);
    if (result === 'INVALID') {
      throw new BadRequestException({ code: ErrorCode.OTP_INVALID, message: 'Incorrect code.' });
    }
    if (result === 'EXPIRED') {
      throw new BadRequestException({
        code: ErrorCode.OTP_EXPIRED,
        message: 'This code has expired. Request a new one.',
      });
    }
    if (result === 'LOCKED') {
      throw new HttpException(
        { code: ErrorCode.OTP_LOCKED, message: 'Too many attempts. Request a new code.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // societyId bound from the invite code — never trusted from the body (ADR-0003).
    const resident = await this.residents.upsertVerified(society.id, dto.phone, dto.name);
    const tokens = await this.auth.issueTokens(resident);
    return { ...tokens, resident: toResidentDto(resident) };
  }

  /**
   * Admin sign-in, step 1 (FEAT-012, ADR-0023). A phone number and nothing else.
   *
   * The response is IDENTICAL whether or not that number belongs to an admin. An
   * endpoint that answered differently would sort a leaked phone list into
   * administrators and everyone else, which is worth more to an attacker than the
   * clearer error message is worth to the rare resident who lands here by mistake.
   */
  @Post('auth/admin/otp/request')
  @HttpCode(HttpStatus.OK)
  async requestAdminOtp(@Body() dto: AdminOtpRequestDto): Promise<OtpRequestResponse> {
    const admin = await this.residents.findUniqueByPhone(dto.phone);
    if (!admin || admin.role !== 'SUPER_ADMIN') {
      // Nothing generated, nothing sent — and nothing said. A resident's number must
      // not draw an SMS out of the admin door either.
      return { requested: true };
    }
    // societyId comes from the admin's own row, never from the body (ADR-0003).
    const outcome = await this.otp.request(admin.societyId, dto.phone);
    if (outcome.result === 'RATE_LIMITED') {
      throw new HttpException(
        { code: ErrorCode.OTP_RATE_LIMITED, message: 'Too many OTP requests. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { requested: true };
  }

  /**
   * Admin sign-in, step 2. Verifies the code against the admin's own society scope.
   *
   * Unlike the resident path this NEVER upserts: joining a society is the act that
   * creates a resident, and signing in as an admin is not that act. An unknown phone
   * gets refused here; it cannot bring a row into existence through this door.
   */
  @Post('auth/admin/otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyAdminOtp(@Body() dto: AdminOtpVerifyDto): Promise<AuthResult> {
    // Any resident row, not only an admin one: the role is checked AFTER the code, so
    // the honest refusal below is reachable, and is earned by holding a valid OTP.
    const resident = await this.residents.findUniqueByPhone(dto.phone);
    if (!resident) {
      // No row, so no OTP was ever issued against this number on this path. Same shape
      // as a wrong code, deliberately — an unknown number learns nothing here.
      throw new BadRequestException({ code: ErrorCode.OTP_INVALID, message: 'Incorrect code.' });
    }

    const result = await this.otp.verify(resident.societyId, dto.phone, dto.code);
    if (result === 'INVALID') {
      throw new BadRequestException({ code: ErrorCode.OTP_INVALID, message: 'Incorrect code.' });
    }
    if (result === 'EXPIRED') {
      throw new BadRequestException({
        code: ErrorCode.OTP_EXPIRED,
        message: 'This code has expired. Request a new one.',
      });
    }
    if (result === 'LOCKED') {
      throw new HttpException(
        { code: ErrorCode.OTP_LOCKED, message: 'Too many attempts. Request a new code.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // The code was right, so this number's owner is on the line. Now — and only now —
    // is it safe to say plainly that this is not an administrator's number: a resident
    // who wandered onto the admin page gets the real reason instead of "incorrect code",
    // and an attacker without the OTP never reaches this line.
    if (resident.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        code: ErrorCode.NOT_AN_ADMIN,
        message: 'This number is not an administrator.',
      });
    }

    const verified = await this.residents.markVerified(resident.id);
    const tokens = await this.auth.issueTokens(verified);
    return { ...tokens, resident: toResidentDto(verified) };
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@CurrentAuth() ctx: AuthContext): Promise<MeResponse> {
    // Scoped strictly to the caller's own society (from the token).
    const resident = await this.residents.findInSociety(ctx.residentId, ctx.societyId);
    const society = await this.societies.findById(ctx.societyId);
    if (!resident || !society) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Resident no longer exists.',
      });
    }
    return {
      resident: toResidentDto(resident),
      society: { id: society.id, name: society.name, city: society.city },
    };
  }
}
