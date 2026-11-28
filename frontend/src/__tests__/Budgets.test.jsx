import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Budgets from '../components/Budgets';
import { copyPreviousMonthBudgets, getBudgets, saveBudget, removeBudget } from '../api';
vi.mock('../api', () => ({ copyPreviousMonthBudgets: vi.fn(), getBudgets: vi.fn(), saveBudget: vi.fn(), removeBudget: vi.fn() }));
const dining = { category: 'DINING', limitAmount: 100, spent: 85, remaining: 15, percentUsed: 85, status: 'WARNING' };
beforeEach(() => { vi.resetAllMocks(); getBudgets.mockResolvedValue([]); });
afterEach(cleanup);
it('shows empty guidance and saves a limit for the selected month', async () => {
  render(<Budgets refreshKey={0} />);
  await screen.findByText('Start with one category');
  const month = screen.getByLabelText('Budget month').value;
  fireEvent.change(screen.getByLabelText('Monthly limit ($)'), { target: { value: '250.25' } });
  saveBudget.mockResolvedValue({});
  getBudgets.mockResolvedValue([{ ...dining, category:'GROCERIES' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));
  await waitFor(() => expect(saveBudget).toHaveBeenCalledWith(month, 'GROCERIES', '250.25'));
  expect(await screen.findByRole('progressbar', { name: 'Groceries budget used' })).toBeTruthy();
});
it('shows approaching and over-budget statuses with capped progress', async () => {
  getBudgets.mockResolvedValue([dining, { ...dining, category:'SHOPPING', spent:125, remaining:-25, percentUsed:125, status:'OVER' }]);
  render(<Budgets refreshKey={0} />);
  expect(await screen.findByText('Approaching limit')).toBeTruthy();
  expect(screen.getByText('Over budget')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name:'Shopping budget used' }).value).toBe(100);
  expect(screen.getByRole('progressbar', { name:'Shopping budget used' }).getAttribute('aria-valuetext')).toBe('125.00% used');
  expect(screen.getByRole('region', { name:'Budget alerts' }).textContent).toContain('$25.00 over budget');
});
it('edits the existing category limit and requires confirmation before removing it', async () => {
  getBudgets.mockResolvedValue([dining]);
  removeBudget.mockResolvedValue(null);
  render(<Budgets refreshKey={0} />);
  fireEvent.click(await screen.findByRole('button', { name:'Edit Dining budget' }));
  expect(screen.getByLabelText('Spending category').value).toBe('DINING');
  expect(screen.getByLabelText('Monthly limit ($)').value).toBe('100');
  fireEvent.click(screen.getByRole('button', { name:'Remove Dining budget' }));
  expect(removeBudget).not.toHaveBeenCalled();
  getBudgets.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name:'Confirm remove Dining budget' }));
  await screen.findByText('Start with one category');
  expect(removeBudget).toHaveBeenCalledWith(expect.any(String), 'DINING');
});
it('loads a new month independently and ignores a stale response', async () => {
  let resolveOld;
  getBudgets.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue([]);
  render(<Budgets refreshKey={0} />);
  fireEvent.change(screen.getByLabelText('Budget month'), { target:{ value:'2027-03' } });
  await screen.findByText('Start with one category');
  resolveOld([dining]);
  await waitFor(() => expect(getBudgets).toHaveBeenLastCalledWith('2027-03'));
  expect(screen.queryByRole('progressbar')).toBeNull();
});
it('surfaces save errors without claiming success', async () => {
  saveBudget.mockRejectedValue(new Error('Budget could not be saved.'));
  render(<Budgets refreshKey={0} />);
  await screen.findByText('Start with one category');
  fireEvent.change(screen.getByLabelText('Monthly limit ($)'), { target:{ value:'100' } });
  fireEvent.click(screen.getByRole('button', { name:'Save limit' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Budget could not be saved.');
  expect(screen.queryByText('Groceries budget saved.')).toBeNull();
});
it('reloads after a load failure', async () => {
  getBudgets.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([]);
  render(<Budgets refreshKey={0} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Offline');
  fireEvent.click(screen.getByRole('button', { name:'Reload budgets' }));
  await screen.findByText('Start with one category');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('copies limits into the selected month and refreshes its progress', async () => {
  render(<Budgets refreshKey={0} />);
  const month = '2027-01';
  fireEvent.change(screen.getByLabelText('Budget month'), { target: { value: month } });
  await screen.findByText('Start with one category');
  copyPreviousMonthBudgets.mockResolvedValue({ copied: 1 });
  getBudgets.mockResolvedValue([dining]);
  fireEvent.click(screen.getByRole('button', { name: 'Copy last month’s limits' }));
  expect(await screen.findByText('Copied 1 budget limit from the previous month.')).toBeTruthy();
  expect(copyPreviousMonthBudgets).toHaveBeenCalledWith(month);
  expect(await screen.findByRole('progressbar', { name: 'Dining budget used' })).toBeTruthy();
});
