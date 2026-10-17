import { useRef, useState, type FormEvent } from 'react';
import type { ActiveFilter, AdminServiceDto, AdminServicesQuery, AdminSocietyDto, ServiceOfferingDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/field';
import { Icon } from '../../components/ui/icon';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { FilterChips } from '../../components/ui/filter-chips';
import { ResultSummary } from '../../components/ui/result-summary';
import { SavedTick } from '../../components/ui/saved-tick';
import { SearchField } from '../../components/ui/search-field';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { CATEGORY_FILTER_OPTIONS, isListedCategory } from '../../lib/categories';
import { isActiveFilter, useDebouncedSearch, useUrlFilters } from '../../lib/filters';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, queryStalled } from '../../lib/offline';
import { AdminLayout } from './AdminLayout';
import { errorMessage, formatRupees } from './adminFormat';
import {
  EMPTY_SERVICE_FORM,
  SERVICE_CATEGORY_OPTIONS,
  UNIT_DESCRIPTION_MAX,
  UNIT_LABEL_MAX,
  groupByCategory,
  parseIndicativePrice,
  slugify,
  toCreateServiceBody,
  toServiceFormValues,
  toUpdateServiceBody,
  validateServiceForm,
  type ServiceFormErrors,
  type ServiceFormValues,
} from './serviceForm';
import {
  useAdminServices,
  useAdminSocieties,
  useCreateService,
  useUpdateService,
  useOfferingSavePaused,
  useUpsertOffering,
} from './useAdmin';

/** The amber "queued until you're back online" line every admin mutation shows. */
function OfflineLine({ testId }: { testId: string }) {
  return (
    <p
      role="status"
      data-testid={testId}
      className="flex items-center gap-2 rounded-chip border border-paper/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink"
    >
      <Icon name="offline" size={16} strokeWidth={2} />
      {OFFLINE_QUEUED_TEXT}
    </p>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink"
    >
      <Icon name="alert" size={16} strokeWidth={2} />
      {errorMessage(error)}
    </p>
  );
}

/**
 * The service inputs. Category is a select over the closed list (ADR-0025) — never free
 * text. A legacy category outside the list is shown as its own option so an edit form
 * opens on the truth rather than silently on the first listed one.
 */
function ServiceFields({
  idPrefix,
  values,
  errors,
  onChange,
  onNameChange,
  legacyCategory,
}: {
  idPrefix: string;
  values: ServiceFormValues;
  errors: ServiceFormErrors;
  onChange: (values: ServiceFormValues) => void;
  onNameChange?: (name: string) => void;
  legacyCategory?: string;
}) {
  const text = (key: keyof ServiceFormValues, label: string, hint?: string, maxLength?: number) => (
    <Field label={label} hint={hint} id={`${idPrefix}-${key}`} error={errors[key]}>
      {(props) => (
        <Input
          {...props}
          value={values[key]}
          maxLength={maxLength}
          onChange={(e) =>
            key === 'name' && onNameChange ? onNameChange(e.target.value) : onChange({ ...values, [key]: e.target.value })
          }
        />
      )}
    </Field>
  );
  const showLegacy = legacyCategory !== undefined && !(SERVICE_CATEGORY_OPTIONS as readonly string[]).includes(legacyCategory);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {text('name', 'Name')}
      <Field label="Category" id={`${idPrefix}-category`} error={errors.category}>
        {(props) => (
          <Select {...props} value={values.category} onChange={(e) => onChange({ ...values, category: e.target.value })}>
            <option value="" disabled>
              Choose a category
            </option>
            {SERVICE_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
            {showLegacy && <option value={legacyCategory}>{legacyCategory} (old — pick a new one)</option>}
          </Select>
        )}
      </Field>
      {text('description', 'Description')}
      {text('slug', 'Slug', '(used in links)')}
      {text('unitLabel', 'One unit is a…', '(e.g. tank)', UNIT_LABEL_MAX)}
      {text('unitLabelPlural', 'Plural', '(e.g. tanks)', UNIT_LABEL_MAX)}
      <div className="sm:col-span-2">
        {text('unitDescription', 'What one unit includes', '(optional)', UNIT_DESCRIPTION_MAX)}
      </div>
    </div>
  );
}

