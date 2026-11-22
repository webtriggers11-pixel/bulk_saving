import { useState } from 'react';
import { Role, type AdminResidentDto } from '@bulk/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmSheet } from '../../components/ui/confirm-sheet';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { FilterChips } from '../../components/ui/filter-chips';
import { Input } from '../../components/ui/input';
import { Notice } from '../../components/ui/notice';
import { ResultSummary } from '../../components/ui/result-summary';
import { SearchField } from '../../components/ui/search-field';
import { Select } from '../../components/ui/select';
import { Sheet } from '../../components/ui/sheet';
import { ShowMore } from '../../components/ui/show-more';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { useDebouncedSearch, useUrlFilters } from '../../lib/filters';
import { useAuthStore } from '../auth/auth.store';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { useAdminSocieties, useAdminUsers, useRemoveUser, useUpdateUser } from './useAdmin';

const FILTER_KEYS = ['q', 'society', 'role'] as const;
const isRole = (value: string): boolean => value === Role.RESIDENT || value === Role.SUPER_ADMIN;
const VALIDATORS = { role: isRole };
const ROLE_CHIPS = [
  { value: '', label: 'Everyone' },
  { value: Role.RESIDENT, label: 'Residents' },
  { value: Role.SUPER_ADMIN, label: 'Admins' },
];
const ROLE_LABEL: Record<Role, string> = { RESIDENT: 'Resident', SUPER_ADMIN: 'Admin' };

/** Edit one user's name and access (ADR-0044); remove sits behind its own confirm. */
function EditUserSheet({ user, isSelf, onClose }: { user: AdminResidentDto; isSelf: boolean; onClose: () => void }) {
  const update = useUpdateUser();
  const remove = useRemoveUser();
  const [name, setName] = useState(user.name ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const trimmed = name.trim();
  const dirty = trimmed !== (user.name ?? '') || role !== user.role;

  function save() {
    update.mutate(
      { id: user.id, body: { ...(trimmed !== (user.name ?? '') ? { name: trimmed || null } : {}), ...(role !== user.role ? { role } : {}) } },
      { onSuccess: onClose },
    );
  }

  return (
    <>
      <Sheet
        open={!confirmRemove}
        onClose={onClose}
        title={user.name ?? user.phone}
        description={`${user.phone} · ${user.society.name}`}
        footer={
          <div className="flex flex-col gap-2.5">
            {update.isError && <Notice tone="error">{errorMessage(update.error)}</Notice>}
            <Button className="w-full" disabled={!dirty || update.isPending} onClick={save} data-testid="save-user">
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={isSelf}
              onClick={() => setConfirmRemove(true)}
              data-testid="remove-user"
            >
              {isSelf ? "You can't remove yourself" : 'Remove this user'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name" id="edit-user-name">
            {(props) => <Input {...props} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
          </Field>
          {/* V2 P3: for yourself there is no control at all, so nothing focusable pretends to be one. */}
          {isSelf ? (
            <p className="text-meta font-bold text-ink" data-testid="self-access">
              Access: {ROLE_LABEL[user.role]}
            </p>
          ) : (
            <FilterChips
              label="Access"
              options={[
                { value: Role.RESIDENT, label: 'Resident' },
                { value: Role.SUPER_ADMIN, label: 'Admin (full access)' },
              ]}
              value={role}
              onChange={(next) => {
                if (isRole(next)) setRole(next as Role);
              }}
            />
          )}
          <p className="text-meta text-ink-muted" data-testid="access-note">
            {isSelf
              ? "You can't change your own access. Ask another admin."
              : 'Admins can manage every society, user, round, service and vendor. A change takes effect the next time their session refreshes (within minutes).'}
          </p>
          <p className="text-meta text-ink-muted">
            {user.pledgeCount > 0
              ? `${user.pledgeCount} pledge(s) in group buys.`
              : 'No pledges in group buys.'}
          </p>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove ${user.name ?? user.phone}?`}
        consequence="They are signed out everywhere and their account is deleted. They can join again with the invite code."
        confirmLabel="Yes, remove"
        pendingLabel="Removing…"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() => remove.mutate(user.id, { onSuccess: onClose })}
        data-testid="remove-confirm"
      />
    </>
  );
}

function UserRow({ user, onOpen, isSelf }: { user: AdminResidentDto; onOpen: () => void; isSelf: boolean }) {
  return (
    <RowSurface data-testid="user-row">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lead font-extrabold text-ink">
            {user.name ?? 'No name yet'}
            {isSelf ? ' (you)' : ''}
          </span>
          <span className="num text-meta text-ink-muted">
            {user.phone} · {user.society.name}
          </span>
        </span>
        <Badge tone={user.role === Role.SUPER_ADMIN ? 'teal' : 'slate'} data-testid="user-role">
          {ROLE_LABEL[user.role]}
        </Badge>
      </button>
    </RowSurface>
  );
}

/** `/admin/users` (FEAT-033): every user in every society; their name and access. */
export function AdminUsersPage() {
  const { filters, setFilters, clear, activeCount, generation } = useUrlFilters(FILTER_KEYS, VALIDATORS);
  const [search, setSearch] = useDebouncedSearch(filters.q, (q) => setFilters({ q }), generation);
  const role = filters.role && isRole(filters.role) ? (filters.role as Role) : undefined;
  const users = useAdminUsers({ q: filters.q, societyId: filters.society, role });
  const societies = useAdminSocieties();
  const me = useAuthStore((state) => state.resident?.id);
  const [editing, setEditing] = useState<AdminResidentDto | null>(null);
  const { data, isLoading, isPlaceholderData } = users;

  return (
    <AdminLayout title="Users" subtitle="Everyone in every society, and who has admin access">
      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>Tap a user to rename them, give or remove admin access, or remove them.</CardDescription>
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
                <UserRow key={user.id} user={user} isSelf={user.id === me} onOpen={() => setEditing(user)} />
              ))}
            </DataRows>
            <ShowMore hasMore={users.hasMore} loaded={data.length} total={users.total} busy={users.loadingMore} onMore={users.loadMore} noun={['user', 'users']} />
          </div>
        )}
      </Card>
      {editing && <EditUserSheet key={editing.id} user={editing} isSelf={editing.id === me} onClose={() => setEditing(null)} />}
    </AdminLayout>
  );
}
