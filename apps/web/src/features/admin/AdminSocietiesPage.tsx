import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hasSocietyAddress, INDIAN_STATES, PINCODE_PATTERN, type AdminSocietyDetailDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { indianPhone, PhoneField, toLocalDigits } from '../../components/ui/phone-field';
import { Select } from '../../components/ui/select';
import { Notice } from '../../components/ui/notice';
import { SearchField } from '../../components/ui/search-field';
import { ShowMore } from '../../components/ui/show-more';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { spacedCode } from './invitation';
import { useAdminSocieties, useCreateSociety } from './useAdmin';

export interface SocietyFormValues {
  name: string;
  city: string;
  /** FEAT-043 (ADR-0050): the full address and an optional contact phone. */
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  state: string;
  pincode: string;
  /** The 10 local digits only; the +91 is fixed (FEAT-031). */
  phoneDigits: string;
}
export type SocietyFormErrors = Partial<Record<keyof SocietyFormValues, string>>;

export const EMPTY_SOCIETY_FORM: SocietyFormValues = {
  name: '',
  city: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  state: '',
  pincode: '',
  phoneDigits: '',
};

/** The form's values for an existing society (blank where the old row has nothing). */
export function societyFormValues(s: AdminSocietyDetailDto): SocietyFormValues {
  return {
    name: s.name,
    city: s.city,
    addressLine1: s.addressLine1 ?? '',
    addressLine2: s.addressLine2 ?? '',
    landmark: s.landmark ?? '',
    state: s.state ?? '',
    pincode: s.pincode ?? '',
    phoneDigits: s.contactPhone ? toLocalDigits(s.contactPhone) : '',
  };
}

/** The same limits the API enforces (trimmed), so the form says so first. */
export function validateSocietyForm(values: SocietyFormValues): SocietyFormErrors {
  const errors: SocietyFormErrors = {};
  const name = values.name.trim();
  const city = values.city.trim();
  const line1 = values.addressLine1.trim();
  if (name.length < 2) errors.name = 'Enter the society name.';
  else if (name.length > 80) errors.name = 'Keep the name under 80 characters.';
  if (line1.length < 3) errors.addressLine1 = 'Enter the building and street.';
  else if (line1.length > 120) errors.addressLine1 = 'Keep it under 120 characters.';
  if (values.addressLine2.trim().length > 120) errors.addressLine2 = 'Keep it under 120 characters.';
  if (values.landmark.trim().length > 80) errors.landmark = 'Keep it under 80 characters.';
  if (city.length < 2) errors.city = 'Enter the city.';
  else if (city.length > 60) errors.city = 'Keep the city under 60 characters.';
  if (!(INDIAN_STATES as readonly string[]).includes(values.state)) errors.state = 'Choose the state.';
  if (!PINCODE_PATTERN.test(values.pincode.trim())) errors.pincode = 'Enter the 6-digit PIN code.';
  if (values.phoneDigits !== '' && indianPhone(values.phoneDigits) === null) {
    errors.phoneDigits = 'Enter a 10-digit mobile number, or leave it empty.';
  }
  return errors;
}

/** The request body for create / edit: optional parts blank → null, the phone canonical. */
export function societyBody(values: SocietyFormValues) {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    name: values.name.trim(),
    city: values.city.trim(),
    addressLine1: values.addressLine1.trim(),
    addressLine2: opt(values.addressLine2),
    landmark: opt(values.landmark),
    state: values.state,
    pincode: values.pincode.trim(),
    contactPhone: values.phoneDigits === '' ? null : indianPhone(values.phoneDigits),
  };
}

