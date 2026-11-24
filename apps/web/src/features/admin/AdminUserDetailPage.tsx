import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Role, type AdminResidentDetailDto } from '@bulk/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmSheet } from '../../components/ui/confirm-sheet';
import { DataCell, DataRow, DataRows } from '../../components/ui/data-rows';
import { Field } from '../../components/ui/field';
import { FilterChips } from '../../components/ui/filter-chips';
import { Input } from '../../components/ui/input';
import { Notice } from '../../components/ui/notice';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { useAuthStore } from '../auth/auth.store';
import { AdminLayout } from './AdminLayout';
import { PLATFORM_ADMIN_LABEL, errorMessage, formatDateTime, societyLabel } from './adminFormat';
import { StatusBadge } from './StatusBadge';
import { useAdminUser, useRemoveUser, useUpdateUser, useUserPledges } from './useAdmin';
import { ShowMore } from '../../components/ui/show-more';

const ROLE_LABEL: Record<Role, string> = { RESIDENT: 'Resident', SUPER_ADMIN: 'Admin' };

function ProfileCard({ user }: { user: AdminResidentDetailDto }) {
  return (
    <Card data-testid="user-profile">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-eyebrow uppercase text-ink-muted">Phone</dt>
          <dd className="num text-body font-bold text-ink">{user.phone}</dd>
        </div>
        <div>
          <dt className="text-eyebrow uppercase text-ink-muted">Society</dt>
          <dd className="text-body font-bold">
            {user.society ? (
              <Link to={`/admin/societies/${user.society.id}`} className="text-brand-ink underline" data-testid="user-society-link">
                {user.society.name}
              </Link>
            ) : (
              <span className="text-ink" data-testid="user-platform-admin">
                {PLATFORM_ADMIN_LABEL}. Not part of any society
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-eyebrow uppercase text-ink-muted">Joined</dt>
          <dd className="text-body text-ink">{formatDateTime(user.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-eyebrow uppercase text-ink-muted">Phone verified</dt>
          <dd className="text-body text-ink">{user.verifiedAt ? formatDateTime(user.verifiedAt) : 'Not yet'}</dd>
        </div>
      </dl>
    </Card>
  );
}

/** Name and access. For yourself, access is text: nothing focusable pretends to be a control. */
function AccessCard({ user, isSelf }: { user: AdminResidentDetailDto; isSelf: boolean }) {
  const update = useUpdateUser();
  const [name, setName] = useState(user.name ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const trimmed = name.trim();
  const dirty = trimmed !== (user.name ?? '') || role !== user.role;
  function save() {
    update.mutate({
      id: user.id,
      body: { ...(trimmed !== (user.name ?? '') ? { name: trimmed || null } : {}), ...(role !== user.role ? { role } : {}) },
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Name and access</CardTitle>
        <CardDescription>Admins can manage every society, user, round, service and vendor.</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-4">
        <Field label="Name" id="user-name">
          {(props) => <Input {...props} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
        </Field>
        {isSelf ? (
          <p className="text-meta text-ink-muted" data-testid="self-access">
            Access: <span className="font-bold text-ink">{ROLE_LABEL[user.role]}</span>. You can&apos;t change your own access. Ask another admin.
          </p>
        ) : user.society === null ? (
          // FEAT-036 (ADR-0046 §3): a resident needs a society, so a platform admin stays an admin.
          <p className="text-meta text-ink-muted" data-testid="platform-access">
            Access: <span className="font-bold text-ink">Admin</span>. A platform admin has no society, so they can&apos;t become a resident. Switch them off or remove them instead.
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
              if (next === Role.RESIDENT || next === Role.SUPER_ADMIN) setRole(next);
            }}
          />
        )}
        <div className="flex items-center gap-3">
          <Button variant="secondary" disabled={!dirty || update.isPending} onClick={save} data-testid="save-user">
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          {update.isSuccess && !dirty && (
            <span role="status" className="text-meta font-bold text-brand-ink">
              Saved
            </span>
          )}
        </div>
        {update.isError && <Notice tone="error">{errorMessage(update.error)}</Notice>}
      </div>
    </Card>
  );
}

/** Active/inactive and removal (ADR-0045, ADR-0044 §5). */
function StatusCard({ user, isSelf }: { user: AdminResidentDetailDto; isSelf: boolean }) {
  const navigate = useNavigate();
  const update = useUpdateUser();
  const remove = useRemoveUser();
  const [asking, setAsking] = useState<'off' | 'remove' | null>(null);
  const history = user.pledgeCount;

  function setActive(next: boolean) {
    if (!next) {
      setAsking('off');
      return;
    }
    update.mutate({ id: user.id, body: { active: true } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Switch
            checked={user.active}
            onChange={setActive}
            label="Account active"
            text={user.active ? 'Active: can sign in' : 'Switched off: cannot sign in'}
            disabled={isSelf}
            busy={update.isPending}
          />
          <p className="text-meta text-ink-muted">
            {isSelf ? "You can't switch yourself off." : 'Switching off signs them out everywhere and stops them signing in. Their history stays.'}
          </p>
          {update.isError && <Notice tone="error">{errorMessage(update.error)}</Notice>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="danger"
            className="self-start"
            disabled={isSelf || history > 0}
            onClick={() => setAsking('remove')}
            data-testid="remove-user"
          >
            Remove user
          </Button>
          <p className="text-meta text-ink-muted" data-testid="remove-reason">
            {isSelf
              ? "You can't remove yourself."
              : history > 0
                ? `They have ${history} pledge(s) in group buys, so removing would erase that history. Switch them off instead.`
                : user.society === null
                  ? 'This platform admin can be removed. You can add them back from Users.'
                  : 'No group-buy history, so they can be removed. They can join again with the invite code.'}
          </p>
        </div>
      </div>
      <ConfirmSheet
        open={asking === 'off'}
        onClose={() => setAsking(null)}
        title={`Switch off ${user.name ?? user.phone}?`}
        consequence="They are signed out everywhere and can't sign in until you switch them back on."
        confirmLabel="Yes, switch off"
        pendingLabel="Switching off…"
        busy={update.isPending}
        error={update.isError ? errorMessage(update.error) : null}
        onConfirm={() => update.mutate({ id: user.id, body: { active: false } }, { onSuccess: () => setAsking(null) })}
        data-testid="deactivate-confirm"
      />
      <ConfirmSheet
        open={asking === 'remove'}
        onClose={() => setAsking(null)}
        title={`Remove ${user.name ?? user.phone}?`}
        consequence="They are signed out everywhere and their account is deleted."
        confirmLabel="Yes, remove"
        pendingLabel="Removing…"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() => remove.mutate(user.id, { onSuccess: () => navigate('/admin/users', { replace: true }) })}
        data-testid="remove-confirm"
      />
    </Card>
  );
}

function PledgesCard({ user }: { user: AdminResidentDetailDto }) {
  // FEAT-044: paged, newest first.
  const pledges = useUserPledges(user.id);
  const list = pledges.data ?? [];
  return (
    <Card data-testid="user-pledges">
      <CardHeader>
        <CardTitle>Group buys</CardTitle>
        <CardDescription>Every round they pledged to, newest first.</CardDescription>
      </CardHeader>
      {pledges.isLoading ? (
        <Skeleton className="h-16" radius="tile" />
      ) : pledges.isError ? (
        <p role="alert" className="text-meta font-bold text-danger-ink">{errorMessage(pledges.error, "Couldn't load their group buys.")}</p>
      ) : list.length === 0 ? (
        <p className="text-meta text-ink-muted">No pledges yet.</p>
      ) : (
        <DataRows>
          {list.map((p) => (
            <DataRow
              key={p.roundId}
              title={<Link to={`/admin/rounds/${p.roundId}`}>{p.serviceName}</Link>}
              trailing={<StatusBadge status={p.status} />}
              columns={
                <>
                  <DataCell label="Units" value={String(p.units)} />
                  <DataCell label="Paid" value={p.paid ? 'Yes' : 'No'} />
                  <DataCell label="Closes" value={formatDateTime(p.deadline)} />
                </>
              }
            />
          ))}
        </DataRows>
      )}
      <ShowMore hasMore={pledges.hasMore} loaded={list.length} total={pledges.total} busy={pledges.loadingMore} onMore={pledges.loadMore} noun={['group buy', 'group buys']} />
    </Card>
  );
}

/** `/admin/users/:id` (FEAT-035): everything about one user, and every action on them. */
export function AdminUserDetailPage() {
  const { id = '' } = useParams();
  const user = useAdminUser(id);
  const me = useAuthStore((state) => state.resident?.id);

  if (user.isPending) {
    return (
      <AdminLayout title="User">
        <SkeletonScreen label="Loading user…" className="flex flex-col gap-3">
          <Skeleton className="h-36" radius="card" />
          <Skeleton className="h-48" radius="card" />
        </SkeletonScreen>
      </AdminLayout>
    );
  }
  if (user.isError) {
    return (
      <AdminLayout title="User">
        <div className="flex flex-col gap-3">
          <Notice tone="error">{errorMessage(user.error, "Couldn't load this user.")}</Notice>
          <Link to="/admin/users" className="text-meta font-bold text-brand-ink underline">
            Back to users
          </Link>
        </div>
      </AdminLayout>
    );
  }
  const data = user.data;
  const isSelf = data.id === me;
  return (
    <AdminLayout
      title={data.name ?? 'No name yet'}
      subtitle={`${data.phone} · ${societyLabel(data.society)}`}
      action={
        <span className="flex gap-2">
          <Badge tone={data.role === Role.SUPER_ADMIN ? 'teal' : 'slate'} data-testid="user-role">
            {ROLE_LABEL[data.role]}
          </Badge>
          {!data.active && (
            <Badge tone="red" data-testid="user-inactive">
              Switched off
            </Badge>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        <ProfileCard user={data} />
        <AccessCard key={`${data.name}|${data.role}`} user={data} isSelf={isSelf} />
        <StatusCard user={data} isSelf={isSelf} />
        <PledgesCard user={data} />
      </div>
    </AdminLayout>
  );
}