/**
 * Add-service form. The slug follows the name until the admin edits it themselves.
 * Closed behind a button by default (FEAT-015): the list and its filters are what this
 * page is mostly for, and seven empty fields above them pushed both off a phone screen.
 */
function AddServiceForm() {
  const create = useCreateService();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [slugTouched, setSlugTouched] = useState(false);

  function handleChange(next: ServiceFormValues) {
    if (next.slug !== values.slug) {
      setSlugTouched(true);
    }
    setValues(next);
  }

  function handleNameChange(name: string) {
    setValues({ ...values, name, slug: slugTouched ? values.slug : slugify(name) });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateServiceForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    create.mutate(toCreateServiceBody(values), {
      onSuccess: () => {
        setValues(EMPTY_SERVICE_FORM);
        setSlugTouched(false);
      },
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>Add service</CardTitle>
          <CardDescription>
            New services start active but offered nowhere — switch them on per society below.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <SavedTick trigger={create.isSuccess ? create.submittedAt : null} text="Added" />
          <Button
            variant={open ? 'secondary' : 'primary'}
            size="sm"
            aria-expanded={open}
            aria-controls="add-service-form"
            onClick={() => setOpen((was) => !was)}
          >
            <Icon name={open ? 'close' : 'plus'} size={16} strokeWidth={2.2} />
            {open ? 'Close' : 'New service'}
          </Button>
        </div>
      </div>
      {open && (
      <form
        id="add-service-form"
        onSubmit={handleSubmit}
        className="animate-rise mt-5 flex flex-col gap-4"
        aria-label="Add service"
        noValidate
      >
        <ServiceFields
          idPrefix="new-service"
          values={values}
          errors={errors}
          onChange={handleChange}
          onNameChange={handleNameChange}
        />
        <Button type="submit" className="self-start" disabled={create.isPending}>
          {create.isPaused ? OFFLINE_WAITING_LABEL : create.isPending ? 'Adding…' : 'Add service'}
        </Button>
        {create.isPaused && <OfflineLine testId="service-create-offline" />}
        {create.isError && <ErrorLine error={create.error} />}
      </form>
      )}
    </Card>
  );
}

/** One society's availability for one service: on/off plus the indicative per-unit price. */
function OfferingControl({
  service,
  society,
  offering,
}: {
  service: AdminServiceDto;
  society: AdminSocietyDto;
  offering: ServiceOfferingDto | undefined;
}) {
  const upsert = useUpsertOffering(service.id);
  // Optimistic: the switch moves the moment it is tapped, and falls back to the stored
  // value if the server refuses (the error line then says why).
  const enabled = upsert.isPending ? (upsert.variables?.body.enabled ?? false) : (offering?.enabled ?? false);
  const stored = offering?.indicativePrice != null ? String(offering.indicativePrice) : '';
  const [price, setPrice] = useState(stored);
  const [priceError, setPriceError] = useState<string | null>(null);
  // CHORE-020: follow the stored price when it changes (a save here, or another tab) —
  // but never over text the admin has typed and not saved. This replaced a `key` that
  // re-mounted the control on every price change and threw that text away.
  const [dirty, setDirty] = useState(false);
  const [seen, setSeen] = useState(stored);
  // What is in the box NOW, read when a save lands: text typed while it was in flight
  // is still unsaved, and must stay protected (CHORE-020 V2 P2-b).
  const latestPrice = useRef(price);
  latestPrice.current = price;
  if (stored !== seen) {
    setSeen(stored);
    if (!dirty) {
      setPrice(stored);
    }
  }

  function save(nextEnabled: boolean) {
    const parsed = parseIndicativePrice(price);
    if (parsed === undefined) {
      setPriceError('Whole rupees up to ₹1,00,00,000, or leave it empty.');
      return;
    }
    setPriceError(null);
    const submitted = price;
    upsert.mutate(
      {
        societyId: society.id,
        serviceId: service.id,
        body: { enabled: nextEnabled, indicativePrice: parsed },
      },
      {
        onSuccess: () => {
          if (latestPrice.current === submitted) {
            setDirty(false);
          }
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="offering-control">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3">
            <span className="text-meta font-extrabold text-ink">{society.name}</span>
            <Switch
              checked={enabled}
              onChange={(next) => save(next)}
              label={`Offer ${service.name} in ${society.name}`}
              text={upsert.isPaused ? OFFLINE_WAITING_LABEL : enabled ? 'Offered' : 'Not offered'}
              // An inactive service can be switched off here but not newly on: residents
              // would never see it.
              disabled={!service.active && !enabled}
              busy={upsert.isPending}
            />
            <SavedTick trigger={upsert.isSuccess ? upsert.submittedAt : null} />
          </div>
          <p className="num mt-1 text-meta text-ink-muted">
            {offering?.indicativePrice != null
              ? `From ${formatRupees(offering.indicativePrice)} / ${service.unitLabel}`
              : 'No indicative price'}
          </p>
        </div>
        <Field
          label="Price per unit (₹)"
          hint="(optional)"
          id={`offering-${service.id}-${society.id}-price`}
          error={priceError}
          className="w-40"
        >
          {(props) => (
            <Input
              {...props}
              inputMode="numeric"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setDirty(true);
              }}
            />
          )}
        </Field>
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Save price for ${service.name} in ${society.name}`}
          disabled={upsert.isPending}
          onClick={() => save(enabled)}
        >
          Save price
        </Button>
      </div>
      {upsert.isPaused && <OfflineLine testId="offering-offline" />}
      {upsert.isError && <ErrorLine error={upsert.error} />}
    </div>
  );
}

/** One service: read view with Edit + activate toggle and its offerings, or an inline edit form. */
function ServiceRow({ service, societies }: { service: AdminServiceDto; societies: AdminSocietyDto[] }) {
  const update = useUpdateService();
  const [editing, setEditing] = useState(false);
  // Closed by default: with every society's controls open, 23 services made a phone
  // screen dozens of swipes long (FEAT-014 browser pass).
  const [showSocieties, setShowSocieties] = useState(false);
  const [values, setValues] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  const [errors, setErrors] = useState<ServiceFormErrors>({});

  function startEdit() {
    setValues(toServiceFormValues(service));
    setErrors({});
    update.reset();
    setEditing(true);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const found = validateServiceForm(values, service.category);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    update.mutate(
      { id: service.id, body: toUpdateServiceBody(values, service.category) },
      { onSuccess: () => setEditing(false) },
    );
  }

  const offeredIn = service.offerings.filter((o) => o.enabled).length;
  // CHORE-020: a queued offering save must stay visible when its panel is closed.
  const offeringPaused = useOfferingSavePaused(service.id);
  // Optimistic, as with the offering switch: moves on tap, reverts if refused.
  const pendingActive = update.isPending ? update.variables?.body.active : undefined;
  const active = pendingActive ?? service.active;

  return (
    // `row-in`: a row new to this result set rises in; a row that stays keeps its node
    // (keyed by id) and does not replay.
    <li className="row-in">
      <RowSurface data-testid="service-row">
        {editing ? (
          <form onSubmit={handleSave} className="flex flex-col gap-4" aria-label={`Edit ${service.name}`} noValidate>
            <ServiceFields
              idPrefix={`edit-${service.id}`}
              values={values}
              errors={errors}
              onChange={setValues}
              legacyCategory={service.category}
            />
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-extrabold tracking-[-0.02em] text-ink">{service.name}</span>
                  <SavedTick trigger={update.isSuccess ? update.submittedAt : null} />
                </div>
                <p className="mt-1 text-meta text-ink-muted">
                  Priced per {service.unitLabel} · offered in {offeredIn} of {societies.length}{' '}
                  {societies.length === 1 ? 'society' : 'societies'}
                </p>
                {service.unitDescription && (
                  <p className="mt-1.5 text-meta text-ink-soft">{service.unitDescription}</p>
                )}
                <p className="mt-1.5 text-meta text-ink-soft">{service.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={active}
                  onChange={(next) => update.mutate({ id: service.id, body: { active: next } })}
                  label={`${service.name} active`}
                  text={active ? 'Active' : 'Inactive'}
                  busy={update.isPending}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Edit ${service.name}`}
                  disabled={update.isPending}
                  onClick={startEdit}
                >
                  Edit
                </Button>
              </div>
            </div>
            {!active && (
              <p className="text-meta font-bold text-ink-muted">
                Inactive — residents see it nowhere, whatever the society settings say.
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              aria-expanded={showSocieties}
              aria-controls={`offerings-${service.id}`}
              onClick={() => setShowSocieties((open) => !open)}
            >
              {showSocieties ? 'Hide societies' : 'Manage societies'}
            </Button>
            {showSocieties && (
            <div id={`offerings-${service.id}`} className="animate-rise flex flex-col gap-4">
              {societies.map((society) => (
                <OfferingControl
                  key={society.id}
                  service={service}
                  society={society}
                  offering={service.offerings.find((o) => o.societyId === society.id)}
                />
              ))}
            </div>
            )}
          </div>
        )}
        {update.isPaused && <OfflineLine testId="service-update-offline" />}
        {offeringPaused && !showSocieties && <OfflineLine testId="service-offering-offline" />}
        {update.isError && <ErrorLine error={update.error} />}
      </RowSurface>
    </li>
  );
}

/** The URL keys this page owns (ADR-0026). */
const FILTER_KEYS = ['q', 'category', 'status', 'offeredIn'] as const;
const FILTER_VALIDATORS = { category: isListedCategory, status: isActiveFilter };

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** The URL's status param, if it is one the server accepts. Anything else is ignored. */
function toActiveFilter(value: string | undefined): ActiveFilter | undefined {
  return value === 'active' || value === 'inactive' ? value : undefined;
}

/**
 * Super-admin catalog management (FEAT-014; was CHORE-006): every master service grouped
 * by its category, an add form, inline edit, activate/deactivate (services are never
 * deleted — rounds reference them), and per-society availability with an indicative price.
 *
 * FEAT-015: filtered on the server — search, category, status, "offered in" — with the
 * filters in the URL. The last result stays on screen, dimmed, while the next one loads.
 */
export function AdminServicesPage() {
  const { filters, setFilters, clear, activeCount, generation } = useUrlFilters(FILTER_KEYS, FILTER_VALIDATORS);
  const [search, setSearch] = useDebouncedSearch(filters.q, (q) => setFilters({ q }), generation);
  const query: AdminServicesQuery = {
    q: filters.q,
    category: filters.category,
    status: toActiveFilter(filters.status),
    offeredIn: filters.offeredIn,
  };
  const servicesQuery = useAdminServices(query);
  const societiesQuery = useAdminSocieties();
  const { data, isLoading, isPlaceholderData, refetch } = servicesQuery;
  const societies = societiesQuery.data ?? [];
  // BUG-004: offline pauses the read instead of failing it.
  const failed = queryStalled(servicesQuery);
  const offeredInName = societies.find((s) => s.id === filters.offeredIn)?.name;

  return (
    <AdminLayout title="Services" subtitle="What residents can pool, and in which societies">
      <AddServiceForm />

      <Card>
        <div className="flex flex-col gap-4" role="search" aria-label="Filter services">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <SearchField
              label="Search services"
              placeholder="Search by name, description or slug"
              value={search}
              onChange={setSearch}
              maxLength={80}
            />
            <Select
              aria-label="Offered in"
              value={filters.offeredIn ?? ''}
              onChange={(e) => setFilters({ offeredIn: e.target.value || undefined })}
            >
              <option value="">Offered anywhere or nowhere</option>
              {societies.map((society) => (
                <option key={society.id} value={society.id}>
                  Offered in {society.name}
                </option>
              ))}
            </Select>
          </div>
          <FilterChips
            label="Category"
            options={CATEGORY_FILTER_OPTIONS}
            value={filters.category ?? ''}
            onChange={(category) => setFilters({ category: category || undefined })}
          />
          <FilterChips
            label="Status"
            options={STATUS_CHIPS}
            value={toActiveFilter(filters.status) ?? ''}
            onChange={(status) => setFilters({ status: status || undefined })}
          />
          <ResultSummary
            count={data?.length}
            noun={['service', 'services']}
            activeCount={activeCount}
            onClear={clear}
            busy={isPlaceholderData}
          />
        </div>
      </Card>

      {isLoading && (
        <Card>
          <SkeletonScreen label="Loading services…" testId="services-skeleton" className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="surface-solid rounded-tile p-4">
                <Skeleton className="h-4 w-1/3" delay={(row % 4) as 0 | 1 | 2 | 3} />
                <Skeleton className="mt-2.5 h-3 w-1/2" delay={1} />
                <Skeleton className="mt-2.5 h-3 w-24" delay={2} />
              </div>
            ))}
          </SkeletonScreen>
        </Card>
      )}
      {failed && (
        <Card>
          <div
            role="alert"
            className="animate-rise flex flex-col items-start gap-3 rounded-inset border border-paper/55 bg-danger-ink/10 px-4 py-4 text-danger-ink shadow-hairline"
          >
            <p className="flex gap-2.5 text-meta font-bold">
              <Icon name="alert" size={18} strokeWidth={2} />
              We couldn&apos;t load services. Please try again.
            </p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              <Icon name="refresh" size={16} strokeWidth={2.1} />
              Retry
            </Button>
          </div>
        </Card>
      )}
      {data && data.length === 0 && activeCount === 0 && (
        <Card>
          <EmptyState
            icon="services"
            title="No services yet"
            description="Add one above, then offer it to a society so residents can join a round."
            data-testid="services-empty"
          />
        </Card>
      )}
      {data && data.length === 0 && activeCount > 0 && (
        <Card className="animate-rise">
          <EmptyState
            icon="search"
            title="No services match"
            description={describeFilters(filters, offeredInName)}
            data-testid="services-no-match"
            action={
              <Button variant="secondary" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        </Card>
      )}
      <div className="results flex flex-col gap-4" aria-busy={isPlaceholderData}>
        {data &&
          groupByCategory(data).map(([category, services]) => (
            <Card key={category} data-testid="service-category" className="row-in">
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>
                  {services.length} {services.length === 1 ? 'service' : 'services'}
                </CardDescription>
              </CardHeader>
              <DataRows>
                {services.map((service) => (
                  <ServiceRow key={service.id} service={service} societies={societies} />
                ))}
              </DataRows>
            </Card>
          ))}
      </div>
    </AdminLayout>
  );
}

/** "Nothing for “tank” in Vehicle, inactive, offered in Blue Waters." — the filters, in words. */
function describeFilters(filters: Partial<Record<(typeof FILTER_KEYS)[number], string>>, offeredInName?: string): string {
  const parts = [
    filters.q ? `for “${filters.q}”` : null,
    filters.category ? `in ${filters.category}` : null,
    toActiveFilter(filters.status) ?? null,
    filters.offeredIn ? `offered in ${offeredInName ?? 'that society'}` : null,
  ].filter(Boolean);
  return `Nothing ${parts.join(', ')}. Loosen a filter, or clear them all.`;
}
