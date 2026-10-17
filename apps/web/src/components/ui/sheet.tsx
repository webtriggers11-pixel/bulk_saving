import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** The sheet's heading, and its accessible name. */
  title: string;
  /** One line under the title, when the sheet needs to say what it is for. */
  description?: string;
  children: ReactNode;
  /** Pinned under the scrolling content — the sheet's one action. */
  footer?: ReactNode;
}

/** How far down (px) or how fast (px/ms) a drag must go to dismiss. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.55;
/** The exit animation's length — `sheet-out` in theme.css. */
const EXIT_MS = 240;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

/**
 * The sheet (FEAT-016, ADR-0028): the native "do one thing" surface. A bottom sheet on a
 * phone — grabber, drag down to dismiss — and a centred panel on a wide screen.
 *
 * A modal dialog in full: `role="dialog"` + `aria-modal`, named by its title; focus moves
 * in on open, is trapped while open, and returns to whatever opened it on close; Escape
 * and the backdrop close it; the page behind cannot scroll. The drag is on the grabber and
 * header only, so the content still scrolls normally.
 *
 * Motion (`sheet-in`, `sheet-out`, `backdrop-in/out`) lives in theme.css, so reduced motion
 * collapses it with everything else; the exit then unmounts at once.
 */
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const drag = useRef<{ startY: number; startT: number; dy: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount on open; on close, play the exit, then unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      setDragY(0);
      return;
    }
    if (!mounted) return;
    if (reducedMotion()) {
      setMounted(false);
      return;
    }
    setLeaving(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  // Focus in on open, back out on close; lock the page behind. Keyed on `mounted` too:
  // the panel first exists one render AFTER `open` flips, and focusing before then
  // focused nothing.
  useEffect(() => {
    if (!open || !mounted) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      returnTo.current?.focus?.();
    };
  }, [open, mounted]);

  if (!mounted) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return; // the close button is a button, not a handle
    drag.current = { startY: event.clientY, startT: Date.now(), dy: 0 };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    // Down only; upward drag gives a little resistance and springs back.
    const dy = event.clientY - drag.current.startY;
    drag.current.dy = dy;
    setDragY(dy > 0 ? dy : dy / 6);
  }

  function onPointerUp() {
    if (!drag.current) return;
    const { dy, startT } = drag.current;
    const velocity = dy / Math.max(1, Date.now() - startT);
    drag.current = null;
    setDragging(false);
    if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      onCloseRef.current();
    } else {
      setDragY(0);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" onKeyDown={onKeyDown}>
      <div
        aria-hidden="true"
        data-testid="sheet-backdrop"
        className={leaving ? 'sheet-backdrop backdrop-out absolute inset-0' : 'sheet-backdrop backdrop-in absolute inset-0'}
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        // `sheet-in` stays on for the sheet's life: its fill-mode is `backwards`, so once
        // it has played it holds nothing, and the drag's inline transform is free to move
        // the panel. `sheet-settle` springs it home when a drag is let go short.
        className={`surface-sheet relative flex max-h-[88dvh] w-full flex-col rounded-t-sheet focus:outline-none md:max-w-lg md:rounded-sheet ${
          leaving ? 'sheet-out' : 'sheet-in'
        }${dragging ? '' : ' sheet-settle'}`}
        // The drag offset is position, not animation: it follows the finger 1:1.
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          data-testid="sheet-handle"
          className="touch-none cursor-grab select-none px-6 pt-2.5 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span aria-hidden="true" className="mx-auto block h-[5px] w-10 rounded-full bg-line/20 md:hidden" />
          <div className="mt-3 flex items-start justify-between gap-3 md:mt-1">
            <div className="min-w-0">
              <h2 id={titleId} className="text-title font-extrabold tracking-[-0.02em] text-ink">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-caption text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label={`Close ${title.toLowerCase()}`}
              onClick={() => onCloseRef.current()}
              className="press -mr-2 -mt-1 flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-ink-muted t hover:bg-line/10 hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
            >
              <Icon name="close" size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <div className="overscroll-contain overflow-y-auto px-6 pb-6 pt-4">{children}</div>
        {footer && <div className="border-t border-line/10 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">{footer}</div>}
        {!footer && <div aria-hidden="true" className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}
