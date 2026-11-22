import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  AdminDashboardDto,
  AdminRoundDetailDto,
  AdminRoundParticipantDto,
  AdminRoundsQuery,
  AdminRoundSummaryDto,
  AdminServiceDto,
  AdminServicesQuery,
  AdminSocietyDetailDto,
  AdminOverviewDto,
  AdminResidentDto,
  AdminResidentDetailDto,
  AdminResidentsQuery,
  UpdateResidentBody,
  CreateSocietyBody,
  UpdateSocietyBody,
  AdminVendorsQuery,
  AssignRoundBody,
  CreateRoundBody,
  CreateServiceBody,
  CreateVendorBody,
  RoundDto,
  ServiceOfferingDto,
  UpdateServiceBody,
  UpdateVendorBody,
  UpsertOfferingBody,
  VendorDto,
  CreateAdminBody,
  UpdateRoundBody,
} from '@bulk/shared';
import {
  assignRound,
  cancelRound,
  closeRound,
  createRound,
  createService,
  createVendor,
  deliverRound,
  fetchAdminRound,
  fetchAdminRounds,
  fetchDashboard,
  fetchServices,
  createSociety,
  deleteSociety,
  fetchSocieties,
  fetchSociety,
  fetchOverview,
  fetchUsers,
  fetchUser,
  removeUser,
  updateUser,
  rotateInviteCode,
  updateSociety,
  fetchVendors,
  setPayment,
  updateService,
  updateVendor,
  upsertOffering,
  createAdmin,
  updateRound,
} from './admin.api';
import { fetchAllPages, usePagedQuery, type Paged } from '../../lib/pages';
import { catalogQueryKey } from '../catalog/useCatalog';
import { roundsQueryKey } from '../rounds/useRounds';

/** Query keys for the super-admin screens. All live under ['admin', ...]. */
export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  overview: ['admin', 'overview'] as const,
  roundsAll: ['admin', 'rounds'] as const,
  rounds: (filters: AdminRoundsQuery) => ['admin', 'rounds', filters] as const,
  round: (id: string) => ['admin', 'round', id] as const,
  /** Prefix of every filtered vendor list — invalidate this to refresh them all. */
  vendors: ['admin', 'vendors'] as const,
  vendorsFiltered: (filters: AdminVendorsQuery) => ['admin', 'vendors', filters] as const,
  societies: ['admin', 'societies'] as const,
  society: (id: string) => ['admin', 'society', id] as const,
  /** Prefix of every filtered user list (FEAT-033). */
  users: ['admin', 'users'] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  usersFiltered: (filters: AdminResidentsQuery) => ['admin', 'users', filters] as const,
  /** Prefix of every filtered service list. */
  services: ['admin', 'services'] as const,
  servicesFiltered: (filters: AdminServicesQuery) => ['admin', 'services', filters] as const,
  /** Mutation key for an in-flight assign, so sibling actions can disable themselves. */
  assignMutation: (id: string) => ['admin', 'assign', id] as const,
  /** Mutation key for any offering save on one service — lets the row see a paused one. */
  offeringMutation: (serviceId: string) => ['admin', 'offering', serviceId] as const,
};

/**
 * Invalidated on settle (success OR error): a 409 usually means the round moved
 * underneath the page (e.g. the deadline scheduler closed it), so refetch it.
 *
 * After any round mutation the round's detail, every filtered rounds list (prefix
 * match on ['admin','rounds']) and the dashboard aggregates may have changed.
 */
function invalidateRound(queryClient: QueryClient, id: string): void {
  void queryClient.invalidateQueries({ queryKey: adminKeys.round(id) });
  void queryClient.invalidateQueries({ queryKey: adminKeys.roundsAll });
  void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
  // BUG-029 V2 P3-1: opening a round answers requests (the sidebar count) and changes open rounds.
  void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
}

/** GET /admin/dashboard. */
export function useAdminDashboard({ enabled = true }: { enabled?: boolean } = {}): UseQueryResult<AdminDashboardDto> {
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: fetchDashboard, enabled });
}

