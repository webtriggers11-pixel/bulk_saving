import { useRef, useState, type FormEvent } from 'react';
import { Sheet } from '../../components/ui/sheet';
import type { MyRoundDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Label } from '../../components/ui/label';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, anyPaused } from '../../lib/offline';
import { ratingErrorMessage } from './rating-messages';
import { STAR_VALUES, StarRating, type StarValue } from './StarRating';
import { useRateRound, useRemoveRating } from './useRating';

/**
 * The API's comment cap.
 *
 * Deliberately a literal, NOT an import of `@bulk/shared`'s `MAX_RATING_COMMENT`:
 * `@bulk/shared` builds to CommonJS, every other web import from it is type-only
 * (erased at build time), and importing a runtime VALUE broke the production Vite
 * build — Rollup cannot statically see named exports of that CJS bundle. Vitest
 * (esbuild) resolved it happily, so only the CHORE-004 build gate caught it.
 *
 * Drift is prevented by a test instead: `rating-cap.test.ts` asserts this equals the
 * shared constant, which Vitest CAN import. So the two cannot diverge silently, and
 * the production bundle keeps no runtime dependency on the shared package.
 */
export const MAX_COMMENT = 500;

/** Statuses a resident may rate — the job has actually been done (ADR-0017). */
export function isRateable(status: MyRoundDto['status']): boolean {
  return status === 'DELIVERED' || status === 'RATED';
}

function asStarValue(stars: number): StarValue | null {
  return (STAR_VALUES as readonly number[]).includes(stars) ? (stars as StarValue) : null;
}

/**
 * The rating control on a My Requests card (FEAT-009, ADR-0018).
 *
 * Three states: unrated (prompt + form), saved (what they said + Change / Remove),
 * and editing. A failed write keeps the typed comment and leaves the form usable —
 * on Indian mobile data a failed submit is ordinary, and losing what someone wrote
 * is the fastest way to stop them writing anything again.
 */
