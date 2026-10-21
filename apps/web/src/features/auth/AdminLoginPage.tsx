import { normalisePhone } from '@bulk/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { requestAdminOtp, verifyAdminOtp } from './auth.api';
import { useAuthStore } from './auth.store';
import { messageFromError, PHONE_HINT } from './error-messages';
import { useDevOtp } from './useDevOtp';
import { DevOtpToast } from './DevOtpToast';
import { useAuthMethods } from './useAuthMethods';
import { useWhatsAppLogin } from './useWhatsAppLogin';
import { WhatsAppSignIn } from './WhatsAppSignIn';
import { startAdminWhatsAppLogin } from './wa.api';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, anyPaused } from '../../lib/offline';
import { AmbientGround } from '../../components/ui/ambient-ground';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Notice } from '../../components/ui/notice';

type Step = 'phone' | 'code' | 'whatsapp';

/**
 * The admin door (FEAT-012, ADR-0023): a phone number and a code, and nothing else.
 *
 * There is deliberately no invite-code state in this component. That is a society's
 * credential handed to residents, and it is also how the resident flow tells the server
 * which society is meant — an admin needs neither, because their own row answers both.
 */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  // Typed something, but not yet a number the server will accept.
  const implausible = phone.trim().length > 0 && normalisePhone(phone) === null;
  const [code, setCode] = useState('');

  const devOtp = useDevOtp();
  // FEAT-027 (ADR-0038): the admin door over WhatsApp. The role is decided by the server at
  // token time; this page learns it only with the tokens, like the OTP door.
  const methods = useAuthMethods();
  const whatsApp = useWhatsAppLogin(startAdminWhatsAppLogin, (result) => {
    login({ accessToken: result.accessToken, refreshToken: result.refreshToken, resident: result.resident });
    navigate('/admin', { replace: true });
  });
  const requestMutation = useMutation({
    mutationFn: () => requestAdminOtp({ phone: normalisePhone(phone) ?? phone.trim() }),
    // A resend must not keep showing the previous code while the new one is fetched.
    onMutate: () => devOtp.clear(),
    onSuccess: () => {
      setStep('code');
      devOtp.fetchFor(phone);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyAdminOtp({ phone: normalisePhone(phone) ?? phone.trim(), code }),
    onSuccess: (result) => {
      login({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        resident: result.resident,
      });
      navigate('/admin', { replace: true });
    },
  });

  function submitPhone(event: FormEvent) {
    event.preventDefault();
    if (normalisePhone(phone) === null) return;
    requestMutation.mutate();
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (code.trim().length === 0) return;
    verifyMutation.mutate();
  }

  const requestError = requestMutation.isError ? messageFromError(requestMutation.error) : null;
  const verifyError = verifyMutation.isError ? messageFromError(verifyMutation.error) : null;
  // BUG-004: offline PAUSES a mutation rather than rejecting it, so "Sending…" would
  // otherwise hang forever on a door with no other way through.
  const queuedOffline = anyPaused(requestMutation, verifyMutation);

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden" data-whatsapp={methods.whatsapp ? 'on' : 'off'}>
      <DevOtpToast code={devOtp.code} onUse={setCode} onDismiss={devOtp.clear} />
      <AmbientGround id="admin-login-grain" />

      <header className="animate-rise relative flex flex-1 flex-col justify-center gap-[18px] px-7 pb-6 pt-10">
        <span className="animate-breathe inline-flex w-fit items-center gap-2 rounded-full border border-paper/80 bg-gradient-to-br from-paper/90 to-paper/50 px-3.5 py-1.5 text-eyebrow uppercase text-brand-ink shadow-lift">
          <Icon name="check" size={13} strokeWidth={2.2} />
          Super admin
        </span>
        <h1 className="animate-blur-in bg-gradient-to-br from-ink via-brand to-brand-light bg-clip-text pb-1.5 text-hero font-extrabold text-transparent">
          Admin
          <br />
          sign-in
        </h1>
        <p className="max-w-[300px] text-lead font-medium text-ink-muted">
          Rounds, vendors and payments across every society.
        </p>
        <ol className="flex items-center gap-2" aria-label="Sign-in progress">
          {(['phone', 'code'] as Step[]).map((label, index) => (
            <li
              key={label}
              className={[
                'h-1.5 overflow-hidden rounded-full bg-line/15 t',
                label === step ? 'w-[52px]' : 'w-[34px]',
              ].join(' ')}
            >
              {index <= (step === 'phone' ? 0 : 1) && (
                <span className="bar-fill block h-full w-full rounded-full bg-gradient-to-r from-brand-deep to-brand-light shadow-glow" />
              )}
            </li>
          ))}
        </ol>
      </header>

      <section className="animate-rise relative rounded-t-sheet border-t border-paper/95 bg-gradient-to-b from-paper/95 to-paper/75 px-6 pb-8 pt-7 shadow-sheet backdrop-blur-chrome backdrop-saturate-[1.9] [animation-delay:140ms]">
        <span aria-hidden="true" className="mx-auto mb-6 block h-[5px] w-11 rounded-full bg-line/20" />

        {step === 'phone' && (
          <form onSubmit={submitPhone} noValidate className="field">
            <h2 className="text-title font-extrabold text-ink">Your admin number</h2>
            {/* ADR-0023: the API will not say who is an admin, so the PAGE does. A
                resident who lands here reads it before waiting for an SMS that the
                admin door never sends to them. */}
            <p className="mb-6 mt-2 text-caption text-ink-muted">
              This page is for society administrators. Residents sign in from the main app.
            </p>
            <Label htmlFor="admin-phone">Phone number</Label>
            <Input
              emphasis="primary"
              textSize="lg"
              id="admin-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="num"
              aria-describedby={implausible ? 'admin-phone-hint' : undefined}
            />
            {/* BUG-019: a disabled button with no words is a dead end — say what a number must look like. */}
            {implausible && (
              <p id="admin-phone-hint" className="mt-2 text-caption text-ink-muted" data-testid="admin-phone-hint">
                {PHONE_HINT}
              </p>
            )}
            {queuedOffline && (
              <Notice tone="warn" data-testid="admin-login-offline">
                {OFFLINE_QUEUED_TEXT}
              </Notice>
            )}
            {requestError && <Notice tone="error">{requestError}</Notice>}
            <Button
              className="mt-[22px] w-full"
              type="submit"
              disabled={requestMutation.isPending || normalisePhone(phone) === null}
            >
              {queuedOffline
                ? OFFLINE_WAITING_LABEL
                : requestMutation.isPending
                  ? 'Sending…'
                  : 'Send code'}
              <Icon name="forward" size={18} strokeWidth={2.2} className="nudge" />
            </Button>
            {methods.whatsapp && (
              <>
                <p className="my-4 text-center text-eyebrow uppercase text-ink-soft" aria-hidden="true">or</p>
                <Button variant="secondary" className="w-full" onClick={() => setStep('whatsapp')} data-testid="continue-whatsapp">
                  <Icon name="chat" size={18} strokeWidth={2.2} />
                  Continue with WhatsApp
                </Button>
              </>
            )}
          </form>
        )}

        {step === 'whatsapp' && (
          <WhatsAppSignIn login={whatsApp} onUseSms={() => { whatsApp.reset(); setStep('phone'); }} />
        )}

        {step === 'code' && (
          <form onSubmit={submitCode} noValidate className="field">
            <h2 className="text-title font-extrabold text-ink">Enter the code</h2>
            <p className="mb-6 mt-2 text-caption text-ink-muted">
              Sent by SMS to <span className="num font-bold text-ink">{normalisePhone(phone) ?? phone}</span>.
            </p>
            <Label htmlFor="admin-code">8-digit code</Label>
            <Input
              emphasis="primary"
              textSize="code"
              tracking="code"
              id="admin-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="12345678"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="num text-center"
            />
            {verifyError && <Notice tone="error">{verifyError}</Notice>}
            {requestError && <Notice tone="error">{requestError}</Notice>}
            <Button
              className="mt-[22px] w-full"
              type="submit"
              disabled={verifyMutation.isPending || code.trim().length === 0}
            >
              {queuedOffline
                ? OFFLINE_WAITING_LABEL
                : verifyMutation.isPending
                  ? 'Verifying…'
                  : 'Open dashboard'}
            </Button>

            <p className="mt-4 text-center text-caption font-medium text-ink-muted">
              Didn&apos;t get it?{' '}
              <Button
                variant="link"
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending}
              >
                {queuedOffline
                  ? OFFLINE_WAITING_LABEL
                  : requestMutation.isPending
                    ? 'Resending…'
                    : 'Resend code'}
              </Button>
            </p>
            <p className="mt-4 text-center text-caption font-medium text-ink-muted">
              <Button variant="link" onClick={() => { setStep('phone'); devOtp.clear(); }}>
                Use a different number
              </Button>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