/** GET /admin/rounds with optional status / society filters (part of the key). */
export function useAdminRounds(filters: AdminRoundsQuery): Paged<AdminRoundSummaryDto> {
  return usePagedQuery({
    queryKey: adminKeys.rounds(filters),
    fetchPage: (page) => fetchAdminRounds({ ...filters, ...page }),
    // FEAT-015: hold the last result on screen while a new filter loads, rather than
    // flashing to a skeleton between keystrokes.
    placeholderData: 'keepPrevious',
  });
}

/** GET /admin/rounds/:id. */
export function useAdminRound(id: string): UseQueryResult<AdminRoundDetailDto> {
  return useQuery({
    queryKey: adminKeys.round(id),
    queryFn: () => fetchAdminRound(id),
    enabled: id !== '',
  });
}

/** GET /admin/societies. */
export function useAdminSocieties(): UseQueryResult<AdminSocietyDetailDto[]> {
  return useQuery({ queryKey: adminKeys.societies, queryFn: fetchSocieties });
}

/** GET /admin/services, filtered on the server (FEAT-015). No filters = every service. */
export function useAdminServices(filters: AdminServicesQuery = {}): Paged<AdminServiceDto> {
  return usePagedQuery({
    queryKey: adminKeys.servicesFiltered(filters),
    fetchPage: (page) => fetchServices({ ...filters, ...page }),
    placeholderData: 'keepPrevious',
  });
}

/** Every service, for a picker (the new-round form) — walks the pages (FEAT-025). */
export function useAllServices(): UseQueryResult<AdminServiceDto[]> {
  return useQuery({ queryKey: [...adminKeys.services, 'all'], queryFn: () => fetchAllPages(fetchServices) });
}

/** GET /admin/vendors, filtered on the server (FEAT-015). No filters = every vendor. */
export function useVendors(filters: AdminVendorsQuery = {}): Paged<VendorDto> {
  return usePagedQuery({
    queryKey: adminKeys.vendorsFiltered(filters),
    fetchPage: (page) => fetchVendors({ ...filters, ...page }),
    placeholderData: 'keepPrevious',
  });
}

/** Every active vendor, for the assign picker — walks the pages (FEAT-025). */
export function useAllVendors(): UseQueryResult<VendorDto[]> {
  return useQuery({
    queryKey: [...adminKeys.vendors, 'all'],
    queryFn: () => fetchAllPages((page) => fetchVendors({ status: 'active', ...page })),
  });
}

/** POST /admin/rounds; refreshes the rounds lists and dashboard. */
export function useCreateRound(): UseMutationResult<RoundDto, Error, CreateRoundBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoundBody) => createRound(body),
    onSuccess: (round) => invalidateRound(queryClient, round.id),
  });
}

/** PATCH /admin/rounds/:id (FEAT-038). */
export function useUpdateRound(id: string): UseMutationResult<AdminRoundDetailDto, Error, UpdateRoundBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRoundBody) => updateRound(id, body),
    onSuccess: () => invalidateRound(queryClient, id),
  });
}

/** POST /admin/rounds/:id/close. */
export function useCloseRound(id: string): UseMutationResult<RoundDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => closeRound(id),
    onSettled: () => invalidateRound(queryClient, id),
  });
}

/** POST /admin/rounds/:id/cancel. */
export function useCancelRound(id: string): UseMutationResult<RoundDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelRound(id),
    onSettled: () => invalidateRound(queryClient, id),
  });
}

/** POST /admin/rounds/:id/assign. */
export function useAssignRound(
  id: string,
): UseMutationResult<AdminRoundDetailDto, Error, AssignRoundBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: adminKeys.assignMutation(id),
    mutationFn: (body: AssignRoundBody) => assignRound(id, body),
    onSettled: () => invalidateRound(queryClient, id),
  });
}

/** POST /admin/rounds/:id/deliver. */
export function useDeliverRound(id: string): UseMutationResult<AdminRoundDetailDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deliverRound(id),
    onSettled: () => invalidateRound(queryClient, id),
  });
}

/** Arguments for a payment toggle: which participant and the new collected state. */
interface PaymentVars {
  participantId: string;
  collected: boolean;
}

