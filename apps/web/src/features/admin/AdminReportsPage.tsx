import { AdminLayout } from './AdminLayout';
import { ReportsSummary } from './AdminDashboardPage';

/** `/admin/reports` (FEAT-041): demand by society and payment totals. */
export function AdminReportsPage() {
  return (
    <AdminLayout title="Reports" subtitle="Demand by society, and money collected and outstanding">
      <ReportsSummary />
    </AdminLayout>
  );
}
