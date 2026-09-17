import {
  BadRequestException,
  Body,
  Controller,
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
import { OtpRequestDto, OtpVerifyDto, RefreshDto } from './auth.dto';
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
    // `devCode` is present only under the ADR-0016 dev guard; outside local
    // development the field is absent entirely, never null or empty.
    return outcome.devCode === undefined
      ? { requested: true }
      : { requested: true, devCode: outcome.devCode };
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
