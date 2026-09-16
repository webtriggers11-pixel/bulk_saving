/**
 * Join conditional class names into a single className string. A tiny local
 * helper so shadcn/ui-style components need no extra dependency (clsx /
 * tailwind-merge are not installed in this workspace).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
