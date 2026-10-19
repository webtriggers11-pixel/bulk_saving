import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { usePush } from './usePush';

export const PUSH_PROMPT_KEY = 'bulk:push-prompt-dismissed';

function dismissedBefore(): boolean {
  try {
    return window.localStorage.getItem(PUSH_PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The one contextual ask (FEAT-020): shown on the rounds screen once the person has joined
 * something — the moment a notification is obviously useful — and only while this device
 * could be switched on. "Not now" is remembered per device; the Profile switch stays.
 */
export function PushPrompt({ joinedAny }: { joinedAny: boolean }) {
  const { state, busy, enable } = usePush();
  const [dismissed, setDismissed] = useState(dismissedBefore);
  if (!joinedAny || dismissed || state !== 'off') return null;

  function notNow() {
    setDismissed(true);
    try {
      window.localStorage.setItem(PUSH_PROMPT_KEY, '1');
    } catch {
      // Private mode: it shows again next visit, which is fine.
    }
  }

  return (
    <Card surface="tint" interactive={false} padding="none" className="flex items-center gap-3.5 p-[18px]" data-testid="push-prompt">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-paper/70 text-brand-ink">
        <Icon name="bell" size={20} strokeWidth={1.8} />
      </span>
      <p className="min-w-0 flex-1 text-meta text-ink-muted">
        <span className="block font-extrabold text-ink">Know the moment it goes ahead</span>
        Turn on notifications for this phone.
      </p>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Button size="sm" disabled={busy} onClick={() => void enable()}>
          Turn on
        </Button>
        <Button variant="link" onClick={notNow}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
