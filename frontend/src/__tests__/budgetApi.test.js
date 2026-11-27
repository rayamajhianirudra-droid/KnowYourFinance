import { afterEach, expect, it, vi } from 'vitest';
import { getBudgets, saveBudget, removeBudget } from '../api';
function mockFetch(response) {
  return vi.fn(async (url) => url.endsWith("/auth/csrf")
    ? { ok: true, json: async () => ({ headerName: "X-CSRF-TOKEN", token: "mock-token" }) }
    : response);
}
afterEach(() => vi.unstubAllGlobals());
it('uses the session and chosen month for budget requests', async () => {
  const fetch = mockFetch({ ok:true, status:200, json:async () => [] });
  vi.stubGlobal('fetch', fetch);
  await getBudgets('2026-02');
  expect(fetch).toHaveBeenLastCalledWith('/api/budgets?year=2026&month=2', expect.any(Object));
  await saveBudget('2026-02', 'DINING', '100.25');
  expect(fetch).toHaveBeenLastCalledWith('/api/budgets/DINING?year=2026&month=2', expect.objectContaining({method:'PUT', body:JSON.stringify({limitAmount:'100.25'})}));
});
it('accepts a successful empty delete response', async () => {
  vi.stubGlobal('fetch', mockFetch({ok:true,status:204}));
  expect(await removeBudget('2026-02','DINING')).toBeNull();
});
it('shows server-side limit validation errors', async () => {
  vi.stubGlobal('fetch', mockFetch({ok:false,status:400,json:async () => ({ fieldErrors:{limitAmount:'Too many decimals.'} })}));
  await expect(saveBudget('2026-02','DINING','1.001')).rejects.toThrow('Too many decimals.');
});
