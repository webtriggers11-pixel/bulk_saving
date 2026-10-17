import {
  useMutation,
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
  AdminSocietyDto,
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
import { catalogQueryKey } from '../catalog/useCatalog';
import { roundsQueryKey } from '../rounds/useRounds';

/** Query keys for the super-admin screens. All live under ['admin', ...]. */
export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  roundsAll: ['admin', 'rounds'] as const,
  rounds: (filters: AdminRoundsQuery) => ['admin', 'rounds', filters] as const,
  round: (id: string) => ['admin', 'round', id] as const,
  vendors: ['admin', 'vendors'] as const,
  societies: ['admin', 'societies'] as const,
  services: ['admin', 'services'] as const,
  /** Mutation key for an in-flight assign, so sibling actions can disable themselves. */
  assignMutation: (id: string) => ['admin', 'assign', id] as const,
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
export function useAdminRounds(filters: AdminRoundsQuery): UseQueryResult<AdminRoundSummaryDto[]> {
  return useQuery({
    queryKey: adminKeys.rounds(filters),
    queryFn: () => fetchAdminRounds(filters),
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

/** GET /admin/services. */
export function useAdminServices(): UseQueryResult<AdminServiceDto[]> {
  return useQuery({ queryKey: adminKeys.services, queryFn: fetchServices });
}

/** GET /admin/vendors. */
export function useVendors(): UseQueryResult<VendorDto[]> {
  return useQuery({ queryKey: adminKeys.vendors, queryFn: fetchVendors });
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
      void queryClient.invalidateQueries({ queryKey: adminKeys.vendors });
      // Round summaries/details embed the vendor's name + phone.
      void queryClient.invalidateQueries({ queryKey: adminKeys.roundsAll });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'round'] });
    },
  });
}

/**
 * After any catalog write: the admin list, and the resident catalog (an admin who taps
 * "Back to app" must not see a stale one). Round views — admin and resident, and the
 * dashboard's demand table — embed the service's name and unit labels, so they refetch too.
 */
function invalidateCatalog(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: adminKeys.services });
  void queryClient.invalidateQueries({ queryKey: catalogQueryKey });
  void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
  // Prefix match: covers the resident feed and "My Requests" (['rounds', 'mine']).
  void queryClient.invalidateQueries({ queryKey: roundsQueryKey });
  void queryClient.invalidateQueries({ queryKey: adminKeys.roundsAll });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'round'] });
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

/** PUT /admin/societies/:societyId/offerings/:serviceId (FEAT-014). */
export function useUpsertOffering(): UseMutationResult<ServiceOfferingDto, Error, UpsertOfferingVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ societyId, serviceId, body }: UpsertOfferingVars) =>
      upsertOffering(societyId, serviceId, body),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}
