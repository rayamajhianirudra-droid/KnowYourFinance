import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Budgets from '../components/Budgets';
import { clearBudgetMonth, getBudgets } from '../api';

vi.mock('../api', () => ({ clearBudgetMonth: vi.fn(), getBudgets: vi.fn() }));
afterEach(cleanup);
const dining = { category: 'DINING', limitAmount: 100, spent: 85, remaining: 15, percentUsed: 85, status: 'WARNING' };

it('confirms clearing all limits before refreshing only the selected month', async () => {
  getBudgets.mockResolvedValue([dining]);
  clearBudgetMonth.mockResolvedValue({ removed: 1 });
  render(<Budgets refreshKey={0} />);

  fireEvent.change(screen.getByLabelText('Budget month'), { target: { value: '2027-01' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Clear all limits' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(clearBudgetMonth).not.toHaveBeenCalled();

  getBudgets.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Clear all limits' }));
  expect(screen.getByText(/Clear all budget limits for January 2027/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm clear all limits' }));
  expect(await screen.findByText('Start with one category')).toBeTruthy();
  expect(clearBudgetMonth).toHaveBeenCalledExactlyOnceWith('2027-01');
  expect(screen.getByText('Cleared all budget limits for January 2027.')).toBeTruthy();
});
