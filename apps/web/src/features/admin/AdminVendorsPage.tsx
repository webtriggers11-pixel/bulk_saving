import { useState, type FormEvent } from 'react';
import type { ActiveFilter, VendorDto } from '@bulk/shared';
import { FilterChips } from '../../components/ui/filter-chips';
import { ResultSummary } from '../../components/ui/result-summary';
import { SavedTick } from '../../components/ui/saved-tick';
import { SearchField } from '../../components/ui/search-field';
import { Switch } from '../../components/ui/switch';
import { useDebouncedSearch, useUrlFilters } from '../../lib/filters';
import { formatVendorRating } from '../rating/formatRating';
import { CATEGORY_FILTER_OPTIONS } from '../../lib/categories';
import {
  OFFLINE_QUEUED_TEXT,
  OFFLINE_WAITING_LABEL,
  queryStalled,
} from '../../lib/offline';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { StarGlyph } from '../../components/ui/icon';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { useCreateVendor, useUpdateVendor, useVendors } from './useAdmin';
import {
  EMPTY_VENDOR_FORM,
  toCreateVendorBody,
  toUpdateVendorBody,
  validateVendorForm,
  type VendorFormErrors,
  type VendorFormValues,
} from './vendorForm';

/** The four vendor inputs with labels and inline field errors. `idPrefix` keeps ids unique. */
function VendorFields({
  idPrefix,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  values: VendorFormValues;
  errors: VendorFormErrors;
  onChange: (values: VendorFormValues) => void;
}) {
  // `Field` owns the label/id/aria-describedby wiring and the error line, so the
  // four inputs here are just inputs (ADR-0022). `idPrefix` survives as the test
  // contract for the add form vs an inline edit form.
  const field = (key: keyof VendorFormValues, label: string, extra?: { type?: string; inputMode?: 'tel' }) => (
    <Field label={label} id={`${idPrefix}-${key}`} error={errors[key]}>
      {(props) => (
        <Input
          {...props}
          type={extra?.type ?? 'text'}
          inputMode={extra?.inputMode}
          value={values[key]}
          onChange={(e) => onChange({ ...values, [key]: e.target.value })}
        />
      )}
    </Field>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field('name', 'Name')}
      {field('phone', 'Phone', { type: 'tel', inputMode: 'tel' })}
      {field('category', 'Category (optional)')}
      {field('notes', 'Notes (optional)')}
    </div>
  );
}

/** Add-vendor form: validates client-side, sends trimmed values, resets on success. */
function AddVendorForm() {
  const create = useCreateVendor();
  const [values, setValues] = useState<VendorFormValues>(EMPTY_VENDOR_FORM);
  const [errors, setErrors] = useState<VendorFormErrors>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateVendorForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    create.mutate(toCreateVendorBody(values), {
      onSuccess: () => setValues(EMPTY_VENDOR_FORM),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add vendor</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Add vendor" noValidate>
        <VendorFields idPrefix="new-vendor" values={values} errors={errors} onChange={setValues} />
        <Button type="submit" className="self-start" disabled={create.isPending}>
          {create.isPaused ? OFFLINE_WAITING_LABEL : create.isPending ? 'Adding…' : 'Add vendor'}
        </Button>
        {create.isPaused && (
          <p
            role="status"
            data-testid="vendor-create-offline"
            className="flex items-center gap-2 rounded-chip border border-white/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink"
          >
            <Icon name="offline" size={16} strokeWidth={2} />
            {OFFLINE_QUEUED_TEXT}
          </p>
        )}
        {create.isError && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-chip border border-white/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink"
          >
            <Icon name="alert" size={16} strokeWidth={2} />
            {errorMessage(create.error)}
          </p>
        )}
      </form>
    </Card>
  );
}

