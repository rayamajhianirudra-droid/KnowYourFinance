import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TransactionList from "../components/TransactionList";

const api = vi.hoisted(() => ({
  listTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  joinSplit: vi.fn(),
  splitTransaction: vi.fn(),
  listRules: vi.fn(),
  saveRule: vi.fn(),
  deleteRule: vi.fn(),
  addTransaction: vi.fn(),
}));
vi.mock("../api", () => api);

const rows = [
  { id: 1, date: "2026-11-01", description: "AAA", amount: 10, type: "EXPENSE", category: "OTHER" },
  { id: 2, date: "2026-11-02", description: "BBB", amount: 20, type: "EXPENSE", category: "OTHER" },
  { id: 3, date: "2026-11-03", description: "CCC", amount: 30, type: "EXPENSE", category: "DINING" },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.listTransactions.mockResolvedValue(rows);
  api.listRules.mockResolvedValue([]);
  api.updateTransaction.mockImplementation(async (id, body) => ({ ...body, id }));
});
afterEach(() => cleanup());

describe("choosing several transactions", () => {
  it("moves the selected ones to a category in one go", async () => {
    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    fireEvent.click(await screen.findByLabelText("Select AAA"));
    fireEvent.click(screen.getByLabelText("Select BBB"));
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Category for the selected transactions"), { target: { value: "SHOPPING" } });
    fireEvent.click(screen.getByRole("button", { name: "Move selected" }));
    expect(await screen.findByText("Moved 2 transactions to Shopping.")).toBeTruthy();
    expect(api.updateTransaction).toHaveBeenCalledTimes(2);
    expect(api.updateTransaction.mock.calls[0][1].category).toBe("SHOPPING");
    expect(screen.queryByText("2 selected")).toBeNull();
  });

  it("selects everything shown", async () => {
    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    fireEvent.click(await screen.findByLabelText("Select all shown transactions"));
    expect(screen.getByText("3 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    await waitFor(() => expect(screen.queryByText("3 selected")).toBeNull());
  });

  it("reports the ones that could not be changed", async () => {
    api.updateTransaction.mockImplementation(async (id, body) => {
      if (id === 2) throw new Error("nope");
      return { ...body, id };
    });
    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    fireEvent.click(await screen.findByLabelText("Select AAA"));
    fireEvent.click(screen.getByLabelText("Select BBB"));
    fireEvent.click(screen.getByRole("button", { name: "Move selected" }));
    expect(await screen.findByText(/Moved 1, but 1 could not be changed/)).toBeTruthy();
  });
});
