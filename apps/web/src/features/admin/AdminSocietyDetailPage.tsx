import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatSocietyAddress, hasSocietyAddress, type AdminSocietyDetailDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmSheet } from '../../components/ui/confirm-sheet';
import { Icon } from '../../components/ui/icon';
import { Notice } from '../../components/ui/notice';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { invitationMessage, joinLink, spacedCode, whatsappShareHref } from './invitation';
import { societyBody, SocietyFields, societyFormValues, validateSocietyForm, type SocietyFormErrors, type SocietyFormValues } from './AdminSocietiesPage';
import { useAdminSociety, useDeleteSociety, useRotateInviteCode, useUpdateSociety } from './useAdmin';
import { useQrCode } from './useQrCode';

/** A button that copies `text` and says "Copied" for a moment; says so if the clipboard refuses. */
function CopyButton({ text, label, testId }: { text: string; label: string; testId: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }
  return (
    <Button variant="secondary" size="sm" onClick={() => void copy()} data-testid={testId} aria-live="polite">
      {state === 'copied' ? (
        <>
          <Icon name="check" size={14} strokeWidth={2.4} /> Copied
        </>
      ) : state === 'failed' ? (
        'Select and copy it'
      ) : (
        label
      )}
    </Button>
  );
}

/** The code, the link and the QR, with Copy and Print (ADR-0043 §4–§6). */
function InviteCard({ society, link, qr }: { society: AdminSocietyDetailDto; link: string; qr: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite residents</CardTitle>
        <CardDescription>Residents scan the QR code or open the link. The code is already filled in.</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex size-44 shrink-0 items-center justify-center self-center rounded-tile border border-line/15 bg-white p-2.5 sm:self-start">
          {qr ? (
            <img src={qr} alt={`QR code that opens ${link}`} className="size-full" data-testid="society-qr" />
          ) : (
            <Skeleton className="size-full" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-eyebrow uppercase text-ink-muted">Invite code</span>
            <span className="num text-[28px] font-extrabold tracking-[0.18em] text-ink" data-testid="society-invite-code">
              {spacedCode(society.inviteCode)}
            </span>
            <div>
              <CopyButton text={society.inviteCode} label="Copy code" testId="copy-code" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-eyebrow uppercase text-ink-muted">Join link</span>
            <span className="break-all text-meta font-semibold text-ink" data-testid="society-join-link">
              {link}
            </span>
            <div>
              <CopyButton text={link} label="Copy link" testId="copy-link" />
            </div>
          </div>
          {/* V2 P3: a poster printed before the QR renders would have no QR on it. */}
          <Button className="self-start" disabled={!qr} onClick={() => window.print()} data-testid="print-poster">
            {qr ? 'Print poster' : 'Preparing poster…'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** The ready-to-send invitation: Copy, Share (when the browser can), WhatsApp (ADR-0043 §7). */
function InvitationCard({ society, message }: { society: AdminSocietyDetailDto; message: string }) {
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function share() {
    try {
      await navigator.share({ title: `Join ${society.name} on Bulk Saving`, text: message });
    } catch {
      // Cancelled by the person, or refused by the browser: nothing to report.
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitation message</CardTitle>
        <CardDescription>Paste it into the society&apos;s WhatsApp group, or send it to residents one by one.</CardDescription>
      </CardHeader>
      <p
        className="whitespace-pre-wrap rounded-control border border-line/15 bg-paper/60 p-4 text-meta text-ink"
        data-testid="invitation-message"
      >
        {message}
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <CopyButton text={message} label="Copy message" testId="copy-message" />
        {canShare && (
          <Button variant="secondary" size="sm" onClick={() => void share()} data-testid="share-message">
            <Icon name="share" size={14} strokeWidth={2} /> Share
          </Button>
        )}
        <a
          href={whatsappShareHref(message)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="whatsapp-message"
          className="inline-flex h-11 items-center gap-1.5 rounded-control border border-line/15 px-3.5 text-meta font-bold text-ink"
        >
          <Icon name="chat" size={14} strokeWidth={2} /> Send on WhatsApp
        </a>
      </div>
    </Card>
  );
}

/**
 * FEAT-043 (ADR-0050): where the society is and who to call. A society created before the
 * address was required says so, and points at the form below.
 */
function AddressCard({ society }: { society: AdminSocietyDetailDto }) {
  const complete = hasSocietyAddress(society);
  const address = formatSocietyAddress(society);
  return (
    <Card data-testid="society-address-card">
      <CardHeader>
        <CardTitle>Address</CardTitle>
      </CardHeader>
      {complete ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2.5 text-body text-ink" data-testid="society-address">
            <Icon name="building" size={16} strokeWidth={2} className="mt-1 shrink-0 text-ink-muted" />
            <span>{address}</span>
          </p>
          <p className="flex items-center gap-2.5 text-body" data-testid="society-contact-phone">
            <Icon name="phone" size={16} strokeWidth={2} className="shrink-0 text-ink-muted" />
            {society.contactPhone ? (
              <a href={`tel:${society.contactPhone}`} className="num font-bold text-brand-ink underline">
                {society.contactPhone}
              </a>
            ) : (
              <span className="text-ink-muted">No contact phone</span>
            )}
          </p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${society.name}, ${address}`)}`}
            target="_blank"
            rel="noreferrer"
            className="self-start text-meta font-bold text-brand-ink underline"
          >
            Open in Maps
          </a>
        </div>
      ) : (
        <Notice tone="warn" data-testid="society-address-missing">
          Address missing. Add the building, street, state and PIN code under Details below.
        </Notice>
      )}
    </Card>
  );
}

function EditDetailsCard({ society }: { society: AdminSocietyDetailDto }) {
  const update = useUpdateSociety(society.id);
  const [values, setValues] = useState<SocietyFormValues>(() => societyFormValues(society));
  const [errors, setErrors] = useState<SocietyFormErrors>({});
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(societyBody(values)) !== JSON.stringify(societyBody(societyFormValues(society)));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateSocietyForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaved(false);
    update.mutate(societyBody(values), { onSuccess: () => setSaved(true) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Society details" noValidate>
        <SocietyFields idPrefix="edit-society" values={values} errors={errors} onChange={(next) => { setValues(next); setSaved(false); }} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save details'}
          </Button>
          {saved && !dirty && (
            <span role="status" className="text-meta font-bold text-brand-ink">
              Saved
            </span>
          )}
        </div>
        {update.isError && <Notice tone="error">{errorMessage(update.error)}</Notice>}
      </form>
    </Card>
  );
}

/** Rotate the code and delete the society, each behind a confirm (FEAT-024 pattern). */
function ManageCard({ society }: { society: AdminSocietyDetailDto }) {
  const navigate = useNavigate();
  const rotate = useRotateInviteCode(society.id);
  const remove = useDeleteSociety(society.id);
  const update = useUpdateSociety(society.id);
  const [asking, setAsking] = useState<'rotate' | 'delete' | null>(null);
  const occupied = society.residentCount > 0 || society.roundCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-4">
        {/* FEAT-035 (ADR-0045 §4): an inactive society's code admits nobody. */}
        <div className="flex flex-col gap-1.5">
          <Switch
            checked={society.active}
            onChange={(next) => update.mutate({ active: next })}
            label="Society active"
            text={society.active ? 'Active: the invite code works' : 'Inactive: the invite code admits nobody'}
            busy={update.isPending}
          />
          <p className="text-meta text-ink-muted">Residents already signed in stay signed in. Switch individual users off from Users.</p>
          {update.isError && <Notice tone="error">{errorMessage(update.error)}</Notice>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button variant="secondary" className="self-start" onClick={() => setAsking('rotate')} data-testid="rotate-code">
            <Icon name="refresh" size={15} strokeWidth={2} /> New invite code
          </Button>
          <p className="text-meta text-ink-muted">Use this if the code got out. Residents who already joined stay joined.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button variant="danger" className="self-start" disabled={occupied} onClick={() => setAsking('delete')} data-testid="delete-society">
            Delete society
          </Button>
          <p className="text-meta text-ink-muted" data-testid="delete-reason">
            {occupied
              ? `It has ${society.residentCount} resident(s) and ${society.roundCount} round(s). Only an empty society can be deleted.`
              : 'Nobody has joined yet, so it can be deleted.'}
          </p>
        </div>
      </div>
      <ConfirmSheet
        open={asking === 'rotate'}
        onClose={() => setAsking(null)}
        title="Make a new invite code?"
        consequence={`The code ${spacedCode(society.inviteCode)} and every poster or message that carries it will stop working.`}
        confirmLabel="Yes, new code"
        pendingLabel="Making…"
        busy={rotate.isPending}
        error={rotate.isError ? errorMessage(rotate.error) : null}
        onConfirm={() => rotate.mutate(undefined, { onSuccess: () => setAsking(null) })}
        data-testid="rotate-confirm"
      />
      <ConfirmSheet
        open={asking === 'delete'}
        onClose={() => setAsking(null)}
        title={`Delete ${society.name}?`}
        consequence="The society and its invite code are removed for good."
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => navigate('/admin/societies', { replace: true }) })}
        data-testid="delete-confirm"
      />
    </Card>
  );
}

/**
 * The A4 poster (ADR-0043 §6): hidden on screen, the only thing printed. `window.print()`
 * also covers "Save as PDF" without a PDF library.
 */
function Poster({ society, qr }: { society: AdminSocietyDetailDto; qr: string | null }) {
  return (
    // V2 P1: the poster sets its own ink. It inherits `--ink`, which is near-white in dark mode, and
    // Chrome drops backgrounds when printing, so the name and code would print white on white paper.
    <div data-print-poster className="hidden print:flex print:flex-col print:items-center print:gap-6 print:p-10 print:text-center print:text-black">
      <p className="text-[22px] font-bold uppercase tracking-[0.2em]">Bulk Saving</p>
      <h2 className="text-[44px] font-extrabold leading-tight">{society.name}</h2>
      <p className="text-[20px]">Book home services together with your neighbours, and everyone pays less.</p>
      {qr && <img src={qr} alt="" className="size-[90mm]" />}
      <p className="text-[18px]">Scan with your phone camera, or open the app and enter the code</p>
      <p className="num text-[56px] font-extrabold tracking-[0.2em]">{spacedCode(society.inviteCode)}</p>
      <ol className="flex flex-col gap-1 text-[18px]">
        <li>1. Scan the QR code</li>
        <li>2. Enter your phone number</li>
        <li>3. Type the code we text you</li>
      </ol>
    </div>
  );
}

/** `/admin/societies/:id` (FEAT-032): everything an admin needs to bring a society on board. */
export function AdminSocietyDetailPage() {
  const { id = '' } = useParams();
  const society = useAdminSociety(id);
  const link = society.data ? joinLink(window.location.origin, society.data.inviteCode) : '';
  const qr = useQrCode(link);

  if (society.isPending) {
    return (
      <AdminLayout title="Society">
        <SkeletonScreen label="Loading society…" className="flex flex-col gap-3">
          <Skeleton className="h-44" radius="card" />
          <Skeleton className="h-32" radius="card" />
        </SkeletonScreen>
      </AdminLayout>
    );
  }
  if (society.isError) {
    return (
      <AdminLayout title="Society">
        <div className="flex flex-col gap-3">
          <Notice tone="error">{errorMessage(society.error, "Couldn't load this society.")}</Notice>
          <Link to="/admin/societies" className="text-meta font-bold text-brand-ink underline">
            Back to societies
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const data = society.data;
  const message = invitationMessage(data.name, data.inviteCode, link);
  return (
    <>
      <div className="print:hidden">
        <AdminLayout
          title={data.name}
          subtitle={`${data.city} · ${data.residentCount} ${data.residentCount === 1 ? 'resident' : 'residents'} · ${data.roundCount} ${data.roundCount === 1 ? 'round' : 'rounds'}`}
        >
          <div className="flex flex-col gap-6">
            <Link
              to={`/admin/users?society=${encodeURIComponent(data.id)}`}
              className="self-start text-meta font-bold text-brand-ink underline"
              data-testid="society-users-link"
            >
              See its {data.residentCount} {data.residentCount === 1 ? 'user' : 'users'}
            </Link>
            <InviteCard society={data} link={link} qr={qr} />
            <InvitationCard society={data} message={message} />
            <AddressCard society={data} />
            <EditDetailsCard key={JSON.stringify(societyFormValues(data))} society={data} />
            <ManageCard society={data} />
          </div>
        </AdminLayout>
      </div>
      <Poster society={data} qr={qr} />
    </>
  );
}
