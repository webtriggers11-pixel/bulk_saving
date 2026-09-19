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
import { ADMIN_OTP_SCOPE, OtpService } from './otp.service';

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
    const admin = await this.residents.findAdminByPhone(dto.phone);
    // EVERY caller takes the same path: same scope, same rate-limit keys, same stored
    // OTP. Two leaks were closed here, in that order:
    //  - Returning early for a non-admin left the limiter untouched for them, so two
    //    requests 30s apart answered 200/429 for an administrator and 200/200 for
    //    everyone else — an oracle built by the branch meant to prevent one (V2 P1-1).
    //  - Awaiting the send put an SMS provider's round-trip (100–500ms) inside an
    //    administrator's response and nobody else's, which is the same oracle measured
    //    with a stopwatch instead (V2 round 2, P1-A). Hence 'detached', not 'awaited':
    //    the response is uniform by design, so the send's outcome could never have
    //    reached the caller anyway — awaiting it only leaked the timing.
    const outcome = await this.otp.request(ADMIN_OTP_SCOPE, dto.phone, {
      dispatch: admin !== null ? 'detached' : 'suppressed',
    });
    if (outcome.result === 'RATE_LIMITED') {
      throw new HttpException(
        { code: ErrorCode.OTP_RATE_LIMITED, message: 'Too many OTP requests. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { requested: true };
  }

  @Post('auth/admin/otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyAdminOtp(@Body() dto: AdminOtpVerifyDto): Promise<AuthResult> {
    // The code is checked FIRST, against a scope that does not depend on the caller.
    // Looking the row up first — which is what this did before — meant an unknown
    // number got OTP_INVALID while a registered one got OTP_EXPIRED, so a single
    // unauthenticated request revealed whether a phone was in the product (V2 P1-2).
    const result = await this.otp.verify(ADMIN_OTP_SCOPE, dto.phone, dto.code);
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
    // is it safe to say plainly that this is not an administrator's number. Reaching
    // this line without being an admin means holding a code that was generated but
    // never sent anywhere, so nothing is disclosed to someone who does not already
    // control the number.
    const admin = await this.residents.findAdminByPhone(dto.phone);
    if (!admin) {
      throw new ForbiddenException({
        code: ErrorCode.NOT_AN_ADMIN,
        message: 'This number is not an administrator.',
      });
    }

    // societyId comes from the admin's own row, never from the body (ADR-0003).
    const verified = await this.residents.markVerified(admin);
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
