import { create } from 'zustand';

/**
 * Tiny Zustand store proving client/UI state is wired. Real auth/UI stores
 * arrive with their features; server data always lives in TanStack Query.
 */
interface UiState {
  count: number;
  increment: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
