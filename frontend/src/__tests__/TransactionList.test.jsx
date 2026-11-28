import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TransactionList from '../components/TransactionList';
vi.mock('../api', () => ({ listTransactions: vi.fn(), updateTransaction: vi.fn(), deleteTransaction: vi.fn(), listRules: vi.fn(() => Promise.resolve([])), saveRule: vi.fn(), deleteRule: vi.fn(), joinSplit: vi.fn(), splitTransaction: vi.fn() }));
import { listTransactions } from '../api';
const rows = [
  { id: 1, date: '2026-11-15', description: 'Coffee, "large"', category: 'DINING', type: 'EXPENSE', amount: '4.50' },
  { id: 2, date: '2026-11-14', description: '=SUM(A1:A2)', category: 'OTHER', type: 'INCOME', amount: '10' },
];
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function load() {
  listTransactions.mockResolvedValue(rows);
  render(<TransactionList refreshKey={0} />);
  await screen.findByText('Coffee, "large"');
}
async function download() {
  let csv;
  vi.stubGlobal('Blob', class { constructor(parts) { csv = parts.join(''); } });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(click).toHaveBeenCalledOnce();
  return csv;
}
it('exports numeric expenses and escapes quotes, commas and formula-like text', async () => {
  await load();
  const csv = await download();
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain('"Coffee, ""large"""');
  expect(csv).toContain('"EXPENSE",-4.5\r\n');
  expect(csv).toContain('"\'=SUM(A1:A2)"');
  expect(csv).toContain('"INCOME",10');
});
it('exports only matching transactions', async () => {
  await load();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search by description' }), { target: { value: 'coffee' } });
  const csv = await download();
  expect(csv).toContain('Coffee');
  expect(csv).not.toContain('SUM');
});
it('explains reversed dates accessibly and recovers when corrected', async () => {
  await load();
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-20' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-01' } });
  expect(screen.getByRole('alert').textContent).toContain('From date must be on or before');
  expect(screen.getByLabelText('From').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('To').getAttribute('aria-describedby')).toBe('transaction-date-error');
  expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(true);
  expect(screen.queryByText('No transactions match these filters.')).toBeNull();
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-15' } });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(false);
});
it('disables export when filters match no transactions', async () => {
  await load();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search by description' }), { target: { value: 'no match' } });
  expect(screen.getByText('No transactions match these filters.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(true);
});
