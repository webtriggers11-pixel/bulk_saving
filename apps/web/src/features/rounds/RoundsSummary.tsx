import type { RoundDto } from '@bulk/shared';
import { Card } from '../../components/ui/card';
import { Fact } from '../../components/ui/fact';
import { Sparkles } from '../../components/ui/sparkles';
import { formatRupees } from './formatPrice';
import { bestSavingForMe } from './roundMath';

/**
 * The strip above the rounds (FEAT-018): what's open, what's mine, and what joining has
 * put within reach. Derived from the list already on screen — no request of its own.
 *
 * "Could save" is the most the caller's own pledges save if every round they are in
 * reaches its best price; a dash until they have joined something, because ₹0 reads as
 * a verdict rather than an invitation.
 */
export function RoundsSummary({ rounds, total }: { rounds: RoundDto[]; total?: number }) {
  // FEAT-025: "Open" is the server's count; the other two are over the rounds loaded so
  // far, and say so when that is not all of them.
  const partial = total !== undefined && total > rounds.length;
  const joined = rounds.filter((round) => round.myUnits > 0).length;
  const saving = bestSavingForMe(rounds);
  return (
    <Card surface="solid" interactive={false} padding="none" className="p-[18px]" data-testid="rounds-summary">
      <dl className="grid grid-cols-3 divide-x divide-line/10 [&>*]:px-3 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0">
        <Fact variant="plain" size="large" term="Open" value={total ?? rounds.length} testId="summary-open" />
        <Fact variant="plain" size="large" term={partial ? `You're in (of the ${rounds.length} shown)` : "You're in"} value={joined} testId="summary-joined" />
        <Fact
          variant="plain"
          size="large"
          term="Could save"
          value={
            saving > 0 ? (
              // FEAT-019: the one number on this screen worth a little light.
              <Sparkles>
                <span className="ink-shimmer">{formatRupees(saving)}</span>
              </Sparkles>
            ) : (
              '—'
            )
          }
          testId="summary-saving"
        />
      </dl>
    </Card>
  );
}
