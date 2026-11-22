import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AdminSocietyDetailDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Notice } from '../../components/ui/notice';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { spacedCode } from './invitation';
import { useAdminSocieties, useCreateSociety } from './useAdmin';

export interface SocietyFormValues {
  name: string;
  city: string;
}
export type SocietyFormErrors = Partial<Record<keyof SocietyFormValues, string>>;

/** The same limits the API enforces (2–80 / 2–60, trimmed), so the form says so first. */
export function validateSocietyForm(values: SocietyFormValues): SocietyFormErrors {
  const errors: SocietyFormErrors = {};
  const name = values.name.trim();
  const city = values.city.trim();
  if (name.length < 2) errors.name = 'Enter the society name.';
  else if (name.length > 80) errors.name = 'Keep the name under 80 characters.';
  if (city.length < 2) errors.city = 'Enter the city.';
  else if (city.length > 60) errors.city = 'Keep the city under 60 characters.';
  return errors;
}

/** Name + city inputs, shared by "New society" here and "Edit details" on the society page. */
export function SocietyFields({
  idPrefix,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  values: SocietyFormValues;
  errors: SocietyFormErrors;
  onChange: (values: SocietyFormValues) => void;
}) {
  const field = (key: keyof SocietyFormValues, label: string) => (
    <Field label={label} id={`${idPrefix}-${key}`} error={errors[key]}>
      {(props) => <Input {...props} value={values[key]} onChange={(e) => onChange({ ...values, [key]: e.target.value })} />}
    </Field>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field('name', 'Society name')}
      {field('city', 'City')}
    </div>
  );
}

const EMPTY: SocietyFormValues = { name: '', city: '' };

/** "New society": the server generates the invite code; we go straight to its page to share it. */
function AddSocietyForm() {
  const create = useCreateSociety();
  const navigate = useNavigate();
  const [values, setValues] = useState<SocietyFormValues>(EMPTY);
  const [errors, setErrors] = useState<SocietyFormErrors>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateSocietyForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate(
      { name: values.name.trim(), city: values.city.trim() },
      { onSuccess: (society) => navigate(`/admin/societies/${society.id}`) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New society</CardTitle>
        <CardDescription>You get an invite code, a QR poster and a message to send residents.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="New society" noValidate>
        <SocietyFields idPrefix="new-society" values={values} errors={errors} onChange={setValues} />
        <Button type="submit" className="self-start" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create society'}
        </Button>
        {create.isError && <Notice tone="error">{errorMessage(create.error)}</Notice>}
      </form>
    </Card>
  );
}

function SocietyRow({ society }: { society: AdminSocietyDetailDto }) {
  return (
    <RowSurface data-testid="society-row">
      <Link to={`/admin/societies/${society.id}`} className="flex w-full items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-chip bg-brand/10 text-brand-ink">
          <Icon name="building" size={18} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lead font-extrabold text-ink">{society.name}</span>
          <span className="text-meta text-ink-muted">
            {society.city} · {society.residentCount} {society.residentCount === 1 ? 'resident' : 'residents'}
          </span>
        </span>
        {!society.active && (
          <span className="shrink-0 text-meta font-bold text-danger-ink" data-testid="society-inactive">
            Inactive
          </span>
        )}
        <span className="num shrink-0 text-meta font-bold tracking-[0.12em] text-ink" data-testid="society-code">
          {spacedCode(society.inviteCode)}
        </span>
        <Icon name="forward" size={16} strokeWidth={2} />
      </Link>
    </RowSurface>
  );
}

/** `/admin/societies` (FEAT-032): every society, and the form that onboards a new one. */
export function AdminSocietiesPage() {
  const societies = useAdminSocieties();
  return (
    <AdminLayout title="Societies" subtitle="Create a society, then share its invite code or QR poster.">
      <div className="flex flex-col gap-6">
        <AddSocietyForm />
        <section aria-label="All societies" className="flex flex-col gap-3">
          {societies.isPending ? (
            <SkeletonScreen label="Loading societies">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </SkeletonScreen>
          ) : societies.isError ? (
            <Notice tone="error">{errorMessage(societies.error, "Couldn't load societies.")}</Notice>
          ) : societies.data.length === 0 ? (
            <EmptyState icon="building" title="No societies yet" description="Create the first one above." />
          ) : (
            <DataRows>
              {societies.data.map((society) => (
                <SocietyRow key={society.id} society={society} />
              ))}
            </DataRows>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
