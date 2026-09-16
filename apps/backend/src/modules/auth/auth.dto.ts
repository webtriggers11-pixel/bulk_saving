import { IsOptional, IsString, Length, Matches } from 'class-validator';
import type { OtpRequestBody, OtpVerifyBody, RefreshBody } from '@bulk/shared';

const INVITE_CODE = /^[A-Z0-9]{8}$/;
const PHONE = /^\+?[0-9]{7,15}$/;
const OTP_CODE = /^\d{6}$/;

export class OtpRequestDto implements OtpRequestBody {
  @Matches(INVITE_CODE, { message: 'inviteCode must be 8 uppercase alphanumeric characters.' })
  inviteCode!: string;

  @Matches(PHONE, { message: 'phone must be a valid phone number.' })
  phone!: string;
}

export class OtpVerifyDto implements OtpVerifyBody {
  @Matches(INVITE_CODE, { message: 'inviteCode must be 8 uppercase alphanumeric characters.' })
  inviteCode!: string;

  @Matches(PHONE, { message: 'phone must be a valid phone number.' })
  phone!: string;

  @Matches(OTP_CODE, { message: 'code must be exactly 6 digits.' })
  code!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;
}

export class RefreshDto implements RefreshBody {
  @IsString()
  @Length(1, 4096)
  refreshToken!: string;
}
