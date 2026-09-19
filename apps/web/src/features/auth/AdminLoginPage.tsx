import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { requestAdminOtp, verifyAdminOtp } from './auth.api';
import { useAuthStore } from './auth.store';
import { messageFromError } from './error-messages';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, anyPaused } from '../../lib/offline';
import { AmbientGround } from '../../components/ui/ambient-ground';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Notice } from '../../components/ui/notice';

type Step = 'phone' | 'code';

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
  const [code, setCode] = useState('');

  const requestMutation = useMutation({
    mutationFn: () => requestAdminOtp({ phone: phone.trim() }),
    onSuccess: () => setStep('code'),
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyAdminOtp({ phone: phone.trim(), code }),
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
    if (phone.trim().length === 0) return;
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
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden">
      <AmbientGround id="admin-login-grain" />

      <header className="animate-rise relative flex flex-1 flex-col justify-center gap-[18px] px-7 pb-6 pt-10">
        <span className="animate-breathe inline-flex w-fit items-center gap-2 rounded-full border border-white/80 bg-gradient-to-br from-white/90 to-white/50 px-3.5 py-1.5 text-eyebrow uppercase text-brand-ink shadow-lift">
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
                'h-1.5 overflow-hidden rounded-full bg-shade/15 t',
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

      <section className="animate-rise relative rounded-t-sheet border-t border-white/95 bg-gradient-to-b from-white/95 to-white/75 px-6 pb-8 pt-7 shadow-sheet backdrop-blur-chrome backdrop-saturate-[1.9] [animation-delay:140ms]">
        <span aria-hidden="true" className="mx-auto mb-6 block h-[5px] w-11 rounded-full bg-shade/20" />

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
            />
            {queuedOffline && (
              <Notice tone="warn" data-testid="admin-login-offline">
                {OFFLINE_QUEUED_TEXT}
              </Notice>
            )}
            {requestError && <Notice tone="error">{requestError}</Notice>}
            <Button
              className="mt-[22px] w-full"
              type="submit"
              disabled={requestMutation.isPending || phone.trim().length === 0}
            >
              {queuedOffline
                ? OFFLINE_WAITING_LABEL
                : requestMutation.isPending
                  ? 'Sending…'
                  : 'Send code'}
              <Icon name="forward" size={18} strokeWidth={2.2} className="nudge" />
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={submitCode} noValidate className="field">
            <h2 className="text-title font-extrabold text-ink">Enter the code</h2>
            <p className="mb-6 mt-2 text-caption text-ink-muted">
              Sent by SMS to <span className="num font-bold text-ink">{phone}</span>.
            </p>
            <Label htmlFor="admin-code">6-digit code</Label>
            <Input
              emphasis="primary"
              textSize="code"
              id="admin-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="num text-center tracking-[0.38em]"
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
              <Button variant="link" onClick={() => setStep('phone')}>
                Use a different number
              </Button>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
