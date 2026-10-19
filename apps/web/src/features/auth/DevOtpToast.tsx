import { Button } from '../../components/ui/button';
import { Toast } from '../../components/ui/toast';

/** The dev-only code toast at the top (FEAT-026): says what it is, and fills the field on request. */
export function DevOtpToast({ code, onUse, onDismiss }: { code: string | null; onUse: (code: string) => void; onDismiss: () => void }) {
  return (
    <Toast placement="top" label="Dev only" duration={null} onDismiss={onDismiss} action={
      code ? (
        <Button variant="secondary" size="sm" onClick={() => { onUse(code); onDismiss(); }} data-testid="dev-otp-use">
          Use it
        </Button>
      ) : null
    }>
      {code ? (
        <span data-testid="dev-otp-code">
          Your code is <span className="num font-extrabold tracking-[0.12em]">{code}</span>
        </span>
      ) : null}
    </Toast>
  );
}
