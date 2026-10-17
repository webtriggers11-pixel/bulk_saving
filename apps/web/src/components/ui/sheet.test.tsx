import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Sheet } from './sheet';

/** FEAT-016 (ADR-0028): the sheet is a modal dialog in full, and it can be swiped away. */

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Sheet
        open={open}
        title="Appearance"
        description="How the app looks on this phone"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={<button>Done</button>}
      >
        <button>First</button>
        <input aria-label="Middle" />
      </Sheet>
    </>
  );
}

function openSheet(onClose = vi.fn()) {
  render(<Harness onClose={onClose} />);
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, onClose, dialog: screen.getByRole('dialog', { name: 'Appearance' }) };
}

// jsdom has no PointerEvent, so Testing Library falls back to a bare Event and clientY
// never arrives. A MouseEvent carries it.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
  }
});

/** Drag the handle from y=100 to `toY`, taking `ms`. */
function dragHandle(toY: number, ms: number) {
  const handle = screen.getByTestId('sheet-handle');
  fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
  vi.advanceTimersByTime(ms);
  fireEvent.pointerMove(handle, { clientY: toY, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: toY, pointerId: 1 });
}

describe('Sheet', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a modal dialog named by its title and described by its line', () => {
    const { dialog } = openSheet();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('How the app looks on this phone');
  });

  it('moves focus in, traps Tab inside, and returns focus to the opener on close', () => {
    vi.useFakeTimers();
    const { opener, dialog } = openSheet();
    const inside = [...dialog.querySelectorAll('button, input')] as HTMLElement[];
    // The close button is first in the panel (header), then content, then the footer.
    expect(document.activeElement).toBe(inside[0]);

    inside[inside.length - 1].focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(inside[0]);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(inside[inside.length - 1]);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape, on the backdrop, and on the close button', () => {
    for (const close of [
      (d: HTMLElement) => fireEvent.keyDown(d, { key: 'Escape' }),
      () => fireEvent.click(screen.getByTestId('sheet-backdrop')),
      () => fireEvent.click(screen.getByRole('button', { name: 'Close appearance' })),
    ]) {
      const onClose = vi.fn();
      const { dialog } = openSheet(onClose);
      close(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
      document.body.innerHTML = '';
    }
  });

  it('locks the page behind it while open', () => {
    vi.useFakeTimers();
    const { dialog } = openSheet();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.body.style.overflow).toBe('');
  });

  it('a long drag down the handle dismisses it; a short slow one springs back', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    openSheet(onClose);

    dragHandle(140, 400); // 40px over 400ms
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').style.transform).toBe('');

    dragHandle(260, 600); // 160px — past the distance threshold
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a short but FAST flick dismisses it too', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    openSheet(onClose);
    dragHandle(160, 50); // 60px in 50ms
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('follows the finger while dragging', () => {
    openSheet();
    const handle = screen.getByTestId('sheet-handle');
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 175, pointerId: 1 });
    expect(screen.getByRole('dialog')).toHaveStyle({ transform: 'translateY(75px)' });
  });

  describe('V2 fixes', () => {
    it('Tab cannot walk out past a roving radio group (tabIndex -1 options are not tabbable)', () => {
      function Radios() {
        const [open, setOpen] = useState(true);
        return (
          <Sheet open={open} onClose={() => setOpen(false)} title="Appearance">
            <div role="radiogroup" aria-label="Colour">
              <button role="radio" aria-checked="true" tabIndex={0}>Lagoon</button>
              <button role="radio" aria-checked="false" tabIndex={-1}>Dusk</button>
              <button role="radio" aria-checked="false" tabIndex={-1}>Ember</button>
            </div>
          </Sheet>
        );
      }
      render(<Radios />);
      const checked = screen.getByRole('radio', { name: 'Lagoon' });
      checked.focus();
      fireEvent.keyDown(checked, { key: 'Tab' });
      // Lagoon is the LAST tabbable item, so Tab wraps to the first (Close) — inside.
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close appearance' }));
    });

    it('Escape still closes when focus has dropped to <body> (a disabled control lost it)', () => {
      const onClose = vi.fn();
      openSheet(onClose);
      (document.activeElement as HTMLElement).blur();
      expect(document.activeElement).toBe(document.body);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('two sheets open and closed out of order leave the page scrollable', () => {
      function Two() {
        const [a, setA] = useState(true);
        const [b, setB] = useState(true);
        return (
          <>
            <button onClick={() => setA(false)}>close A</button>
            <button onClick={() => setB(false)}>close B</button>
            <Sheet open={a} onClose={() => setA(false)} title="A">a</Sheet>
            <Sheet open={b} onClose={() => setB(false)} title="B">b</Sheet>
          </>
        );
      }
      render(<Two />);
      expect(document.body.style.overflow).toBe('hidden');
      fireEvent.click(screen.getByText('close A'));
      expect(document.body.style.overflow).toBe('hidden');
      fireEvent.click(screen.getByText('close B'));
      expect(document.body.style.overflow).toBe('');
    });

    it('a dismissing drag the caller refuses springs home instead of staying half-dragged', () => {
      vi.useFakeTimers();
      render(
        <Sheet open onClose={() => {}} title="Stays">
          <p>content</p>
        </Sheet>,
      );
      dragHandle(300, 500);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByRole('dialog').style.transform).toBe('');
    });

    it('returns focus to `returnFocus` when the opener is gone', () => {
      vi.useFakeTimers();
      function Replaced() {
        const [open, setOpen] = useState(false);
        const [done, setDone] = useState(false);
        return (
          <>
            {done ? <button id="after">Change</button> : <button onClick={() => setOpen(true)}>Rate this job</button>}
            <Sheet
              open={open}
              onClose={() => setOpen(false)}
              returnFocus={() => document.getElementById('after')}
              title="Rate"
            >
              <button
                onClick={() => {
                  setDone(true);
                  setOpen(false);
                }}
              >
                Submit
              </button>
            </Sheet>
          </>
        );
      }
      render(<Replaced />);
      fireEvent.click(screen.getByRole('button', { name: 'Rate this job' }));
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' }));
    });
  });
});
