import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyRoundDto, RatingDto, RoundStatus } from '@bulk/shared';
import { ApiError } from '../../lib/api';
import { MyRequestsPage } from '../requests/MyRequestsPage';
import { fetchMyRounds } from '../rounds/rounds.api';
import { rateRound, removeRating } from './rating.api';
import { page } from '../../test/page';

vi.mock('../rounds/rounds.api', () => ({
  fetchMyRounds: vi.fn(),
  fetchRounds: vi.fn(),
  joinRound: vi.fn(),
  updatePledge: vi.fn(),
  leaveRound: vi.fn(),
}));
vi.mock('./rating.api', () => ({ rateRound: vi.fn(), removeRating: vi.fn() }));

const fetchMyRoundsMock = vi.mocked(fetchMyRounds);
const rateRoundMock = vi.mocked(rateRound);
const removeRatingMock = vi.mocked(removeRating);

function round(overrides: Partial<MyRoundDto> = {}): MyRoundDto {
  return {
    id: 'round_1',
    service: { id: 'svc_1', name: 'AC Servicing', slug: 'ac-servicing', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
    status: 'DELIVERED',
    unitsCount: 6,
    currentPrice: 700,
    deadline: '2026-09-10T12:00:00.000Z',
    tiers: [{ threshold: 5, price: 700 }],
    myUnits: 2,
    finalPrice: null,
    myRating: null,
    ...overrides,
  };
}

const savedRating: RatingDto = {
  id: 'rat_1',
  roundId: 'round_1',
  residentId: 'res_1',
  stars: 4,
  comment: 'Tidy work.',
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-18T10:00:00.000Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MyRequestsPage />
    </QueryClientProvider>,
  );
}

/** FEAT-016: the rating form lives in a sheet, opened from the card. */
async function openRating() {
  fireEvent.click(await screen.findByRole('button', { name: 'Rate this job' }));
}

