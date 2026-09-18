import { useState, type FormEvent } from 'react';
import type { MyRoundDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { messageFromError } from '../auth/error-messages';
import { STAR_VALUES, StarRating, type StarValue } from './StarRating';
import { useRateRound, useRemoveRating } from './useRating';

/** Mirrors the API's cap (MAX_RATING_COMMENT) so the two cannot drift apart. */
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
  const saved = round.myRating;
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState<StarValue | null>(saved ? asStarValue(saved.stars) : null);
  const [comment, setComment] = useState(saved?.comment ?? '');

  const rate = useRateRound();
  const remove = useRemoveRating();
  const busy = rate.isPending || remove.isPending;
  const error = rate.isError ? rate.error : remove.isError ? remove.error : null;
  /**
   * TanStack Query v5's default `networkMode: 'online'` PAUSES a mutation when the
   * browser is offline rather than failing it: `isPending` stays true, `isError`
   * stays false, and nothing rejects. Without this the button would read "Saving…"
   * forever with no explanation. A paused mutation DOES resume on reconnect, so the
   * honest message is "queued", not "failed". (Found via the FEAT-008 V2 review of
   * the equivalent hole on the query side.)
   */
  const queuedOffline = rate.isPaused || remove.isPaused;

  const open = editing || !saved;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (stars === null) {
      return;
    }
    const trimmed = comment.trim();
    rate.mutate(
      { roundId: round.id, stars, ...(trimmed.length > 0 ? { comment: trimmed } : {}) },
      {
        // Only leave edit mode once the SERVER has accepted it (ADR-0018: no
        // optimistic write). On failure the form stays open with the text intact.
        onSuccess: () => setEditing(false),
      },
    );
  }

  if (!open) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3" data-testid="rating-saved">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Your rating</p>
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
              variant="ghost"
              onClick={() => {
                setStars(asStarValue(saved.stars));
                setComment(saved.comment ?? '');
                setEditing(true);
              }}
            >
              Change
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => remove.mutate(round.id)}>
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
        {saved.comment && <p className="mt-1 text-sm text-slate-600">“{saved.comment}”</p>}
        {queuedOffline && (
          <p role="status" data-testid="rating-offline" className="mt-2 text-sm text-amber-700">
            You're offline. We'll send this as soon as you reconnect.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {messageFromError(error)}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 border-t border-slate-100 pt-3" noValidate>
      <p className="text-sm font-medium text-slate-700">
        {saved ? 'Change your rating' : 'How did it go?'}
      </p>
      <StarRating
        value={stars}
        onChange={setStars}
        disabled={busy}
        label={`Rate ${round.service.name}`}
        idPrefix={round.id}
      />

      <Label htmlFor={`comment-${round.id}`} className="mt-2 block">
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
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50"
      />

      {queuedOffline && (
        <p role="status" data-testid="rating-offline" className="mt-2 text-sm text-amber-700">
          You're offline. We'll send this rating as soon as you reconnect.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {messageFromError(error)}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={busy || stars === null}>
          {queuedOffline ? 'Waiting for a connection…' : rate.isPending ? 'Saving…' : saved ? 'Save changes' : 'Submit rating'}
        </Button>
        {saved && (
          <Button variant="ghost" type="button" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
