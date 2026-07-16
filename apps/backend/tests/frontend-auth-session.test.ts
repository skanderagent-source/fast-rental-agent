import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { abortInFlightApiRequests, clearClientSession, getApiAbortSignal } from '../../frontend/src/lib/authSession.js';

describe('frontend auth session cleanup', () => {
  it('rotates abort signals so in-flight requests can be cancelled', () => {
    const first = getApiAbortSignal();
    abortInFlightApiRequests();
    const second = getApiAbortSignal();
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });

  it('clears query cache and cancels in-flight queries on logout', () => {
    const queryClient = new QueryClient();
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    const clearSpy = vi.spyOn(queryClient, 'clear');

    queryClient.setQueryData(['listings'], { items: [{ id: 'secret-listing' }] });
    clearClientSession(queryClient);

    expect(cancelSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(queryClient.getQueryData(['listings'])).toBeUndefined();
  });
});
