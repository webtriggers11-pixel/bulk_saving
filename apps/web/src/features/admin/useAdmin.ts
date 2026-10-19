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
  AdminSocietyDto,
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
  fetchSocieties,
  fetchVendors,
  setPayment,
  updateService,
  updateVendor,
  upsertOffering,
} from './admin.api';
import { fetchAllPages, usePagedQuery, type Paged } from '../../lib/pages';
import { catalogQueryKey } from '../catalog/useCatalog';
import { roundsQueryKey } from '../rounds/useRounds';

/** Query keys for the super-admin screens. All live under ['admin', ...]. */
export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  roundsAll: ['admin', 'rounds'] as const,
  rounds: (filters: AdminRoundsQuery) => ['admin', 'rounds', filters] as const,
  round: (id: string) => ['admin', 'round', id] as const,
  /** Prefix of every filtered vendor list — invalidate this to refresh them all. */
  vendors: ['admin', 'vendors'] as const,
  vendorsFiltered: (filters: AdminVendorsQuery) => ['admin', 'vendors', filters] as const,
  societies: ['admin', 'societies'] as const,
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
}

/** GET /admin/dashboard. */
export function useAdminDashboard(): UseQueryResult<AdminDashboardDto> {
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: fetchDashboard });
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
export function useAdminSocieties(): UseQueryResult<AdminSocietyDto[]> {
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
