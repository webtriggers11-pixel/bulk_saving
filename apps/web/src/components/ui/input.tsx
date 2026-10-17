import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * 50px tall, 16px radius, a white-gradient fill over the ground, and the system's
 * one focus ring (FEAT-011). Error state is driven by `aria-invalid` rather than a
 * prop, so it also lights up when a form library sets it.
 */
/**
 * The type sizes an input can take — a code field is deliberately bigger than a name
 * field. A prop for the same reason as CardTitle's: passed as a className it lost to
 * the base `text-lead` every time, so the invite, phone and OTP fields have all been
 * rendering at 15px (BUG-007).
 */
/**
 * A field's size: type, height and weight together, because they are one decision.
 *
 * Height and weight used to live in the base while three callers passed `h-[60px]`,
 * `h-16` and `font-extrabold` in a className. None of those landed — `.h-control` and
 * `.font-semibold` are emitted after them, so the OTP field asked for 64px/800 and
 * rendered at 50px/600 (V2 round 2, P2-D). This is CardTitle's tracking and Input's own
 * font-size, for the third time: a property split between a base and a caller is a
 * property decided by Tailwind's emission order.
 */
const INPUT_TEXT = {
  default: 'text-lead h-control font-semibold',
  numeric: 'text-[17px] h-control font-semibold',
  lg: 'text-[19px] h-[60px] font-extrabold',
  xl: 'text-[21px] h-[60px] font-extrabold',
  code: 'text-[27px] h-16 font-extrabold',
} as const;

/**
 * How hard the field's edge works.
 *
 * `normal` used to be `border-white/70` — a white border on the white sheet, which is
 * to say no border at all: the fields on the app's front door read as gaps rather than
 * as things you type in. It is now a soft ink hairline, visible on every surface the
 * system has.
 *
 * `primary` is the screen's main field — the one a resident is there to fill. It takes
 * the brand edge and the focus ring at rest, which the OTP field used to hand-roll in a
 * className (and which BUG-007 is the standing reminder not to do).
 */
const INPUT_EMPHASIS = {
  normal: 'border-shade/15 shadow-field',
  primary: 'border-brand/45 shadow-ring',
} as const;

/**
 * Horizontal padding. `icons` leaves room for a leading glyph and a trailing control
 * (SearchField's magnifier and clear button, FEAT-015). A prop, not a caller's `pl-11`:
 * that would fight `px-[15px]` for the same edges, which is BUG-007 exactly.
 */
const INPUT_INSET = {
  default: 'px-[15px]',
  icons: 'pl-11 pr-11',
} as const;

/**
 * Letter-spacing (CHORE-012). The two fields whose design IS their spacing — the invite
 * code and the OTP — passed `tracking-*` in a className against the base
 * `tracking-[-0.01em]`, and won only because Tailwind emitted them later.
 */
const INPUT_TRACKING = {
  default: 'tracking-[-0.01em]',
  invite: 'tracking-[0.26em]',
  code: 'tracking-[0.38em]',
} as const;

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  textSize?: keyof typeof INPUT_TEXT;
  emphasis?: keyof typeof INPUT_EMPHASIS;
  inset?: keyof typeof INPUT_INSET;
  tracking?: keyof typeof INPUT_TRACKING;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { textSize = 'default', emphasis = 'normal', inset = 'default', tracking = 'default', className, ...props },
    ref,
  ) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex w-full rounded-control border bg-transparent paint-glass',
          // Height, weight and the shadow all belong to a prop rather than to the base:
          // each was a property the base set AND a caller tried to override, which is a
          // property neither of them actually decides (V2 P2-7, P2-D).
          INPUT_INSET[inset],
          INPUT_TRACKING[tracking],
          'text-ink t',
          INPUT_TEXT[textSize],
          INPUT_EMPHASIS[emphasis],
          'placeholder:font-medium placeholder:text-ink-soft',
          'focus-visible:outline-none focus:outline-none focus:border-brand/60 focus:shadow-ring',
          'aria-[invalid=true]:border-danger-ink/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
