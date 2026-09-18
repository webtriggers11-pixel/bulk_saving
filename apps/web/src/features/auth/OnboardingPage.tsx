import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { requestOtp, verifyOtp } from './auth.api';
import { useAuthStore } from './auth.store';
import { messageFromError } from './error-messages';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, anyPaused } from '../../lib/offline';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

type Step = 'invite' | 'phone' | 'otp';

const STEP_ORDER: Step[] = ['invite', 'phone', 'otp'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [step, setStep] = useState<Step>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const requestMutation = useMutation({
    mutationFn: () => requestOtp({ inviteCode, phone }),
    onSuccess: () => setStep('otp'),
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyOtp({ inviteCode, phone, code, name: name.trim() ? name.trim() : undefined }),
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
    if (inviteCode.trim().length === 0) return;
    setStep('phone');
  }

  function submitPhone(event: FormEvent) {
    event.preventDefault();
    if (phone.trim().length === 0) return;
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
  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 bg-slate-50 p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Bulk Saving</h1>
        <p className="text-sm text-slate-500">Join your society to start saving together.</p>
      </header>

      <ol className="flex items-center justify-center gap-2" aria-label="Onboarding progress">
        {STEP_ORDER.map((label, index) => (
          <li
            key={label}
            className={
              index <= stepIndex ? 'h-1.5 w-10 rounded-full bg-teal-600' : 'h-1.5 w-10 rounded-full bg-slate-200'
            }
          />
        ))}
      </ol>

      <Card>
        {step === 'invite' && (
          <form onSubmit={submitInvite} noValidate>
            <CardHeader>
              <CardTitle>Enter your invite code</CardTitle>
              <CardDescription>The 8-character code shared by your society.</CardDescription>
            </CardHeader>
            <Label htmlFor="inviteCode">Invite code</Label>
            <Input
              id="inviteCode"
              name="inviteCode"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. AB12CD34"
              maxLength={8}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
            <Button className="mt-6 w-full" type="submit" disabled={inviteCode.trim().length === 0}>
              Continue
            </Button>
          </form>
        )}

        {step === 'phone' && (
          <form onSubmit={submitPhone} noValidate>
            <CardHeader>
              <CardTitle>What's your phone number?</CardTitle>
              <CardDescription>We'll text you a 6-digit code to verify it.</CardDescription>
            </CardHeader>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {queuedOffline && (
              <p role="status" data-testid="onboarding-offline" className="mt-3 text-sm text-amber-700">
                {OFFLINE_QUEUED_TEXT}
              </p>
            )}
            {requestError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {requestError}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStep('invite')}
                disabled={requestMutation.isPending}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                type="submit"
                disabled={requestMutation.isPending || phone.trim().length === 0}
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
          <form onSubmit={submitOtp} noValidate>
            <CardHeader>
              <CardTitle>Enter the code</CardTitle>
              <CardDescription>Sent by SMS to {phone}.</CardDescription>
            </CardHeader>
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />

            <Label htmlFor="name" className="mt-4">
              Your name <span className="font-normal text-slate-400">(optional)</span>
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
              <p role="alert" className="mt-3 text-sm text-red-600">
                {verifyError}
              </p>
            )}
            {requestError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {requestError}
              </p>
            )}

            <Button
              className="mt-6 w-full"
              type="submit"
              disabled={verifyMutation.isPending || code.trim().length === 0}
            >
              {queuedOffline
                ? OFFLINE_WAITING_LABEL
                : verifyMutation.isPending
                  ? 'Verifying…'
                  : 'Verify & continue'}
            </Button>

            <div className="mt-4 text-center text-sm text-slate-500">
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
            </div>
          </form>
        )}
      </Card>

    </main>
  );
}
