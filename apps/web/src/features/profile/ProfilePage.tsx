import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/auth.store';
import { useInstallPrompt } from '../shell/useInstallPrompt';
import { useOnlineStatus } from '../shell/useOnlineStatus';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

/** Human label for a role enum — the resident should not read SUPER_ADMIN. */
const ROLE_LABEL: Record<string, string> = {
  RESIDENT: 'Resident',
  SUPER_ADMIN: 'Super admin',
};

/**
 * Profile tab (FEAT-008 AC4/AC5): who am I, log out, and the device-level
 * concerns of an installable app. Reads the session store, not the network, so
 * it works offline — it is the one page that must never need a request.
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resident = useAuthStore((state) => state.resident);
  const society = useAuthStore((state) => state.society);
  const logout = useAuthStore((state) => state.logout);
  const { canInstall, promptInstall } = useInstallPrompt();
  const online = useOnlineStatus();

  function handleLogout() {
    logout();
    // Clear cached server data too: the next resident on this phone must not
    // see the previous one's rounds (ADR-0015).
    queryClient.clear();
    navigate('/onboard', { replace: true });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>

      <Card>
        <CardHeader>
          <CardDescription>Signed in as</CardDescription>
          <CardTitle data-testid="profile-name">{resident?.name ?? 'Resident'}</CardTitle>
        </CardHeader>
        <dl className="grid gap-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <dt>Phone</dt>
            <dd data-testid="profile-phone">{resident?.phone ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Society</dt>
            <dd data-testid="profile-society">{society?.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Role</dt>
            <dd data-testid="profile-role">{resident ? (ROLE_LABEL[resident.role] ?? resident.role) : '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>This app</CardDescription>
          <CardTitle>Add to your home screen</CardTitle>
        </CardHeader>
        {canInstall ? (
          <Button variant="primary" onClick={() => void promptInstall()}>
            Install app
          </Button>
        ) : (
          <p className="text-sm text-slate-600" data-testid="install-hint">
            On iPhone: tap Share, then "Add to Home Screen". On Android, use your browser's
            "Install app" menu item.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500" data-testid="connection-state">
          {online ? 'Connected' : "Offline — you can still open the app, but rounds won't be current."}
        </p>
      </Card>

      <Button variant="ghost" onClick={handleLogout}>
        Log out
      </Button>
    </main>
  );
}
