import { IsOptional, IsString, Length, Matches } from 'class-validator';
import type {
  AdminOtpRequestBody,
  AdminOtpVerifyBody,
  OtpRequestBody,
  OtpVerifyBody,
  RefreshBody,
} from '@bulk/shared';

const INVITE_CODE = /^[A-Z0-9]{8}$/;
// BUG-019: formatting (spaces, dashes, brackets) is allowed in; `normalisePhone` in the
// controller is the real check and the only thing that decides what is stored.
const PHONE = /^\+?[0-9][0-9\s().-]{5,24}$/;
// CHORE-026: 4–6 digits — real codes are 6; a dev fixed code (OTP_DEV_FIXED_CODE) may be 4.
const OTP_CODE = /^\d{4,6}$/;

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

  @Matches(OTP_CODE, { message: 'code must be 4 to 6 digits.' })
  code!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;
}

/**
 * Admin sign-in bodies (FEAT-012). There is deliberately no `inviteCode` field and no
 * `societyId` field: the society is derived from the admin's own row (ADR-0023), and a
 * DTO that accepted either would be a DTO that could be talked into another tenant.
 */
export class AdminOtpRequestDto implements AdminOtpRequestBody {
  @Matches(PHONE, { message: 'phone must be a valid phone number.' })
  phone!: string;
}

/** No `name`: the admin path authenticates an existing admin, it never creates one. */
export class AdminOtpVerifyDto implements AdminOtpVerifyBody {
  @Matches(PHONE, { message: 'phone must be a valid phone number.' })
  phone!: string;

  @Matches(OTP_CODE, { message: 'code must be 4 to 6 digits.' })
  code!: string;
}

export class RefreshDto implements RefreshBody {
  @IsString()
  @Length(1, 4096)
  refreshToken!: string;
}
