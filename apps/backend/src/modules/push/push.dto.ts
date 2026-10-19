import { ACCENTS, type Accent, type PushSubscribeBody, type PushUnsubscribeBody } from '@bulk/shared';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import { isKnownPushEndpoint } from './push-sender';

/**
 * The server will POST to this URL, so it must be a known push service — otherwise
 * subscribing is a way to make our workers call any URL (SSRF; ADR-0032).
 */
function IsKnownPushEndpoint(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isKnownPushEndpoint',
      target: object.constructor,
      propertyName,
      options: { message: 'endpoint must be an https URL on a known push service', ...options },
      validator: { validate: (value: unknown) => typeof value === 'string' && isKnownPushEndpoint(value) },
    });
}

/** base64url, as browsers emit the keys. */
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export class PushKeysDto {
  @IsString()
  @Matches(BASE64URL)
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @Matches(BASE64URL)
  @MaxLength(100)
  auth!: string;
}

export class PushSubscribeDto implements PushSubscribeBody {
  @IsString()
  @MaxLength(1000)
  @IsKnownPushEndpoint()
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  @IsNotEmpty()
  keys!: PushKeysDto;

  @IsIn(ACCENTS)
  accent!: Accent;
}

export class PushUnsubscribeDto implements PushUnsubscribeBody {
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}