/** One vendor: read view with Edit + activate toggle, or an inline edit form. */
function VendorRow({ vendor }: { vendor: VendorDto }) {
  const update = useUpdateVendor();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<VendorFormValues>(EMPTY_VENDOR_FORM);
  const [errors, setErrors] = useState<VendorFormErrors>({});

  function startEdit() {
    setValues({
      name: vendor.name,
      phone: vendor.phone,
      category: vendor.category ?? '',
      notes: vendor.notes ?? '',
    });
    setErrors({});
    update.reset();
    setEditing(true);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const found = validateVendorForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    update.mutate(
      { id: vendor.id, body: toUpdateVendorBody(values) },
      { onSuccess: () => setEditing(false) },
    );
  }

  // Optimistic, as on the services page: the switch moves on tap and reverts if refused.
  const pendingActive = update.isPending ? update.variables?.body.active : undefined;
  const active = pendingActive ?? vendor.active;

  return (
    <li className="row-in">
      <RowSurface data-testid="vendor-row">
      {editing ? (
        <form onSubmit={handleSave} className="flex flex-col gap-4" aria-label={`Edit ${vendor.name}`} noValidate>
          <VendorFields idPrefix={`edit-${vendor.id}`} values={values} errors={errors} onChange={setValues} />
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPaused ? OFFLINE_WAITING_LABEL : update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" disabled={update.isPending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-extrabold tracking-[-0.02em] text-ink">{vendor.name}</span>
              <SavedTick trigger={update.isSuccess ? update.submittedAt : null} />
            </div>
            <p className="num mt-1 text-meta text-ink-muted">
              {vendor.phone}
              {vendor.category ? ` · ${vendor.category}` : ''}
            </p>
            {/* FEAT-009: the accountability number, with its count (ADR-0017) —
                this is what stops a bad vendor being assigned again. */}
            <p
              className="mt-1.5 flex items-center gap-1.5 text-meta font-bold text-ink-muted"
              data-testid="vendor-rating"
            >
              <StarGlyph filled size={15} className="text-star" />
              {formatVendorRating(vendor)}
            </p>
            {vendor.notes && <p className="mt-1.5 text-meta text-ink-soft">{vendor.notes}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={active}
              onChange={(next) => update.mutate({ id: vendor.id, body: { active: next } })}
              label={`${vendor.name} active`}
              text={active ? 'Active' : 'Inactive'}
              disabled={update.isPending}
            />
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Edit ${vendor.name}`}
              disabled={update.isPending}
              onClick={startEdit}
            >
              Edit
            </Button>
          </div>
        </div>
      )}
      {update.isPaused && (
        <p
          role="status"
          data-testid="vendor-update-offline"
          className="flex items-center gap-2 rounded-chip border border-white/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink"
        >
          <Icon name="offline" size={16} strokeWidth={2} />
          {OFFLINE_QUEUED_TEXT}
        </p>
      )}
        {update.isError && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-chip border border-white/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink"
          >
            <Icon name="alert" size={16} strokeWidth={2} />
            {errorMessage(update.error)}
          </p>
        )}
      </RowSurface>
    </li>
  );
}

const VENDOR_FILTER_KEYS = ['q', 'category', 'status'] as const;
const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/**
 * Super-admin vendor management (FEAT-005, ADR-0012): the global vendor list with an
 * add form, inline edit and activate/deactivate (vendors are never deleted).
 */
export function AdminVendorsPage() {
  const { filters, setFilters, clear, activeCount } = useUrlFilters(VENDOR_FILTER_KEYS);
  const [search, setSearch] = useDebouncedSearch(filters.q, (q) => setFilters({ q }));
  const status: ActiveFilter | undefined =
    filters.status === 'active' || filters.status === 'inactive' ? filters.status : undefined;
  const vendorsQuery = useVendors({ q: filters.q, category: filters.category, status });
  const { data, isLoading, isPlaceholderData, refetch } = vendorsQuery;
  // BUG-004: offline pauses the read instead of failing it, so `isError` alone would
  // render an empty page with no explanation.
  const failed = queryStalled(vendorsQuery);

  return (
    <AdminLayout title="Vendors" subtitle="Who does the work, and who may be assigned">
      <AddVendorForm />

      <Card>
        <CardHeader>
          <CardTitle>All vendors</CardTitle>
          <CardDescription>Only active vendors can be assigned to rounds.</CardDescription>
        </CardHeader>
        {/* FEAT-015: filtered on the server, filters in the URL (ADR-0026). */}
        <div className="mb-4 flex flex-col gap-3" role="search" aria-label="Filter vendors">
          <SearchField
            label="Search vendors"
            placeholder="Search by name, phone or notes"
            value={search}
            onChange={setSearch}
            maxLength={80}
          />
          <FilterChips
            label="Trade"
            // Vendor trades are free text, but in practice they are the service categories; a
            // vendor with another trade is still found by search.
            options={CATEGORY_FILTER_OPTIONS}
            value={filters.category ?? ''}
            onChange={(category) => setFilters({ category: category || undefined })}
          />
          <FilterChips
            label="Status"
            options={STATUS_CHIPS}
            value={status ?? ''}
            onChange={(next) => setFilters({ status: next || undefined })}
          />
          <ResultSummary
            count={data?.length}
            noun={['vendor', 'vendors']}
            activeCount={activeCount}
            onClear={clear}
            busy={isPlaceholderData}
          />
        </div>
        {isLoading && (
          <SkeletonScreen label="Loading vendors…" testId="vendors-skeleton" className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="surface-solid rounded-tile p-4">
                <Skeleton className="h-4 w-1/3" delay={(row % 4) as 0 | 1 | 2 | 3} />
                <Skeleton className="mt-2.5 h-3 w-1/2" delay={1} />
                <Skeleton className="mt-2.5 h-3 w-24" delay={2} />
              </div>
            ))}
          </SkeletonScreen>
        )}
        {failed && (
          <div
            role="alert"
            className="animate-rise flex flex-col items-start gap-3 rounded-inset border border-white/55 bg-danger-ink/10 px-4 py-4 text-danger-ink shadow-hairline"
          >
            <p className="flex gap-2.5 text-meta font-bold">
              <Icon name="alert" size={18} strokeWidth={2} />
              We couldn&apos;t load vendors. Please try again.
            </p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              <Icon name="refresh" size={16} strokeWidth={2.1} />
              Retry
            </Button>
          </div>
        )}
        {data && data.length === 0 && activeCount > 0 && (
          <EmptyState
            icon="search"
            title="No vendors match"
            description="Loosen a filter, or clear them all."
            data-testid="vendors-no-match"
            action={
              <Button variant="secondary" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        )}
        {data && data.length === 0 && activeCount === 0 && (
          <EmptyState
            icon="users"
            title="No vendors yet"
            description="Add one above, and it becomes assignable to a round that has met its target."
            data-testid="vendors-empty"
          />
        )}
        {data && data.length > 0 && (
          <div className="results" aria-busy={isPlaceholderData}>
          <DataRows>
            {data.map((vendor) => (
              <VendorRow key={vendor.id} vendor={vendor} />
            ))}
          </DataRows>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