export function RateRound({ round }: { round: MyRoundDto }) {
  const rate = useRateRound();
  const remove = useRemoveRating();
  /**
   * What to show as saved. The query is the source of truth, but between a
   * successful PUT and the invalidated refetch landing there is a window where
   * `round.myRating` is still null — and if that refetch then fails or pauses
   * (offline the instant after the write committed, which is exactly this
   * feature's scenario) the resident would be left staring at an empty form for a
   * rating that WAS saved (V2 P1-5). `rate.data` covers that window; a withdrawal
   * clears it again.
   */
  const saved = round.myRating ?? (remove.isSuccess ? null : (rate.data ?? null));
  // FEAT-016: the form lives in a sheet; `editing` is whether that sheet is open.
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState<StarValue | null>(saved ? asStarValue(saved.stars) : null);
  const [comment, setComment] = useState(saved?.comment ?? '');

  const busy = rate.isPending || remove.isPending;
  // Each error shows where it happened, once: a failed withdrawal on the card, a failed
  // submit in the sheet. One shared `error` put the same alert in both (V2 P2-10).
  const removeError = remove.isError ? remove.error : null;
  const rateError = rate.isError ? rate.error : null;
  // Focus lands on "Change" after the sheet closes — after a FIRST rating the button
  // that opened the sheet ("Rate this job") no longer exists (V2 P2-4).
  const changeButton = useRef<HTMLButtonElement>(null);
  /**
   * TanStack Query v5's default `networkMode: 'online'` PAUSES a mutation when the
   * browser is offline rather than failing it: `isPending` stays true, `isError`
   * stays false, and nothing rejects. Without this the button would read "Saving…"
   * forever with no explanation. A paused mutation DOES resume on reconnect, so the
   * honest message is "queued", not "failed". (Found via the FEAT-008 V2 review of
   * the equivalent hole on the query side.)
   */
  const queuedOffline = anyPaused(rate, remove);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (stars === null) {
      return;
    }
    const trimmed = comment.trim();
    rate.mutate(
      { roundId: round.id, stars, ...(trimmed.length > 0 ? { comment: trimmed } : {}) },
      {
        // Only close the sheet once the SERVER has accepted it (ADR-0018: no
        // optimistic write). On failure the sheet stays open with the text intact.
        onSuccess: () => setEditing(false),
      },
    );
  }

  return (
    <>
      {saved ? (
        <div className="mt-4 border-t border-line/10 pt-4" data-testid="rating-saved">
          {/* BUG-015: wraps on a phone — five 44px stars beside Change + Remove ran past
              a 360px screen. */}
          <div className="flex flex-wrap items-center justify-between gap-3" data-testid="rating-saved-row">
            <div>
              <p className="term-label">Your rating</p>
              {/* `my-rating` is FEAT-008's existing test contract for a saved
                  rating — kept so its MyRequestsPage test stays meaningful. */}
              <StarRating
                value={asStarValue(saved.stars)}
                label="Your rating"
                idPrefix={`saved-${round.id}`}
                testId="my-rating"
              />
            </div>
            <div className="flex gap-2">
              <Button
                ref={changeButton}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStars(asStarValue(saved.stars));
                  setComment(saved.comment ?? '');
                  setEditing(true);
                }}
              >
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  // Clear the local draft too (V2 P1-4): without this the form
                  // reopens with the stars and comment the resident just deleted
                  // still filled in, one tap away from re-creating them.
                  remove.mutate(round.id, {
                    onSuccess: () => {
                      setStars(null);
                      setComment('');
                      setEditing(false);
                      rate.reset();
                    },
                  })
                }
              >
                {remove.isPending ? 'Removing…' : 'Remove'}
              </Button>
            </div>
          </div>
          {saved.comment && (
            <p className="surface-inset mt-3 rounded-inset px-3.5 py-3 text-caption italic text-ink-muted">
              “{saved.comment}”
            </p>
          )}
          {queuedOffline && (
            <p role="status" data-testid="rating-offline" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink">
              <Icon name="offline" size={16} strokeWidth={2} />
              {OFFLINE_QUEUED_TEXT}
            </p>
          )}
          {removeError && (
            <p role="alert" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink">
              <Icon name="alert" size={16} strokeWidth={2} />
              {ratingErrorMessage(removeError)}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/10 pt-4" data-testid="rating-prompt">
          <p className="text-meta font-bold text-ink-muted">How did it go? Your rating helps the next resident.</p>
          <Button size="sm" className="shrink-0 whitespace-nowrap" aria-haspopup="dialog" onClick={() => setEditing(true)}>
            Rate this job
          </Button>
        </div>
      )}
      {/* A first rating queued offline, or refused later, says so on the card once the
          sheet is closed — the prompt alone would read as if nothing happened (V2 round 2). */}
      {!saved && !editing && queuedOffline && (
        <p role="status" data-testid="rating-offline" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink">
          <Icon name="offline" size={16} strokeWidth={2} />
          {OFFLINE_QUEUED_TEXT}
        </p>
      )}
      {!saved && !editing && rateError && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink">
          <Icon name="alert" size={16} strokeWidth={2} />
          {ratingErrorMessage(rateError)}
        </p>
      )}
      <Sheet
        open={editing}
        // Always closable. A save paused offline keeps `busy` true until the network
        // returns, and refusing to close held the resident in a modal for that long
        // (V2 P1-1). The draft lives here, not in the sheet, so nothing is lost.
        onClose={() => setEditing(false)}
        returnFocus={() => changeButton.current}
        title={saved ? 'Change your rating' : 'How did it go?'}
        description={round.service.name}
      >
        <form onSubmit={submit} className="field" noValidate>
          <StarRating
            value={stars}
            onChange={setStars}
            disabled={busy}
            label={`Rate ${round.service.name}`}
            idPrefix={round.id}
          />

          <Label htmlFor={`comment-${round.id}`} className="mt-2">
            Comment (optional)
          </Label>
          <textarea
            id={`comment-${round.id}`}
            value={comment}
            maxLength={MAX_COMMENT}
            rows={2}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything the next resident should know?"
            className="mt-1 w-full rounded-control border border-paper/70 paint-glass px-3.5 py-3 text-caption font-medium text-ink shadow-field placeholder:text-ink-soft focus:border-brand/60 focus:shadow-ring focus:outline-none disabled:opacity-60"
          />

          {queuedOffline && (
            <p role="status" data-testid="rating-offline" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink">
              <Icon name="offline" size={16} strokeWidth={2} />
              {OFFLINE_QUEUED_TEXT}
            </p>
          )}
          {rateError && (
            <p role="alert" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink">
              <Icon name="alert" size={16} strokeWidth={2} />
              {ratingErrorMessage(rateError)}
            </p>
          )}

          <div className="mt-4 flex gap-2.5">
            <Button type="submit" disabled={busy || stars === null}>
              {queuedOffline
                ? OFFLINE_WAITING_LABEL
                : rate.isPending
                  ? 'Saving…'
                  : saved
                    ? 'Save changes'
                    : 'Submit rating'}
            </Button>
            <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
