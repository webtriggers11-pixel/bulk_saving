import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './api/health';
import { useUiStore } from './store/ui.store';

export default function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });
  const count = useUiStore((state) => state.count);
  const increment = useUiStore((state) => state.increment);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Bulk Saving</h1>
        <p className="text-sm text-slate-500">Monorepo scaffold — CHORE-001</p>
      </header>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-2 font-semibold">Backend health</h2>
        {isLoading && <p>Checking backend…</p>}
        {isError && <p className="text-red-600">Backend unreachable</p>}
        {data && (
          <p data-testid="health-status">
            {data.status} — {data.service}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-2 font-semibold">Zustand demo</h2>
        <button
          type="button"
          onClick={increment}
          className="rounded bg-slate-900 px-4 py-2 text-white"
        >
          Count: {count}
        </button>
      </section>
    </main>
  );
}
