import type { RoundDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { formatRupees } from './formatPrice';
import { moreUnits, unitsToNext } from './roundMath';

/**
 * What an invitation says (FEAT-018). A group buy gets cheaper with every neighbour who
 * joins, so the message leads with that. It names the service and the price — never the
 * person sharing, their flat or their pledge: it may be forwarded anywhere.
 */
export function inviteText(round: RoundDto): string {
  const toGo = unitsToNext(round);
  const pitch =
    round.nextTier && toGo > 0 && round.nextTier.price < round.currentPrice
      ? ` ${moreUnits(toGo, round)} and everyone pays ${formatRupees(round.nextTier.price)}.`
      : '';
  return `Join the ${round.service.name} group buy in our society on Bulk Saving.${pitch}`;
}

/**
 * Invite neighbours (FEAT-018): the phone's share sheet where there is one; otherwise the
 * link goes to the clipboard and `onMessage` says so — the screen owns the one toast
 * (V2 P3-2). A dismissed share sheet is not an error and says nothing.
 */
export function InviteButton({ round, onMessage }: { round: RoundDto; onMessage: (message: string) => void }) {
  async function invite() {
    const url = `${window.location.origin}/rounds`;
    const text = inviteText(round);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Bulk Saving', text, url });
        return;
      } catch (err) {
        // The person closed the sheet: nothing to say.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      onMessage('Invite link copied — paste it in your society group.');
    } catch {
      onMessage(`Share this link with your neighbours: ${url}`);
    }
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={`Invite neighbours to ${round.service.name}`}
      onClick={() => void invite()}
      data-testid={`invite-${round.id}`}
    >
      <Icon name="share" size={19} strokeWidth={2} />
    </Button>
  );
}
