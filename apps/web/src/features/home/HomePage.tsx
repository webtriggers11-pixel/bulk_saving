import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
  });

  function handleLogout() {
    logout();
    queryClient.clear();
    navigate('/onboard', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-50 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Bulk Saving</h1>
        <Button variant="ghost" onClick={handleLogout}>
          Log out
        </Button>
      </header>

      {isLoading && <p className="text-slate-500">Loading your profile…</p>}
      {isError && (
        <p role="alert" className="text-red-600">
          We couldn't load your profile. Please try again.
        </p>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardDescription>Signed in as</CardDescription>
              <CardTitle>{data.resident.name ?? 'Resident'}</CardTitle>
            </CardHeader>
            <p className="text-sm text-slate-600" data-testid="resident-phone">
              {data.resident.phone}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Your society</CardDescription>
              <CardTitle data-testid="society-name">{data.society.name}</CardTitle>
            </CardHeader>
            <p className="text-sm text-slate-600" data-testid="society-city">
              {data.society.city}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Explore</CardDescription>
              <CardTitle>Services in your society</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => navigate('/services')}>
                Browse services
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/rounds')}>
                Group buys
              </Button>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
