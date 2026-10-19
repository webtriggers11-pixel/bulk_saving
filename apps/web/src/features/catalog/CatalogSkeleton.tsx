import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';

/** The catalog's own rhythm while `GET /catalog` is in flight: hero, two tiles, a row. */
export function CatalogSkeleton() {
  return (
    <SkeletonScreen
      label="Loading services…"
      testId="catalog-skeleton"
      className="grid grid-cols-2 gap-3.5"
    >
      <div className="surface-glass col-span-2 rounded-card p-[22px]">
        <Skeleton className="h-2.5 w-1/4" />
        <Skeleton className="mt-2.5 h-6 w-3/5" delay={1} />
        <Skeleton className="mt-3 h-3 w-4/5" delay={2} />
        <Skeleton radius="control" className="mt-4 h-11 w-40" delay={3} />
      </div>
      {/* BUG-016: the same geometry as the real tiles — a row below 400px, a 2-up tile above. */}
      {[0, 1].map((tile) => (
        <div
          key={tile}
          className="surface-solid col-span-2 flex items-start gap-3.5 rounded-card p-[18px] min-[400px]:col-span-1 min-[400px]:min-h-[190px] min-[400px]:flex-col min-[400px]:gap-0"
        >
          <Skeleton radius="control" className="h-11 w-11" delay={tile === 0 ? 0 : 1} />
          <div className="w-full min-w-0 flex-1 min-[400px]:mt-3.5">
            <Skeleton className="h-2.5 w-2/5" delay={1} />
            <Skeleton className="mt-2.5 h-4 w-3/4" delay={2} />
            <Skeleton className="mt-3 h-3.5 w-1/2" delay={3} />
          </div>
        </div>
      ))}
      <div className="surface-solid col-span-2 flex items-center gap-3.5 rounded-card p-[18px]">
        <Skeleton radius="control" className="h-11 w-11" />
        <div className="flex-1">
          <Skeleton className="h-2.5 w-1/3" delay={1} />
          <Skeleton className="mt-2.5 h-4 w-3/5" delay={2} />
        </div>
        <Skeleton className="h-4 w-16" delay={3} />
      </div>
    </SkeletonScreen>
  );
}
