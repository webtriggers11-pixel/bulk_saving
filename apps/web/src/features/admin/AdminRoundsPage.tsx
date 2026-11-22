import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/icon';
import { AdminLayout } from './AdminLayout';
import { RoundsPanel } from './AdminDashboardPage';

/** `/admin/rounds` (FEAT-041): every round across societies, filtered by status, society, category or search. */
export function AdminRoundsPage() {
  return (
    <AdminLayout
      title="Rounds"
      subtitle="Every group buy across societies"
      action={
        <Link to="/admin/rounds/new" className="inline-flex min-h-touch items-center gap-2 rounded-control paint-mono px-4 text-meta font-bold text-on-fill no-underline t press focus-visible:shadow-focus focus-visible:outline-none">
          <Icon name="plus" size={15} strokeWidth={2.2} />
          New round
        </Link>
      }
    >
      <RoundsPanel />
    </AdminLayout>
  );
}
