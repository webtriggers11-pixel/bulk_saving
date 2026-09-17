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
  CreateVendorBody,
  RoundDto,
  UpdateVendorBody,
  VendorDto,
} from '@bulk/shared';
import {
  assignRound,
  cancelRound,
  closeRound,
  createRound,
  createVendor,
  deliverRound,
  fetchAdminRound,
  fetchAdminRounds,
  fetchDashboard,
  fetchServices,
  fetchSocieties,
  fetchVendors,
  setPayment,
  updateVendor,
} from './admin.api';

/** Query keys for the super-admin screens. All live under ['admin', ...]. */
export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  roundsAll: ['admin', 'rounds'] as const,
  rounds: (filters: AdminRoundsQuery) => ['admin', 'rounds', filters] as const,
  round: (id: string) => ['admin', 'round', id] as const,
  vendors: ['admin', 'vendors'] as const,
  societies: ['admin', 'societies'] as const,
  services: ['admin', 'services'] as const,
};

/**
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
    onSuccess: () => invalidateRound(queryClient, id),
  });
}

/** POST /admin/rounds/:id/cancel. */
export function useCancelRound(id: string): UseMutationResult<RoundDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelRound(id),
    onSuccess: () => invalidateRound(queryClient, id),
  });
}

/** POST /admin/rounds/:id/assign. */
export function useAssignRound(
  id: string,
): UseMutationResult<AdminRoundDetailDto, Error, AssignRoundBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignRoundBody) => assignRound(id, body),
    onSuccess: () => invalidateRound(queryClient, id),
  });
}

/** POST /admin/rounds/:id/deliver. */
export function useDeliverRound(id: string): UseMutationResult<AdminRoundDetailDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deliverRound(id),
    onSuccess: () => invalidateRound(queryClient, id),
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
    onSuccess: () => invalidateRound(queryClient, roundId),
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

/** PATCH /admin/vendors/:id; refreshes the vendor list. */
export function useUpdateVendor(): UseMutationResult<VendorDto, Error, UpdateVendorVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: UpdateVendorVars) => updateVendor(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.vendors });
    },
  });
}
