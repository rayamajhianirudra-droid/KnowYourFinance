import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import UploadStatement from "../components/UploadStatement";

const uploadStatements = vi.fn();
vi.mock("../api", () => ({
  uploadStatements: (...args) => uploadStatements(...args),
  listTransactions: vi.fn(async () => [{ id: 1 }]),
  deleteTransaction: vi.fn(),
  MAX_UPLOAD_FILES: 12,
  ACCEPTED_EXTENSIONS: [".csv"],
}));

function response(type) {
  const rows = Array.from({ length: 6 }, (_, i) => ({ date: `2026-11-0${i + 1}`, description: `SHOP ${i}`, amount: 10, type }));
  return { files: [{ fileName: "card.csv", success: true, result: { rowsParsed: 6, transactionsSaved: 6, duplicatesSkipped: 0, rowsRedacted: 0, rowsSkipped: 0, transactions: rows } }] };
}

beforeEach(() => { window.localStorage.clear(); uploadStatements.mockReset(); });
afterEach(() => cleanup());

describe("a statement that looks upside down", () => {
  it("offers to swap and previews again with a corrected copy", async () => {
    uploadStatements.mockResolvedValueOnce(response("INCOME")).mockResolvedValueOnce(response("EXPENSE"));
    const { container } = render(<UploadStatement onImported={() => {}} />);
    const file = new File(["Date,Description,Amount\n2026-11-01,SHOP,10.00\n"], "card.csv", { type: "text/csv" });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    expect(await screen.findByText(/Almost everything was read as income/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Swap income and expenses" }));

    await waitFor(() => expect(uploadStatements).toHaveBeenCalledTimes(2));
    const sent = uploadStatements.mock.calls[1][0][0];
    expect(await sent.text()).toBe("Date,Description,Amount\n2026-11-01,SHOP,-10.00\n");
    await waitFor(() => expect(screen.queryByText(/Almost everything was read as income/)).toBeNull());
    expect(screen.getByText(/Your original files were not changed/)).toBeTruthy();
  });
});
