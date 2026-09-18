import { useState, type FormEvent } from 'react';
import type { VendorDto } from '@bulk/shared';
import { Badge } from '../../components/ui/badge';
import { formatVendorRating } from '../rating/formatRating';
import {
  OFFLINE_QUEUED_TEXT,
  OFFLINE_WAITING_LABEL,
  queryStalled,
} from '../../lib/offline';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
  const field = (key: keyof VendorFormValues, label: string, extra?: { type?: string; inputMode?: 'tel' }) => (
    <div>
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${key}`}
        type={extra?.type ?? 'text'}
        inputMode={extra?.inputMode}
        value={values[key]}
        aria-invalid={errors[key] ? true : undefined}
        onChange={(e) => onChange({ ...values, [key]: e.target.value })}
      />
      {errors[key] && <p className="mt-1 text-sm text-red-600">{errors[key]}</p>}
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label="Add vendor" noValidate>
        <VendorFields idPrefix="new-vendor" values={values} errors={errors} onChange={setValues} />
        <Button type="submit" className="self-start" disabled={create.isPending}>
          {create.isPaused ? OFFLINE_WAITING_LABEL : create.isPending ? 'Adding…' : 'Add vendor'}
        </Button>
        {create.isPaused && (
          <p role="status" data-testid="vendor-create-offline" className="text-sm text-amber-700">
            {OFFLINE_QUEUED_TEXT}
          </p>
        )}
        {create.isError && (
          <p role="alert" className="text-sm text-red-600">
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

  return (
    <li className="flex flex-col gap-3 py-4" data-testid="vendor-row">
      {editing ? (
        <form onSubmit={handleSave} className="flex flex-col gap-3" aria-label={`Edit ${vendor.name}`} noValidate>
          <VendorFields idPrefix={`edit-${vendor.id}`} values={values} errors={errors} onChange={setValues} />
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPaused ? OFFLINE_WAITING_LABEL : update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" disabled={update.isPending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{vendor.name}</span>
              <Badge tone={vendor.active ? 'green' : 'slate'}>{vendor.active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <p className="text-sm text-slate-600">
              {vendor.phone}
              {vendor.category ? ` · ${vendor.category}` : ''}
            </p>
            {/* FEAT-009: the accountability number, with its count (ADR-0017) —
                this is what stops a bad vendor being assigned again. */}
            <p className="text-sm text-slate-600" data-testid="vendor-rating">
              <span className="text-amber-500" aria-hidden="true">
                ★
              </span>{' '}
              {formatVendorRating(vendor)}
            </p>
            {vendor.notes && <p className="text-sm text-slate-500">{vendor.notes}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="border border-slate-300"
              aria-label={`Edit ${vendor.name}`}
              disabled={update.isPending}
              onClick={startEdit}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              className="border border-slate-300"
              aria-label={`${vendor.active ? 'Deactivate' : 'Activate'} ${vendor.name}`}
              disabled={update.isPending}
              onClick={() => update.mutate({ id: vendor.id, body: { active: !vendor.active } })}
            >
              {vendor.active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      )}
      {update.isPaused && (
        <p role="status" data-testid="vendor-update-offline" className="mt-2 text-sm text-amber-700">
          {OFFLINE_QUEUED_TEXT}
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage(update.error)}
        </p>
      )}
    </li>
  );
}

/**
 * Super-admin vendor management (FEAT-005, ADR-0012): the global vendor list with an
 * add form, inline edit and activate/deactivate (vendors are never deleted).
 */
export function AdminVendorsPage() {
  const vendorsQuery = useVendors();
  const { data, isLoading, refetch } = vendorsQuery;
  // BUG-004: offline pauses the read instead of failing it, so `isError` alone would
  // render an empty page with no explanation.
  const failed = queryStalled(vendorsQuery);

  return (
    <AdminLayout title="Vendors">
      <AddVendorForm />

      <Card>
        <CardHeader>
          <CardTitle>All vendors</CardTitle>
          <CardDescription>Only active vendors can be assigned to rounds.</CardDescription>
        </CardHeader>
        {isLoading && <p className="text-slate-500">Loading vendors…</p>}
        {failed && (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-red-600">We couldn't load vendors. Please try again.</p>
            <Button onClick={() => void refetch()}>Retry</Button>
          </div>
        )}
        {data && data.length === 0 && (
          <p className="text-sm text-slate-500" data-testid="vendors-empty">
            No vendors yet. Add one above.
          </p>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {data.map((vendor) => (
              <VendorRow key={vendor.id} vendor={vendor} />
            ))}
          </ul>
        )}
      </Card>
    </AdminLayout>
  );
}
