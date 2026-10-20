import { normalisePhone } from '@bulk/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { requestOtp, verifyOtp } from './auth.api';
import { useAuthStore } from './auth.store';
import { INVITE_CODE_SHAPE, INVITE_HINT, messageFromError, PHONE_HINT } from './error-messages';
import { useDevOtp } from './useDevOtp';
import { DevOtpToast } from './DevOtpToast';
import { useAuthMethods } from './useAuthMethods';
import { useWhatsAppLogin } from './useWhatsAppLogin';
import { WhatsAppSignIn } from './WhatsAppSignIn';
import { startWhatsAppLogin } from './wa.api';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, anyPaused } from '../../lib/offline';
import { AmbientGround } from '../../components/ui/ambient-ground';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Notice } from '../../components/ui/notice';

/** FEAT-027: after the invite code, a choice — WhatsApp (when offered) or the SMS code. */
type Step = 'invite' | 'choose' | 'whatsapp' | 'phone' | 'otp';

/** The progress bar's three beats: the code, the proof, the way in. */
const STEP_ORDER = ['invite', 'verify', 'otp'] as const;
const STEP_INDEX: Record<Step, number> = { invite: 0, choose: 1, whatsapp: 1, phone: 1, otp: 2 };

export function OnboardingPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [step, setStep] = useState<Step>('invite');
  const [inviteCode, setInviteCode] = useState('');
  // BUG-021: a code that cannot be right never reaches the server. The hint appears only
  // when someone tries to continue with one (owner: "give error in invite code only if it's
  // wrong") — never while they are still typing.
  const inviteWellFormed = INVITE_CODE_SHAPE.test(inviteCode);
  const [inviteTried, setInviteTried] = useState(false);
  const inviteImplausible = inviteTried && !inviteWellFormed;
  const [phone, setPhone] = useState('');
  // Typed something, but not yet a number the server will accept.
  const implausible = phone.trim().length > 0 && normalisePhone(phone) === null;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  // FEAT-026: in a DEV build, the code the stub channel "sent" arrives as a toast.
  const devOtp = useDevOtp();
  // FEAT-027 (ADR-0038): sign in with WhatsApp, when this server offers it.
  const methods = useAuthMethods();
  const whatsApp = useWhatsAppLogin(
    () => startWhatsAppLogin({ inviteCode }),
    (result) => {
      login({ accessToken: result.accessToken, refreshToken: result.refreshToken, resident: result.resident });
      navigate('/', { replace: true });
    },
  );
  const requestMutation = useMutation({
    // BUG-019: the canonical form, so the number shown back is the one the server keeps.
    mutationFn: () => requestOtp({ inviteCode, phone: normalisePhone(phone) ?? phone.trim() }),
    // A resend must not keep showing the previous code while the new one is fetched.
    onMutate: () => devOtp.clear(),
    onSuccess: () => {
      setStep('otp');
      devOtp.fetchFor(phone);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyOtp({ inviteCode, phone: normalisePhone(phone) ?? phone.trim(), code, name: name.trim() ? name.trim() : undefined }),
    onSuccess: (result) => {
      login({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        resident: result.resident,
      });
      navigate('/', { replace: true });
    },
  });

  function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!inviteWellFormed) {
      setInviteTried(true);
      return;
    }
    setInviteTried(false);
    setStep(methods.whatsapp ? 'choose' : 'phone');
  }

  function submitPhone(event: FormEvent) {
    event.preventDefault();
    // BUG-019: only a number the server will accept — the button says so until then.
    if (normalisePhone(phone) === null) return;
    requestMutation.mutate();
  }

  function submitOtp(event: FormEvent) {
    event.preventDefault();
    if (code.trim().length === 0) return;
    verifyMutation.mutate();
  }

  const requestError = requestMutation.isError ? messageFromError(requestMutation.error) : null;
  // BUG-004 (V2 P2): offline PAUSES a mutation — isPending stays true and nothing
  // rejects — so "Sending…" / "Verifying…" hung forever on the app's front door.
  const queuedOffline = anyPaused(requestMutation, verifyMutation);
  const verifyError = verifyMutation.isError ? messageFromError(verifyMutation.error) : null;
  const stepIndex = STEP_INDEX[step];

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden" data-whatsapp={methods.whatsapp ? 'on' : 'off'}>
      <DevOtpToast code={devOtp.code} onUse={setCode} onDismiss={devOtp.clear} />
      {/* /onboard renders outside the app shell (FEAT-008 AC2), so it brings its own
          ground — the primitive, not a second copy of it. */}
      <AmbientGround id="onboard-grain" />

      <header className="animate-rise relative flex flex-1 flex-col justify-center gap-[18px] px-7 pb-6 pt-10">
        <span className="animate-breathe inline-flex w-fit items-center gap-2 rounded-full border border-paper/80 bg-gradient-to-br from-paper/90 to-paper/50 px-3.5 py-1.5 text-eyebrow uppercase text-brand-ink shadow-lift">
          <Icon name="users" size={13} strokeWidth={2.2} />
          Society group buys
        </span>
        <h1 className="animate-blur-in bg-gradient-to-br from-ink via-brand to-brand-light bg-clip-text pb-1.5 text-hero font-extrabold text-transparent">
          Bulk
          <br />
          Saving
        </h1>
        <p className="max-w-[280px] text-lead font-medium text-ink-muted">
          Join your society to start saving together.
        </p>
        <ol className="flex items-center gap-2" aria-label="Onboarding progress">
          {STEP_ORDER.map((label, index) => (
            <li
              key={label}
              className={[
                'h-1.5 overflow-hidden rounded-full bg-line/15 t',
                index === stepIndex ? 'w-[52px]' : 'w-[34px]',
              ].join(' ')}
            >
              {index <= stepIndex && (
                <span className="bar-fill block h-full w-full rounded-full bg-gradient-to-r from-brand-deep to-brand-light shadow-glow" />
              )}
            </li>
          ))}
        </ol>
      </header>

      {/* The form lives in a bottom sheet: thumb-reachable on a phone, and it keeps
          the brand in view while a resident types an OTP. */}
      <section className="animate-rise relative rounded-t-sheet border-t border-paper/95 bg-gradient-to-b from-paper/95 to-paper/75 px-6 pb-8 pt-7 shadow-sheet backdrop-blur-chrome backdrop-saturate-[1.9] [animation-delay:140ms]">
        <span aria-hidden="true" className="mx-auto mb-6 block h-[5px] w-11 rounded-full bg-line/20" />
        {step === 'invite' && (
          <form onSubmit={submitInvite} noValidate className="field">
            <h2 className="text-title font-extrabold text-ink">Enter your invite code</h2>
            <p className="mb-6 mt-2 text-caption text-ink-muted">The 8-character code shared by your society.</p>
            <Label htmlFor="inviteCode">Invite code</Label>
            <Input
              emphasis="primary"
              textSize="xl"
              tracking="invite"
              id="inviteCode"
              name="inviteCode"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. AB12CD34"
              maxLength={8}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              className="num text-center"
              aria-describedby={inviteImplausible ? 'invite-hint' : undefined}
            />
            {inviteImplausible && (
              <p id="invite-hint" className="mt-2 text-caption text-ink-muted" data-testid="invite-hint">
                {INVITE_HINT}
              </p>
            )}
            <Button className="mt-[22px] w-full" type="submit" disabled={inviteCode.length === 0}>
              Continue
              <Icon name="forward" size={18} strokeWidth={2.2} className="nudge" />
            </Button>
          </form>
        )}

        {step === 'choose' && (
          <div className="field" data-testid="onboarding-choose">
            <h2 className="text-title font-extrabold text-ink">How would you like to sign in?</h2>
            <p className="mb-6 mt-2 text-caption text-ink-muted">WhatsApp is three taps and nothing to type. An SMS code works on any phone.</p>
            <Button className="w-full" onClick={() => setStep('whatsapp')} data-testid="continue-whatsapp">
              <Icon name="chat" size={18} strokeWidth={2.2} />
              Continue with WhatsApp
            </Button>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => setStep('phone')}>
              Get an SMS code
            </Button>
            <p className="mt-4 text-center text-caption font-medium text-ink-muted">
              <Button variant="link" onClick={() => setStep('invite')}>
                Back
              </Button>
            </p>
          </div>
        )}

        {step === 'whatsapp' && (
          <WhatsAppSignIn login={whatsApp} onUseSms={() => { whatsApp.reset(); setStep('phone'); }} />
        )}

        {step === 'phone' && (
          <form onSubmit={submitPhone} noValidate className="field">
            <h2 className="text-title font-extrabold text-ink">What's your phone number?</h2>
            <p className="mb-6 mt-2 text-caption text-ink-muted">We'll text you a 6-digit code to verify it.</p>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              emphasis="primary"
              textSize="lg"
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="num"
              aria-describedby={implausible ? 'phone-hint' : undefined}
            />
            {/* BUG-019: a disabled button with no words is a dead end — say what a number must look like. */}
            {implausible && (
              <p id="phone-hint" className="mt-2 text-caption text-ink-muted" data-testid="phone-hint">
                {PHONE_HINT}
              </p>
            )}
            {queuedOffline && (
              <Notice tone="warn" data-testid="onboarding-offline">
                {OFFLINE_QUEUED_TEXT}
              </Notice>
            )}
            {requestError && (
              <Notice tone="error">{requestError}</Notice>
            )}
            <div className="mt-[22px] flex gap-3">
              <Button
                variant="secondary"
                className="w-[108px]"
                onClick={() => setStep(methods.whatsapp ? 'choose' : 'invite')}
                disabled={requestMutation.isPending}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                type="submit"
                disabled={requestMutation.isPending || normalisePhone(phone) === null}
              >
                {queuedOffline
                  ? OFFLINE_WAITING_LABEL
                  : requestMutation.isPending
                    ? 'Sending…'
                    : 'Send code'}
              </Button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={submitOtp} noValidate className="field">
            <h2 className="text-title font-extrabold text-ink">Enter the code</h2>
            <p className="mb-6 mt-2 text-caption text-ink-muted">
              Sent by SMS to <span className="num font-bold text-ink">{normalisePhone(phone) ?? phone}</span>.
            </p>
            <Label htmlFor="code">6-digit code</Label>
            <Input
              emphasis="primary"
              textSize="code"
              tracking="code"
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="num text-center"
            />

            <Label htmlFor="name" className="mt-[18px]">
              Your name <span className="font-semibold normal-case tracking-normal text-ink-soft">(optional)</span>
            </Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            {verifyError && (
              <Notice tone="error">{verifyError}</Notice>
            )}
            {requestError && (
              <Notice tone="error">{requestError}</Notice>
            )}

            <Button
              className="mt-[22px] w-full"
              type="submit"
              disabled={verifyMutation.isPending || code.trim().length === 0}
            >
              {queuedOffline
                ? OFFLINE_WAITING_LABEL
                : verifyMutation.isPending
                  ? 'Verifying…'
                  : 'Verify & continue'}
            </Button>

            <p className="mt-4 text-center text-caption font-medium text-ink-muted">
              Didn't get it?{' '}
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
          </form>
        )}
      </section>
    </main>
  );
}
