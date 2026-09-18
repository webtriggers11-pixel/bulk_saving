import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';

/** The timeline's own shape: a rail dot and a card, twice. */
export function RequestsSkeleton() {
  return (
    <SkeletonScreen label="Loading your requests…" testId="requests-skeleton" className="flex flex-col gap-3">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-stretch gap-3.5">
          <div className="flex w-4 shrink-0 flex-col items-center pt-6">
            <Skeleton className="h-3 w-3" delay={row === 0 ? 0 : 1} />
            <span className="mt-1.5 w-0.5 flex-1 rounded-full bg-shade/10" />
          </div>
          <div className={`${row === 0 ? 'surface-glass' : 'surface-solid'} min-w-0 flex-1 rounded-card p-[19px]`}>
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton radius="full" className="h-6 w-20" delay={1} />
            </div>
            <Skeleton className="mt-2.5 h-3 w-4/5" delay={2} />
            <div className="mt-3.5 flex gap-1.5">
              {[0, 1, 2, 3].map((stop) => (
                <Skeleton key={stop} className="h-[5px] flex-1" delay={1} />
              ))}
            </div>
            <div className="mt-4 flex gap-2.5">
              <Skeleton radius="inset" className="h-14 flex-1" delay={2} />
              <Skeleton radius="inset" className="h-14 flex-1" delay={3} />
            </div>
          </div>
        </div>
      ))}
    </SkeletonScreen>
  );
}
