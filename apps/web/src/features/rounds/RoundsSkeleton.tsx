import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';

/** The rounds screen's own geometry — hero with a ring, then a compact card. */
export function RoundsSkeleton() {
  return (
    <SkeletonScreen label="Loading rounds…" testId="rounds-skeleton" className="flex flex-col gap-3.5">
      <div className="surface-glass rounded-card p-[22px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton className="h-2.5 w-2/5" />
            <Skeleton className="mt-2.5 h-5 w-1/2" delay={1} />
          </div>
          <Skeleton radius="full" className="h-6 w-24" delay={2} />
        </div>
        <div className="mt-[18px] flex items-center gap-4">
          <div className="flex-1">
            <Skeleton className="h-8 w-3/5" delay={1} />
            <Skeleton className="mt-3 h-3 w-4/5" delay={2} />
          </div>
          <Skeleton radius="full" className="h-[108px] w-[108px]" delay={3} />
        </div>
        <Skeleton radius="inset" className="mt-4 h-11 w-full" delay={1} />
        <div className="mt-[18px] flex items-center gap-2.5">
          <Skeleton radius="inset" className="h-[58px] w-36" delay={2} />
          <Skeleton radius="control" className="ml-auto h-11 w-20" delay={3} />
        </div>
      </div>
      <div className="surface-solid rounded-card p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex-1">
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="mt-2.5 h-4 w-3/5" delay={1} />
            <Skeleton className="mt-3 h-6 w-2/5" delay={2} />
          </div>
          <Skeleton radius="full" className="h-[86px] w-[86px]" delay={3} />
        </div>
        <Skeleton radius="control" className="mt-4 h-11 w-full" delay={1} />
      </div>
    </SkeletonScreen>
  );
}
