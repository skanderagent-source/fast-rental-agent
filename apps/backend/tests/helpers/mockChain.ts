import { vi } from 'vitest';

export function mockChain(resolved: { data?: unknown; error?: unknown; count?: number } = { data: [], error: null }) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  const terminal = () => Promise.resolve(resolved);
  for (const m of [
    'select', 'eq', 'is', 'or', 'order', 'range', 'insert', 'update', 'delete', 'upsert',
    'not', 'gt', 'gte', 'lte', 'lt', 'limit', 'single', 'maybeSingle', 'in',
  ]) {
    c[m] = vi.fn(m === 'single' || m === 'maybeSingle' ? terminal : self);
  }
  c.then = (onFulfilled?: (value: typeof resolved) => unknown, onRejected?: (reason: unknown) => unknown) =>
    terminal().then(onFulfilled, onRejected);
  return c;
}

export function authAs(
  mockGetUser: ReturnType<typeof vi.fn>,
  mockFrom: ReturnType<typeof vi.fn>,
  profile: Record<string, unknown>,
) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: profile.id ?? 'user-1', email: profile.email ?? 'a@test.com' } },
    error: null,
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'agents') {
      return mockChain({ data: { actif: true, role: 'agent', nom: 'Agent', ...profile }, error: null });
    }
    return mockChain({ data: [], error: null });
  });
  return 'Bearer fake-token';
}
