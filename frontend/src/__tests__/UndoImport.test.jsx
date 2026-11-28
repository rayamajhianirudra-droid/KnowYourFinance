import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import UploadStatement from "../components/UploadStatement";
import { importedIds, rememberImport, lastImport, forgetImport } from "../utils/lastImport";

const deleteTransaction = vi.fn();
vi.mock("../api", () => ({
  uploadStatements: vi.fn(),
  listTransactions: vi.fn(async () => [{ id: 1 }]),
  deleteTransaction: (...args) => deleteTransaction(...args),
  MAX_UPLOAD_FILES: 12,
  ACCEPTED_EXTENSIONS: [".csv"],
}));

beforeEach(() => {
  window.localStorage.clear();
  deleteTransaction.mockReset();
  deleteTransaction.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe("lastImport helpers", () => {
  it("collects ids from every successful file", () => {
    const response = { files: [
      { success: true, result: { transactions: [{ id: 1 }, { id: 2 }] } },
      { success: false, message: "bad" },
      { success: true, result: { transactions: [{ id: 3 }] } },
    ] };
    expect(importedIds(response)).toEqual([1, 2, 3]);
  });

  it("remembers and forgets", () => {
    rememberImport([4, 5]);
    expect(lastImport().ids).toEqual([4, 5]);
    forgetImport();
    expect(lastImport()).toBeNull();
  });
});

describe("Undo last import", () => {
  it("is offered after a refresh and deletes exactly those transactions", async () => {
    rememberImport([10, 11, 12]);
    const onImported = vi.fn();
    render(<UploadStatement onImported={onImported} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo last import" }));
    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledTimes(3));
    expect(deleteTransaction.mock.calls.map((c) => c[0])).toEqual([10, 11, 12]);
    expect(await screen.findByText(/Removed the 3 transactions/)).toBeTruthy();
    expect(lastImport()).toBeNull();
    expect(onImported).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Undo last import" })).toBeNull();
  });

  it("is not shown when nothing was imported", () => {
    render(<UploadStatement onImported={() => {}} />);
    expect(screen.queryByRole("button", { name: "Undo last import" })).toBeNull();
  });
});
