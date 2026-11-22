import { Link } from 'react-router-dom';
import { Role, type AdminResidentDto } from '@bulk/shared';
import { Badge } from '../../components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { FilterChips } from '../../components/ui/filter-chips';
import { Notice } from '../../components/ui/notice';
import { ResultSummary } from '../../components/ui/result-summary';
import { SearchField } from '../../components/ui/search-field';
import { Select } from '../../components/ui/select';
import { ShowMore } from '../../components/ui/show-more';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { useDebouncedSearch, useUrlFilters } from '../../lib/filters';
import { useAuthStore } from '../auth/auth.store';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { useAdminSocieties, useAdminUsers } from './useAdmin';

const FILTER_KEYS = ['q', 'society', 'role', 'status'] as const;
const isRole = (value: string): boolean => value === Role.RESIDENT || value === Role.SUPER_ADMIN;
const isStatus = (value: string): boolean => value === 'active' || value === 'inactive';
const VALIDATORS = { role: isRole, status: isStatus };
const STATUS_CHIPS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Switched off' },
];
const ROLE_CHIPS = [
  { value: '', label: 'Everyone' },
  { value: Role.RESIDENT, label: 'Residents' },
  { value: Role.SUPER_ADMIN, label: 'Admins' },
];
const ROLE_LABEL: Record<Role, string> = { RESIDENT: 'Resident', SUPER_ADMIN: 'Admin' };

function UserRow({ user, isSelf }: { user: AdminResidentDto; isSelf: boolean }) {
  return (
    <RowSurface data-testid="user-row">
      <Link to={`/admin/users/${user.id}`} className="flex w-full items-center gap-3 no-underline">
        <span className="flex flex-1 flex-col">
          <span className="text-lead font-extrabold text-ink">
            {user.name ?? 'No name yet'}
            {isSelf ? ' (you)' : ''}
          </span>
          <span className="num text-meta text-ink-muted">
            {user.phone} · {user.society.name}
          </span>
        </span>
        {!user.active && (
          <Badge tone="red" data-testid="user-inactive">
            Switched off
          </Badge>
        )}
        <Badge tone={user.role === Role.SUPER_ADMIN ? 'teal' : 'slate'} data-testid="user-role">
          {ROLE_LABEL[user.role]}
        </Badge>
      </Link>
    </RowSurface>
  );
}

/** `/admin/users` (FEAT-033): every user in every society; their name and access. */
export function AdminUsersPage() {
  const { filters, setFilters, clear, activeCount, generation } = useUrlFilters(FILTER_KEYS, VALIDATORS);
  const [search, setSearch] = useDebouncedSearch(filters.q, (q) => setFilters({ q }), generation);
  const role = filters.role && isRole(filters.role) ? (filters.role as Role) : undefined;
  const status = filters.status === 'active' || filters.status === 'inactive' ? filters.status : undefined;
  const users = useAdminUsers({ q: filters.q, societyId: filters.society, role, status });
  const societies = useAdminSocieties();
  const me = useAuthStore((state) => state.resident?.id);
  const { data, isLoading, isPlaceholderData } = users;

  return (
    <AdminLayout title="Users" subtitle="Everyone in every society, and who has admin access">
      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>Open a user to see their details and group buys, change their access, switch them off or remove them.</CardDescription>
        </CardHeader>
        <div className="mb-4 flex flex-col gap-3" role="search" aria-label="Filter users">
          <SearchField label="Search users" placeholder="Search by name or phone" value={search} onChange={setSearch} maxLength={80} />
          <Field label="Society" id="users-society">
            {(props) => (
              <Select {...props} value={filters.society ?? ''} onChange={(e) => setFilters({ society: e.target.value || undefined })}>
                <option value="">All societies</option>
                {(societies.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <FilterChips label="Access" options={ROLE_CHIPS} value={role ?? ''} onChange={(next) => setFilters({ role: next || undefined })} />
          <FilterChips label="Status" options={STATUS_CHIPS} value={status ?? ''} onChange={(next) => setFilters({ status: next || undefined })} />
          <ResultSummary count={users.total} noun={['user', 'users']} activeCount={activeCount} onClear={clear} busy={isPlaceholderData} />
        </div>
        {isLoading && (
          <SkeletonScreen label="Loading users…" className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-14" radius="tile" delay={(row % 4) as 0 | 1 | 2 | 3} />
            ))}
          </SkeletonScreen>
        )}
        {(users.isError || users.isPaused) && <Notice tone="error">{errorMessage(users.error, "Couldn't load users.")}</Notice>}
        {data && data.length === 0 && (
          <EmptyState
            icon={activeCount > 0 ? 'search' : 'users'}
            title={activeCount > 0 ? 'No users match' : 'No users yet'}
            description={activeCount > 0 ? 'Loosen a filter, or clear them all.' : 'Share a society invite to get the first residents.'}
          />
        )}
        {data && data.length > 0 && (
          <div className="results" aria-busy={isPlaceholderData}>
            <DataRows>
              {data.map((user) => (
                <UserRow key={user.id} user={user} isSelf={user.id === me} />
              ))}
            </DataRows>
            <ShowMore hasMore={users.hasMore} loaded={data.length} total={users.total} busy={users.loadingMore} onMore={users.loadMore} noun={['user', 'users']} />
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
