import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { OTP_CODE_LENGTH } from '@bulk/shared';
import type {
  AdminOtpRequestBody,
  AdminOtpVerifyBody,
  InviteCheckBody,
  OtpRequestBody,
  OtpVerifyBody,
  RefreshBody,
} from '@bulk/shared';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

const INVITE_CODE = /^[A-Z0-9]{8}$/;
// BUG-019: formatting (spaces, dashes, brackets) is allowed in; `normalisePhone` in the
// controller is the real check and the only thing that decides what is stored.
export const PHONE = /^\+?[0-9][0-9\s().-]{5,24}$/;
// FEAT-047 (ADR-0055): every OTP is OTP_CODE_LENGTH digits, for every role and door.
const OTP_CODE = new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`);

/** `POST /auth/invite/check` (FEAT-045): the code alone, in the shape every door accepts. */
export class InviteCheckDto implements InviteCheckBody {
  @Matches(INVITE_CODE, { message: 'inviteCode must be 8 uppercase alphanumeric characters.' })
  inviteCode!: string;
}

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

  @Matches(OTP_CODE, { message: `code must be ${OTP_CODE_LENGTH} digits.` })
  code!: string;

  /** FEAT-048 (ADR-0057): required; spaces-only is rejected after the trim. */
  @Transform(trim)
  @IsString({ message: 'name is required.' })
  @Length(1, 80, { message: 'name must be 1 to 80 characters.' })
  name!: string;
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

  @Matches(OTP_CODE, { message: `code must be ${OTP_CODE_LENGTH} digits.` })
  code!: string;
}

export class RefreshDto implements RefreshBody {
  @IsString()
  @Length(1, 4096)
  refreshToken!: string;
}
