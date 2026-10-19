import { Button } from './button';
import { Sheet } from './sheet';

interface ConfirmSheetProps {
  open: boolean;
  /** Backing out: Escape, the backdrop, the close button and "Keep" all land here. */
  onClose: () => void;
  /** The question, e.g. "Leave this round?" — the sheet's accessible name. */
  title: string;
  /** One line: what the person loses. Never a second question. */
  consequence: string;
  /** The danger button's label, e.g. "Yes, leave". Starts with "Yes," so a glance reads it. */
  confirmLabel: string;
  /** The same button while the action runs, e.g. "Leaving…". */
  pendingLabel?: string;
  /** What backing out is called, e.g. "Keep my pledge". Default "Keep it". */
  keepLabel?: string;
  busy?: boolean;
  /** An action that failed: shown inside the sheet, which stays open. */
  error?: string | null;
  onConfirm: () => void;
  'data-testid'?: string;
}

/**
 * The one confirmation (FEAT-024): a sheet that asks before a destructive action. Built on
 * `Sheet` so it stacks (on the pledge sheet), traps focus, answers Escape and returns focus
 * to the control that opened it. Confirm is the danger variant; backing out is a ghost —
 * the safe choice is the quiet one, the costly one is the loud one, and neither is hidden.
 *
 * The CALLER keeps the action and its pending/error state; this sheet only asks. While the
 * action runs the sheet stays open with its pending label, and it is the caller's `onClose`
 * — after success — that dismisses it.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  consequence,
  confirmLabel,
  pendingLabel,
  keepLabel = 'Keep it',
  busy = false,
  error,
  onConfirm,
  'data-testid': testId,
}: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-2.5" data-testid={testId}>
          {error && (
            <p role="alert" className="text-meta font-bold text-danger-ink">
              {error}
            </p>
          )}
          <Button variant="danger" className="w-full" disabled={busy} onClick={onConfirm} data-testid="confirm-yes">
            {busy ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
          {/* Never disabled: the Sheet contract is "always closable" — the action, if running,
              keeps running (offline it is paused, and the caller's card says so). */}
          <Button variant="ghost" className="w-full" onClick={onClose} data-testid="confirm-keep">
            {keepLabel}
          </Button>
        </div>
      }
    >
      <p className="text-caption text-ink-muted" data-testid="confirm-consequence">
        {consequence}
      </p>
    </Sheet>
  );
}
