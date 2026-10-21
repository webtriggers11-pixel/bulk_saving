import { buildWhatsAppSender } from './whatsapp.module';
import { CloudApiWhatsAppSender } from './whatsapp-sender';
import { StubWhatsAppSender } from './stub-whatsapp.sender';
import type { RedisService } from '../../redis/redis.service';
import {
  DEFAULT_GRAPH_VERSION,
  STUB_BUSINESS_NUMBER,
  whatsAppBusinessNumber,
  whatsAppCloudConfig,
  whatsAppLoginMode,
} from './whatsapp.config';

const FULL = {
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_ACCESS_TOKEN: 'EAAG-a-long-enough-test-token',
  WHATSAPP_APP_SECRET: 'an-app-secret-0123456789',
  WHATSAPP_VERIFY_TOKEN: 'a-verify-token-0123456789',
  WHATSAPP_BUSINESS_NUMBER: '919876543210',
};

/** FEAT-027 (ADR-0038): the mode comes from the environment, and nowhere else. */
describe('whatsAppLoginMode', () => {
  it('is cloud with all five variables, with the checked Graph version by default', () => {
    expect(whatsAppLoginMode(FULL)).toBe('cloud');
    expect(whatsAppCloudConfig(FULL)?.graphVersion).toBe(DEFAULT_GRAPH_VERSION);
    expect(whatsAppCloudConfig({ ...FULL, WHATSAPP_GRAPH_VERSION: 'v27.0' })?.graphVersion).toBe('v27.0');
    expect(whatsAppBusinessNumber(FULL)).toBe('919876543210');
  });

  it('is stub only where the dev echo is on (OTP_DEV_LOG=true + explicit development/test)', () => {
    expect(whatsAppLoginMode({ OTP_DEV_LOG: 'true', NODE_ENV: 'development' })).toBe('stub');
    expect(whatsAppLoginMode({ OTP_DEV_LOG: 'true', NODE_ENV: 'test' })).toBe('stub');
    expect(whatsAppBusinessNumber({ OTP_DEV_LOG: 'true', NODE_ENV: 'development' })).toBe(STUB_BUSINESS_NUMBER);
    // Default closed — the same rule as the dev OTP route (ADR-0037 V2 P2).
    expect(whatsAppLoginMode({ OTP_DEV_LOG: 'true' })).toBe('off');
    expect(whatsAppLoginMode({ OTP_DEV_LOG: 'true', NODE_ENV: 'production' })).toBe('off');
    expect(whatsAppLoginMode({ NODE_ENV: 'development' })).toBe('off');
    expect(whatsAppLoginMode({})).toBe('off');
    expect(whatsAppBusinessNumber({})).toBeNull();
  });

  it('a partial set is not cloud (boot refuses it anyway) and blank values count as unset', () => {
    const { WHATSAPP_APP_SECRET: _dropped, ...partial } = FULL;
    void _dropped;
    expect(whatsAppCloudConfig(partial)).toBeNull();
    expect(whatsAppCloudConfig({ ...FULL, WHATSAPP_ACCESS_TOKEN: '   ' })).toBeNull();
  });

  it('builds the Cloud API sender for cloud, the stub otherwise', () => {
    const redis = {} as RedisService;
    expect(buildWhatsAppSender(redis, FULL)).toBeInstanceOf(CloudApiWhatsAppSender);
    const stub = buildWhatsAppSender(redis, { OTP_DEV_LOG: 'true', NODE_ENV: 'test' });
    expect(stub).toBeInstanceOf(StubWhatsAppSender);
    expect(stub.mode).toBe('stub');
    expect(stub.businessNumber).toBe(STUB_BUSINESS_NUMBER);
    expect(buildWhatsAppSender(redis, {}).mode).toBe('off');
    expect(buildWhatsAppSender(redis, {}).businessNumber).toBeNull();
    expect(buildWhatsAppSender(redis, FULL).businessNumber).toBe('919876543210');
  });
});
