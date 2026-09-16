import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './ui.store';

/**
 * Preserves the intent of the original App counter test: the Zustand UI store
 * holds client state and updates on action.
 */
describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ count: 0 });
  });

  it('increments the counter', () => {
    expect(useUiStore.getState().count).toBe(0);
    useUiStore.getState().increment();
    expect(useUiStore.getState().count).toBe(1);
  });
});