/** PUT .../participants/:participantId/payment; payment totals feed the dashboard too. */
export function useSetPayment(
  roundId: string,
): UseMutationResult<AdminRoundParticipantDto, Error, PaymentVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, collected }: PaymentVars) =>
      setPayment(roundId, participantId, { collected }),
    onSettled: () => invalidateRound(queryClient, roundId),
  });
}

/** POST /admin/vendors; refreshes the vendor list. */
export function useCreateVendor(): UseMutationResult<VendorDto, Error, CreateVendorBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVendorBody) => createVendor(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.vendors });
    },
  });
}

/** Arguments for a vendor update. */
interface UpdateVendorVars {
  id: string;
  body: UpdateVendorBody;
}

/** PATCH /admin/vendors/:id; refreshes the vendor list and rounds that embed the vendor. */
export function useUpdateVendor(): UseMutationResult<VendorDto, Error, UpdateVendorVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: UpdateVendorVars) => updateVendor(id, body),
    onSuccess: () => {
      // Round summaries/details embed the vendor's name + phone.
      void queryClient.invalidateQueries({ queryKey: adminKeys.roundsAll });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'round'] });
      // Returned, so the optimistic switch holds until the fresh list lands (V2 P1-2) —
      // but never longer than REFRESH_WAIT_MS (CHORE-020 V2 P2-c).
      return settleWithin(queryClient.invalidateQueries({ queryKey: adminKeys.vendors }), REFRESH_WAIT_MS);
    },
  });
}

/**
 * After any catalog write: the admin list, and the resident catalog (an admin who taps
 * "Back to app" must not see a stale one). Round views — admin and resident, and the
 * dashboard's demand table — embed the service's name and unit labels, so they refetch too.
 */
/**
 * Wait for `promise`, but no longer than `ms`. A save's onSuccess waits for the refreshed
 * list so an optimistic switch does not flicker — but if the device drops offline after
 * the write landed, that refetch pauses, and the switch would stay "saving" until the
 * network came back for a write that already succeeded (CHORE-020 V2 P2-c).
 */
export function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    // `then(done, done)`, not `finally`: finally passes a rejection on, and a failed
    // refresh became an unhandled rejection (caught by the gate's own run).
    promise.then(done, done);
  });
}

/** How long a save waits for its list to refresh before letting go (see settleWithin). */
const REFRESH_WAIT_MS = 3_000;

function invalidateCatalog(queryClient: QueryClient): Promise<void> {
  // The list a switch sits on is awaited, and returned from onSuccess: the mutation then
  // stays pending — and an optimistic switch keeps its new position — until the fresh
  // list has landed. Returning void let the switch fall back to the stale cached value
  // for a beat, so it flickered on → off → on (FEAT-015 V2 P1-2). The rest refresh in
  // the background.
  void queryClient.invalidateQueries({ queryKey: catalogQueryKey });
  void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
  // Prefix match: covers the resident feed and "My Requests" (['rounds', 'mine']).
  void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
  void queryClient.invalidateQueries({ queryKey: adminKeys.roundsAll });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'round'] });
  return settleWithin(queryClient.invalidateQueries({ queryKey: adminKeys.services }), REFRESH_WAIT_MS);
}

/** POST /admin/services (FEAT-014). */
export function useCreateService(): UseMutationResult<AdminServiceDto, Error, CreateServiceBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateServiceBody) => createService(body),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

/** Arguments for a service update. */
interface UpdateServiceVars {
  id: string;
  body: UpdateServiceBody;
}

/** PATCH /admin/services/:id (FEAT-014). */
export function useUpdateService(): UseMutationResult<AdminServiceDto, Error, UpdateServiceVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: UpdateServiceVars) => updateService(id, body),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

/** Arguments for an offering upsert: one (society, service) pair. */
interface UpsertOfferingVars {
  societyId: string;
  serviceId: string;
  body: UpsertOfferingBody;
}

/**
 * PUT /admin/societies/:societyId/offerings/:serviceId (FEAT-014). Keyed by service, so a
 * row can tell when one of its offering saves is queued offline even after the panel
 * that started it has closed (CHORE-020).
 */
