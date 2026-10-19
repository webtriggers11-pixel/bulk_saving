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

  async function confirm() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      setAsking(false);
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
        onClose={() => {
          if (!busy) setAsking(false);
        }}
        title="Log out of this phone?"
        consequence="You'll need a new code by SMS to sign in again. Your pledges and ratings stay."
        confirmLabel="Yes, log out"
        pendingLabel="Logging out…"
        keepLabel="Stay signed in"
        busy={busy}
        onConfirm={() => void confirm()}
        data-testid="sign-out-confirm"
      />
    </>
  );
}
