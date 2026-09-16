import type { ApiResponse, HealthStatus } from '@bulk/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_URL}/health`);
  const body = (await response.json()) as ApiResponse<HealthStatus>;
  if (!body.success) {
    throw new Error(body.error.message);
  }
  return body.data;
}
