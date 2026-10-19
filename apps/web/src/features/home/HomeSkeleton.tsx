import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';

/**
 * Home's first paint (FEAT-011 AC4): the bento's own geometry — one wide identity
 * card, one wide accent action, two squares — so nothing moves when `me` lands.
 */
export function HomeSkeleton() {
  return (
    <SkeletonScreen
      label="Loading your profile…"
      testId="home-skeleton"
      className="grid grid-cols-2 gap-3.5"
    >
      <div className="surface-glass col-span-2 flex items-center gap-4 rounded-card p-[22px]">
        <Skeleton radius="inset" className="h-[60px] w-[60px]" />
        <div className="flex-1">
          <Skeleton className="h-2.5 w-2/5" />
          <Skeleton className="mt-2.5 h-5 w-3/4" delay={1} />
          <Skeleton className="mt-3 h-3 w-1/2" delay={2} />
        </div>
      </div>
      <div className="surface-tint col-span-2 flex items-center gap-4 rounded-card p-[22px]">
        <Skeleton radius="inset" className="h-[52px] w-[52px]" delay={1} />
        <div className="flex-1">
          <Skeleton className="h-2.5 w-1/4" />
          <Skeleton className="mt-2.5 h-4 w-3/5" delay={1} />
          <Skeleton radius="chip" className="mt-3.5 h-8 w-32" delay={2} />
        </div>
      </div>
      {[0, 1].map((tile) => (
        <div key={tile} className="surface-solid flex min-h-[168px] flex-col rounded-card p-[18px]">
          <Skeleton radius="control" className="h-11 w-11" delay={tile === 0 ? 0 : 1} />
          <Skeleton className="mt-auto h-2.5 w-3/5" delay={2} />
          <Skeleton className="mt-2.5 h-4 w-4/5" delay={3} />
        </div>
      ))}
    </SkeletonScreen>
  );
}
