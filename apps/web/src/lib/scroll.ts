/** Breathing room left beside a chip scrolled into view, so it is not flush to the edge. */
const EDGE = 12;

type Box = Pick<DOMRect, 'left' | 'right'>;

/**
 * Bring `item` into view inside a horizontally scrolling `rail` by moving ONLY the rail.
 *
 * `scrollIntoView({ block: 'nearest' })` was the first version, and it scrolls every
 * scrollable ancestor — including the window — so a chip row below the fold pulled the
 * page down on load (FEAT-015 V2 P1-3). This touches `rail.scrollLeft` and nothing else.
 */
export function scrollIntoRail(
  rail: { scrollLeft: number; getBoundingClientRect(): Box },
  item: { getBoundingClientRect(): Box },
): void {
  const outer = rail.getBoundingClientRect();
  const inner = item.getBoundingClientRect();
  if (inner.left < outer.left) {
    rail.scrollLeft -= outer.left - inner.left + EDGE;
  } else if (inner.right > outer.right) {
    rail.scrollLeft += inner.right - outer.right + EDGE;
  }
}
