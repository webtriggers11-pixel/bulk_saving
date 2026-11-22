import { AdminLayout } from './AdminLayout';
import { RequestsList } from './AdminDashboardPage';

/** `/admin/requests` (FEAT-041): services residents are asking for, newest first or most asked. */
export function AdminRequestsPage() {
  return (
    <AdminLayout title="Requests" subtitle="Services residents are asking for. Open a round and everyone who asked is told.">
      <RequestsList />
    </AdminLayout>
  );
}