export function useUpsertOffering(serviceId: string): UseMutationResult<ServiceOfferingDto, Error, UpsertOfferingVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: adminKeys.offeringMutation(serviceId),
    mutationFn: ({ societyId, serviceId, body }: UpsertOfferingVars) =>
      upsertOffering(societyId, serviceId, body),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

/** True while any offering save for this service is queued offline (CHORE-020). */
export function useOfferingSavePaused(serviceId: string): boolean {
  return useMutationState({
    filters: { mutationKey: adminKeys.offeringMutation(serviceId), status: 'pending' },
    select: (mutation) => mutation.state.isPaused,
  }).some(Boolean);
}

// ─── Societies (FEAT-032, ADR-0043) ─────────────────────────────────────────────────

/** One society with its counts. */
export function useAdminSociety(id: string): UseQueryResult<AdminSocietyDetailDto> {
  return useQuery({ queryKey: adminKeys.society(id), queryFn: () => fetchSociety(id), enabled: id.length > 0 });
}

/** After any society write: the list (and every society picker) and this society's detail. */
function settleSociety(queryClient: QueryClient, society: AdminSocietyDetailDto): void {
  queryClient.setQueryData(adminKeys.society(society.id), society);
  void queryClient.invalidateQueries({ queryKey: adminKeys.societies });
  void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
}

export function useCreateSociety(): UseMutationResult<AdminSocietyDetailDto, Error, CreateSocietyBody> {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createSociety, onSuccess: (society) => settleSociety(queryClient, society) });
}

export function useUpdateSociety(id: string): UseMutationResult<AdminSocietyDetailDto, Error, UpdateSocietyBody> {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (body: UpdateSocietyBody) => updateSociety(id, body), onSuccess: (society) => settleSociety(queryClient, society) });
}

export function useRotateInviteCode(id: string): UseMutationResult<AdminSocietyDetailDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => rotateInviteCode(id), onSuccess: (society) => settleSociety(queryClient, society) });
}

export function useDeleteSociety(id: string): UseMutationResult<{ deleted: true }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteSociety(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminKeys.society(id) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.societies });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    },
  });
}

// ─── Users and access rights (FEAT-033, ADR-0044) ───────────────────────────────────

export function useAdminUsers(filters: AdminResidentsQuery = {}): Paged<AdminResidentDto> {
  return usePagedQuery({
    queryKey: adminKeys.usersFiltered(filters),
    fetchPage: (page) => fetchUsers({ ...filters, ...page }),
    placeholderData: 'keepPrevious',
  });
}

/** A user write changes the user lists and every society's resident count. */
function settleUsers(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: adminKeys.users });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] });
  void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
  void queryClient.invalidateQueries({ queryKey: adminKeys.societies });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'society'] });
}

export function useUpdateUser(): UseMutationResult<AdminResidentDto, Error, { id: string; body: UpdateResidentBody }> {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, body }) => updateUser(id, body), onSuccess: () => settleUsers(queryClient) });
}

/** FEAT-036: add a platform admin (no society). */
export function useCreateAdmin(): UseMutationResult<AdminResidentDto, Error, CreateAdminBody> {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createAdmin, onSuccess: () => settleUsers(queryClient) });
}

export function useRemoveUser(): UseMutationResult<{ deleted: true }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: removeUser, onSuccess: () => settleUsers(queryClient) });
}

/** FEAT-034: the dashboard's platform numbers. Any society or user write makes it stale. */
export function useAdminOverview(): UseQueryResult<AdminOverviewDto> {
  // BUG-029: every admin page reads this now (the sidebar's waiting-requests badge). A lambda,
  // so the call resolves when the query runs, not when a page renders.
  // V2 P3-2: 30 s fresh, so moving between admin pages doesn't re-run it every time; writes invalidate it.
  return useQuery({ queryKey: adminKeys.overview, queryFn: () => fetchOverview(), staleTime: 30_000 });
}

/** FEAT-035: one user with every pledge, for the user detail page. */
export function useAdminUser(id: string): UseQueryResult<AdminResidentDetailDto> {
  return useQuery({ queryKey: adminKeys.user(id), queryFn: () => fetchUser(id), enabled: id.length > 0 });
}