/** Name, full address and contact phone, shared by "New society" here and "Edit details" on the society page. */
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
  const set = (key: keyof SocietyFormValues, value: string) => onChange({ ...values, [key]: value });
  const text = (key: Exclude<keyof SocietyFormValues, 'state' | 'phoneDigits'>, label: string, opts: { hint?: string; placeholder?: string; className?: string; numeric?: boolean } = {}) => (
    <Field label={label} id={`${idPrefix}-${key}`} error={errors[key]} hint={opts.hint} className={opts.className}>
      {(props) => (
        <Input
          {...props}
          value={values[key]}
          placeholder={opts.placeholder}
          // The society's address, not the admin's own: no browser address suggestions (V2 P3-2).
          autoComplete="off"
          {...(opts.numeric ? { inputMode: 'numeric' as const } : {})}
          onChange={(e) => set(key, opts.numeric ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value)}
        />
      )}
    </Field>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {text('name', 'Society name', { className: 'sm:col-span-2' })}
      {text('addressLine1', 'Building and street', { placeholder: 'Plot 12, Baner Road', className: 'sm:col-span-2' })}
      {text('addressLine2', 'Area / locality', { hint: '(optional)', placeholder: 'Baner' })}
      {text('landmark', 'Landmark', { hint: '(optional)', placeholder: 'Near Balewadi Phata' })}
      {text('city', 'City')}
      <Field label="State" id={`${idPrefix}-state`} error={errors.state}>
        {(props) => (
          <Select {...props} value={values.state} onChange={(e) => set('state', e.target.value)}>
            <option value="">Choose a state</option>
            {INDIAN_STATES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {text('pincode', 'PIN code', { placeholder: '411045', numeric: true })}
      <Field label="Contact phone" id={`${idPrefix}-phoneDigits`} error={errors.phoneDigits} hint="(optional)">
        {(props) => (
          <PhoneField {...props} name="contactPhone" placeholder="98765 43210" value={values.phoneDigits} onValueChange={(d) => set('phoneDigits', d)} />
        )}
      </Field>
    </div>
  );
}

/** "New society": the server generates the invite code; we go straight to its page to share it. */
function AddSocietyForm() {
  const create = useCreateSociety();
  const navigate = useNavigate();
  const [values, setValues] = useState<SocietyFormValues>(EMPTY_SOCIETY_FORM);
  const [errors, setErrors] = useState<SocietyFormErrors>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateSocietyForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate(
      societyBody(values),
      { onSuccess: (society) => navigate(`/admin/societies/${society.id}`) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New society</CardTitle>
        <CardDescription>The full address helps vendors find the gate. You get an invite code, a QR poster and a message to send residents.</CardDescription>
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
            {/* FEAT-043: on the second line, so it never squeezes the name at 390 px (browser pass). */}
            {!hasSocietyAddress(society) && (
              <>
                {' · '}
                <span className="font-bold text-amber-ink" data-testid="society-no-address">
                  No address
                </span>
              </>
            )}
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

/** `/admin/societies` (FEAT-032): every society, searchable and paged (FEAT-044), and the form that onboards a new one. */
export function AdminSocietiesPage() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const societies = useAdminSocieties(q ? { q } : {});
  const list = societies.data;
  return (
    <AdminLayout title="Societies" subtitle="Create a society, then share its invite code or QR poster.">
      <div className="flex flex-col gap-6">
        <AddSocietyForm />
        <section aria-label="All societies" className="flex flex-col gap-3">
          <div role="search" aria-label="Filter societies">
            <SearchField label="Search societies" placeholder="Search by name, city or PIN code" value={text} onChange={setText} maxLength={80} />
          </div>
          {societies.isLoading ? (
            <SkeletonScreen label="Loading societies">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </SkeletonScreen>
          ) : societies.isError || !list ? (
            <Notice tone="error">{errorMessage(societies.error, "Couldn't load societies.")}</Notice>
          ) : list.length === 0 ? (
            q ? (
              <EmptyState icon="search" title="No societies match" description="Try another name, city or PIN code." />
            ) : (
              <EmptyState icon="building" title="No societies yet" description="Create the first one above." />
            )
          ) : (
            <div className="results flex flex-col gap-3" aria-busy={societies.isPlaceholderData}>
              <DataRows>
                {list.map((society) => (
                  <SocietyRow key={society.id} society={society} />
                ))}
              </DataRows>
              <ShowMore hasMore={societies.hasMore} loaded={list.length} total={societies.total} busy={societies.loadingMore} onMore={societies.loadMore} noun={['society', 'societies']} />
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