describe('RateRound (on the My Requests card)', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    vi.clearAllMocks();
  });

  describe('which rounds offer rating', () => {
    it.each(['DELIVERED', 'RATED'] as RoundStatus[])('offers rating on %s', async (status) => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status })]));
      renderPage();
    await openRating();
      expect(await screen.findByRole('radiogroup', { name: 'Rate AC Servicing' })).toBeInTheDocument();
    });

    it.each(['OPEN', 'CLOSED_MET', 'CLOSED_EXPIRED', 'ASSIGNED', 'CANCELLED'] as RoundStatus[])(
      'offers NO rating on %s — the job has not been done',
      async (status) => {
        fetchMyRoundsMock.mockResolvedValue(page([round({ status })]));
        renderPage();
        await screen.findByText('AC Servicing');
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Submit rating' })).not.toBeInTheDocument();
      },
    );
  });

  describe('submitting', () => {
    it('sends the stars and the trimmed comment', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round()]));
      rateRoundMock.mockResolvedValue({ ...savedRating, stars: 5, comment: 'Great job.' });
      renderPage();
    await openRating();

      fireEvent.click(await screen.findByRole('radio', { name: '5 stars' }));
      fireEvent.change(screen.getByLabelText('Comment (optional)'), {
        target: { value: '  Great job.  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

      await waitFor(() =>
        expect(rateRoundMock).toHaveBeenCalledWith('round_1', { stars: 5, comment: 'Great job.' }),
      );
    });

    it('omits the comment entirely when it is blank', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round()]));
      rateRoundMock.mockResolvedValue({ ...savedRating, stars: 3, comment: null });
      renderPage();
    await openRating();

      fireEvent.click(await screen.findByRole('radio', { name: '3 stars' }));
      fireEvent.change(screen.getByLabelText('Comment (optional)'), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

      await waitFor(() => expect(rateRoundMock).toHaveBeenCalledWith('round_1', { stars: 3 }));
    });

    it('cannot be submitted without a score', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round()]));
      renderPage();
    await openRating();

      const submit = await screen.findByRole('button', { name: 'Submit rating' });
      expect(submit).toBeDisabled();

      fireEvent.click(submit);
      expect(rateRoundMock).not.toHaveBeenCalled();
    });

    it('disables submit while the write is in flight, so a double tap sends one write', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round()]));
      let resolve: ((value: RatingDto) => void) | undefined;
      rateRoundMock.mockImplementation(() => new Promise<RatingDto>((r) => (resolve = r)));
      renderPage();
    await openRating();

      fireEvent.click(await screen.findByRole('radio', { name: '4 stars' }));
      fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

      const pending = await screen.findByRole('button', { name: 'Saving…' });
      expect(pending).toBeDisabled();
      fireEvent.click(pending);
      expect(rateRoundMock).toHaveBeenCalledTimes(1);

      // Settle the in-flight mutation inside act(), so React's state update lands
      // during the test rather than after it (which would warn and leak).
      await act(async () => {
        resolve?.(savedRating);
      });
      expect(rateRoundMock).toHaveBeenCalledTimes(1);
    });

    it('shows a friendly error and KEEPS the typed comment when the write fails', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round()]));
      rateRoundMock.mockRejectedValue(new ApiError('ROUND_NOT_DELIVERED', 'not delivered', 409));
      renderPage();
    await openRating();

      fireEvent.click(await screen.findByRole('radio', { name: '2 stars' }));
      fireEvent.change(screen.getByLabelText('Comment (optional)'), {
        target: { value: 'Turned up late.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      // The words a resident wrote must survive a failed request.
      expect(screen.getByLabelText('Comment (optional)')).toHaveValue('Turned up late.');
      expect(screen.getByRole('button', { name: 'Submit rating' })).toBeEnabled();
    });
  });

  describe('an existing rating', () => {
    it('shows what the resident said, with no form until they ask to change it', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'RATED', myRating: savedRating })]));
      renderPage();

      expect(await screen.findByTestId('my-rating')).toHaveTextContent('4 / 5');
      expect(screen.getByText('“Tidy work.”')).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('opens the form pre-filled on Change, and saves the revision', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'RATED', myRating: savedRating })]));
      rateRoundMock.mockResolvedValue({ ...savedRating, stars: 2 });
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Change' }));

      expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
      expect(screen.getByLabelText('Comment (optional)')).toHaveValue('Tidy work.');

      fireEvent.click(screen.getByRole('radio', { name: '2 stars' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(rateRoundMock).toHaveBeenCalledWith('round_1', { stars: 2, comment: 'Tidy work.' }),
      );
    });

    it('can be abandoned with Cancel, leaving the saved rating alone', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'RATED', myRating: savedRating })]));
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
      fireEvent.click(screen.getByRole('radio', { name: '1 star' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByTestId('my-rating')).toHaveTextContent('4 / 5');
      expect(rateRoundMock).not.toHaveBeenCalled();
    });

    it('removing asks first; backing out runs nothing (FEAT-024)', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'RATED', myRating: savedRating })]));
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
      expect(screen.getByRole('dialog', { name: 'Remove your rating?' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Keep my rating' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await act(async () => {
        await Promise.resolve();
      });
      expect(removeRatingMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('my-rating')).toHaveTextContent('4 / 5');
    });

    it('offline, a confirmed removal says it is waiting and can still be backed out of (V2 P1)', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'RATED', myRating: savedRating })]));
      removeRatingMock.mockResolvedValue(undefined);
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
      act(() => {
        onlineManager.setOnline(false);
      });
      try {
        fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
        expect(await screen.findByRole('button', { name: 'Waiting for a connection…' })).toBeDisabled();
        expect(removeRatingMock).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('sheet-backdrop'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        act(() => {
          onlineManager.setOnline(true);
        });
        await waitFor(() => expect(removeRatingMock).toHaveBeenCalledTimes(1));
      } finally {
        act(() => {
          onlineManager.setOnline(true);
        });
      }
    });

    it('withdraws the rating on Remove', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'RATED', myRating: savedRating })]));
      removeRatingMock.mockResolvedValue(undefined);
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
      // FEAT-024: it asks first.
      fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

      await waitFor(() => expect(removeRatingMock).toHaveBeenCalledWith('round_1'));
    });

    it('reports a failed withdrawal instead of pretending it worked', async () => {
      fetchMyRoundsMock.mockResolvedValue(page([round({ status: 'RATED', myRating: savedRating })]));
      removeRatingMock.mockRejectedValue(new ApiError('NOT_FOUND', 'nothing to remove', 404));
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
      // FEAT-024: it asks first.
      fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByTestId('my-rating')).toHaveTextContent('4 / 5');
    });
  });

  it('tells the resident it is queued when they submit OFFLINE, not "Saving…" forever', async () => {
    // A rejected promise is the SERVER-ERROR path. Offline is different: v5 pauses
    // the mutation, nothing rejects, and isPending stays true — so this must be
    // driven through onlineManager, or the hole is invisible (FEAT-008 V2 finding).
    fetchMyRoundsMock.mockResolvedValue(page([round()]));
    renderPage();
    await openRating();
    fireEvent.click(await screen.findByRole('radio', { name: '4 stars' }));

    act(() => {
      onlineManager.setOnline(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

    expect(await screen.findByTestId('rating-offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Waiting for a connection…' })).toBeDisabled();
    // Paused, not sent — and not silently dropped either.
    expect(rateRoundMock).not.toHaveBeenCalled();

    act(() => {
      onlineManager.setOnline(true);
    });
    // It resumes on reconnect: that is why the copy says "queued", not "failed".
    await waitFor(() => expect(rateRoundMock).toHaveBeenCalledTimes(1));
  });

  it('can always be closed — a submit paused OFFLINE does not hold the resident in the sheet (FEAT-016 V2 P1-1)', async () => {
    fetchMyRoundsMock.mockResolvedValue(page([round()]));
    renderPage();
    await openRating();
    fireEvent.click(await screen.findByRole('radio', { name: '4 stars' }));
    act(() => {
      onlineManager.setOnline(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));
    expect(await screen.findByTestId('rating-offline')).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // …and the card still says it is queued (V2 round 2).
    expect(screen.getByTestId('rating-offline')).toBeInTheDocument();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  it('shows the SAVED card after a successful submit, even if the refetch never lands', async () => {
    // V2 P1-5: the card derived "saved" purely from the polled query, so between a
    // successful PUT and the refetch — or forever, if that refetch pauses offline —
    // the resident saw an empty form for a rating that WAS saved.
    fetchMyRoundsMock.mockResolvedValue(page([round()])); // always reports unrated
    rateRoundMock.mockResolvedValue({ ...savedRating, stars: 5, comment: null });
    renderPage();
    await openRating();

    fireEvent.click(await screen.findByRole('radio', { name: '5 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

    expect(await screen.findByTestId('my-rating')).toHaveTextContent('5 / 5');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('a withdrawn rating does NOT come back pre-filled in the form', async () => {
    // V2 P1-4: local draft state survived the delete, so the form reopened with the
    // stars and comment the resident had just removed — one tap from re-creating them.
    fetchMyRoundsMock
      .mockResolvedValueOnce(page([round({ status: 'RATED', myRating: savedRating })]))
      .mockResolvedValue(page([round({ status: 'RATED', myRating: null })]));
    removeRatingMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

    // Back to the unrated prompt, and opening it shows nothing carried over.
    await openRating();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByLabelText('Comment (optional)')).toHaveValue('');
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Submit rating' })).toBeDisabled();
  });

  it('explains a rating-specific failure instead of a generic apology', async () => {
    // V2 P2: these errors used to go through the AUTH error map, so every rating
    // failure became "Something went wrong. Please try again." — advice to retry
    // something that cannot succeed.
    fetchMyRoundsMock.mockResolvedValue(page([round()]));
    rateRoundMock.mockRejectedValue(new ApiError('NOT_A_PARTICIPANT', 'nope', 403));
    renderPage();
    await openRating();

    fireEvent.click(await screen.findByRole('radio', { name: '3 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/joined this round/i);
  });

  it('caps the comment at the same length as the API', async () => {
    fetchMyRoundsMock.mockResolvedValue(page([round()]));
    renderPage();
    await openRating();
    expect(await screen.findByLabelText('Comment (optional)')).toHaveAttribute('maxlength', '500');
  });
});
