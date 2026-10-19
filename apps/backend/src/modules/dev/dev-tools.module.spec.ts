import { DevToolsModule, devToolsImports } from './dev-tools.module';

/** FEAT-026 (ADR-0037): the dev routes exist only where the dev OTP echo is on. */
describe('devToolsImports', () => {
  it('registers the module only with OTP_DEV_LOG=true outside production', () => {
    expect(devToolsImports({ OTP_DEV_LOG: 'true', NODE_ENV: 'development' })).toEqual([DevToolsModule]);
    expect(devToolsImports({ OTP_DEV_LOG: 'true', NODE_ENV: 'test' })).toEqual([DevToolsModule]);
    expect(devToolsImports({ OTP_DEV_LOG: 'true', NODE_ENV: 'production' })).toEqual([]);
    expect(devToolsImports({ OTP_DEV_LOG: 'false', NODE_ENV: 'development' })).toEqual([]);
    expect(devToolsImports({})).toEqual([]);
  });
});
