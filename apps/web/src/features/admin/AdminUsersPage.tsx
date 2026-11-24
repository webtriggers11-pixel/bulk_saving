import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Role, type AdminResidentDto } from '@bulk/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { FilterChips } from '../../components/ui/filter-chips';
import { Input } from '../../components/ui/input';
import { Notice } from '../../components/ui/notice';
import { indianPhone, PhoneField } from '../../components/ui/phone-field';
import { ResultSummary } from '../../components/ui/result-summary';
import { SearchField } from '../../components/ui/search-field';
import { ShowMore } from '../../components/ui/show-more';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { useDebouncedSearch, useUrlFilters } from '../../lib/filters';
import { useAuthStore } from '../auth/auth.store';
import { AdminLayout } from './AdminLayout';
import { SocietySelect } from './SocietySelect';
import { errorMessage, societyLabel } from './adminFormat';
import { useAdminUsers, useCreateAdmin } from './useAdmin';

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
            {user.phone} · {societyLabel(user.society)}
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

/**
 * "Add admin" (FEAT-036, ADR-0046): a platform admin belongs to no society. They sign in at
 * /admin/login with this number. A resident is made an admin from their own page instead.
 */
function AddAdminForm() {
  const create = useCreateAdmin();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const canonical = indianPhone(phone);
  const implausible = phone.length > 0 && canonical === null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canonical === null) return;
    const trimmed = name.trim();
    create.mutate(
      { phone: canonical, ...(trimmed ? { name: trimmed } : {}) },
      { onSuccess: (admin) => navigate(`/admin/users/${admin.id}`) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an admin</CardTitle>
        <CardDescription>
          Admins don&apos;t belong to a society. They sign in at the admin page with this number. To make an existing resident an admin, open them below instead.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Add an admin" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" id="new-admin-phone" error={implausible ? 'Enter a 10-digit mobile number.' : undefined}>
            {(props) => <PhoneField {...props} name="phone" placeholder="98765 43210" value={phone} onValueChange={setPhone} />}
          </Field>
          <Field label="Name (optional)" id="new-admin-name">
            {(props) => <Input {...props} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
          </Field>
        </div>
        <Button type="submit" className="self-start" disabled={canonical === null || create.isPending} data-testid="add-admin">
          {create.isPending ? 'Adding…' : 'Add admin'}
        </Button>
        {create.isError && <Notice tone="error">{errorMessage(create.error)}</Notice>}
      </form>
    </Card>
  );
}

/** `/admin/users` (FEAT-033): every user in every society; their name and access. */
export function AdminUsersPage() {
  const { filters, setFilters, clear, activeCount, generation } = useUrlFilters(FILTER_KEYS, VALIDATORS);
  const [search, setSearch] = useDebouncedSearch(filters.q, (q) => setFilters({ q }), generation);
  const role = filters.role && isRole(filters.role) ? (filters.role as Role) : undefined;
  const status = filters.status === 'active' || filters.status === 'inactive' ? filters.status : undefined;
  const users = useAdminUsers({ q: filters.q, societyId: filters.society, role, status });
  const me = useAuthStore((state) => state.resident?.id);
  const { data, isLoading, isPlaceholderData } = users;

  return (
    <AdminLayout title="Users" subtitle="Everyone in every society, and who has admin access">
      <div className="flex flex-col gap-6">
        <AddAdminForm />
        <Card>
          <CardHeader>
            <CardTitle>All users</CardTitle>
            <CardDescription>Open a user to see their details and group buys, change their access, switch them off or remove them.</CardDescription>
          </CardHeader>
          <div className="mb-4 flex flex-col gap-3" role="search" aria-label="Filter users">
            <SearchField label="Search users" placeholder="Search by name or phone" value={search} onChange={setSearch} maxLength={80} />
            <Field label="Society" id="users-society">
              {(props) => (
                <SocietySelect {...props} value={filters.society ?? ''} onChange={(id) => setFilters({ society: id || undefined })} emptyLabel="All societies" />
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
      </div>
    </AdminLayout>
  );
}
