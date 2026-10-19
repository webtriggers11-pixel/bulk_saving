import { Icon } from '../../components/ui/icon';
import { Switch } from '../../components/ui/switch';
import type { PushState } from '../../lib/push';
import { usePush } from './usePush';

/** What the row says under "Notifications", for each state this device can be in. */
const LINE: Record<PushState, string> = {
  on: 'On for this phone — round updates arrive as they happen.',
  off: 'Get a ping when a round you joined moves.',
  denied: 'Blocked in your browser settings for this site.',
  unsupported: 'Add the app to your Home Screen to get notifications.',
  unavailable: 'Not available yet.',
};

/**
 * Profile → Notifications (FEAT-020, ADR-0032): one switch for this device. Turning it on
 * asks the browser for permission (it is a tap, so the browser allows the prompt) and
 * registers the device; off unsubscribes it here and on the server.
 */
export function NotificationsRow() {
  const { state, busy, failed, enable, disable } = usePush();
  const usable = state === 'on' || state === 'off';
  return (
    <div className="surface-solid col-span-2 flex min-h-touch items-center gap-4 rounded-card p-[18px]" data-testid="notifications-row">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-paper/85 bg-gradient-to-br from-brand-light/25 to-brand/5 text-brand-ink">
        <Icon name="bell" size={20} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-extrabold text-ink">Notifications</span>
        <span className="mt-0.5 block text-meta text-ink-muted" data-testid="notifications-line">
          {failed ? 'Couldn’t change that just now. Please try again.' : state ? LINE[state] : 'Checking…'}
        </span>
      </span>
      <Switch
        label="Notifications on this phone"
        checked={state === 'on'}
        disabled={!usable}
        busy={busy}
        onChange={(on) => void (on ? enable() : disable())}
      />
    </div>
  );
}
