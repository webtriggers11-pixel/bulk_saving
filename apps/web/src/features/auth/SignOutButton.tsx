import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { ConfirmSheet } from '../../components/ui/confirm-sheet';
import { Icon } from '../../components/ui/icon';
import { useSignOut } from './useSignOut';

/**
 * The one way out (FEAT-024): a tap asks first, because since BUG-017 a sign-out ends this
 * phone's lifetime session and the next sign-in costs an OTP. `icon` is the Home header's
 * control; `wide` is the Profile's full-width button. Both open the same question.
 */
export function SignOutButton({ variant }: { variant: 'icon' | 'wide' }) {
  const signOut = useSignOut();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      setAsking(false);
    } catch {
      // Both steps inside signOut are capped and swallow their own errors; this is the
      // belt for anything else — the sheet stays open and says so (AC1).
      setError('Could not log out just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <Button variant="secondary" size="icon" aria-label="Log out" aria-haspopup="dialog" onClick={() => setAsking(true)}>
          <Icon name="logout" size={19} strokeWidth={2} />
        </Button>
      ) : (
        <Button variant="secondary" className="col-span-2 w-full" aria-haspopup="dialog" onClick={() => setAsking(true)}>
          <Icon name="logout" size={18} strokeWidth={2} />
          Log out
        </Button>
      )}
      <ConfirmSheet
        open={asking}
        // Always closable (Sheet contract): a sign-out in flight finishes on its own — both of
        // its steps are time-capped — and nothing is lost by hiding the question meanwhile.
        onClose={() => setAsking(false)}
        title="Log out of this phone?"
        consequence="You'll need a new code by SMS to sign in again. Your pledges and ratings stay."
        confirmLabel="Yes, log out"
        pendingLabel="Logging out…"
        keepLabel="Stay signed in"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        data-testid="sign-out-confirm"
      />
    </>
  );
}
