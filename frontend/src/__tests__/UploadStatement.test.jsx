import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UploadStatement from "../components/UploadStatement";
import { summarizeBatch } from "../utils/uploadSummary";
import * as api from "../api";

// Keep the real constants (the 12 file cap) but replace the network call.
vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, uploadStatements: vi.fn() };
});

function makeFile(name) {
  return new File(["Date,Description,Amount\n"], name, { type: "text/csv" });
}

function okFile(fileName, dates = ["2026-01-05", "2026-01-20"]) {
  return {
    fileName,
    success: true,
    message: null,
    result: {
      transactionsSaved: 2,
      rowsRedacted: 1,
      duplicatesSkipped: 0,
      rowsSkipped: 0,
      transactions: [
        { date: dates[0], type: "INCOME", amount: 100 },
        { date: dates[1], type: "EXPENSE", amount: 40 },
      ],
    },
  };
}

function badFile(fileName, message) {
  return { fileName, success: false, message, result: null };
}

function chooseFiles(files) {
  fireEvent.change(screen.getByTestId("statement-input"), { target: { files } });
}

beforeEach(() => vi.clearAllMocks());

describe("choosing statements", () => {
  it("lets the user pick many files and says how many are allowed", () => {
    render(<UploadStatement />);
    const input = screen.getByTestId("statement-input");
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe(".csv,.tsv,.txt,.xlsx");
    expect(screen.getByText(/up to 12 files here/i)).toBeTruthy();
    expect(screen.getByText(/Supported formats: CSV, TSV, TXT or Excel/)).toBeTruthy();
  });

  it("previews every chosen file without saving", async () => {
    api.uploadStatements.mockResolvedValue({
      files: [okFile("jan.csv"), okFile("feb.xlsx", ["2026-02-03", "2026-02-25"])],
    });
    render(<UploadStatement />);

    chooseFiles([makeFile("jan.csv"), makeFile("feb.xlsx")]);

    await screen.findByText("Review before saving");
    expect(api.uploadStatements).toHaveBeenCalledTimes(1);
    expect(api.uploadStatements.mock.calls[0][1]).toEqual({ preview: true });
    expect(screen.getByText("jan.csv")).toBeTruthy();
    expect(screen.getByText("feb.xlsx")).toBeTruthy();
    // Totals add up across the two files: 2 + 2 transactions, one date range.
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("2026-01-05 – 2026-02-25")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confirm & save 2 files/ })).toBeTruthy();
  });
});

describe("the 12 file cap", () => {
  it("sends only the first 12 files and tells the user about the rest", async () => {
    api.uploadStatements.mockResolvedValue({ files: [okFile("m1.csv")] });
    render(<UploadStatement />);

    chooseFiles(Array.from({ length: 14 }, (_, i) => makeFile(`m${i + 1}.csv`)));

    await screen.findByText("Review before saving");
    expect(api.uploadStatements.mock.calls[0][0]).toHaveLength(12);
    expect(screen.getByText(/You chose 14 files\. Only the first 12 were added/)).toBeTruthy();
  });

  it("does not show the warning for exactly 12 files", async () => {
    api.uploadStatements.mockResolvedValue({ files: [okFile("m1.csv")] });
    render(<UploadStatement />);

    chooseFiles(Array.from({ length: 12 }, (_, i) => makeFile(`m${i + 1}.csv`)));

    await screen.findByText("Review before saving");
    expect(api.uploadStatements.mock.calls[0][0]).toHaveLength(12);
    expect(screen.queryByText(/Only the first/)).toBeNull();
  });
});

describe("one bad file in the batch", () => {
  it("shows why it failed and saves only the files that could be read", async () => {
    api.uploadStatements
      .mockResolvedValueOnce({
        files: [okFile("good.csv"), badFile("notes.pdf", '"notes.pdf" is not a supported file type. Use CSV, TSV, TXT or XLSX.')],
      })
      .mockResolvedValueOnce({ files: [okFile("good.csv")] });
    const onImported = vi.fn();
    render(<UploadStatement onImported={onImported} />);

    chooseFiles([makeFile("good.csv"), makeFile("notes.pdf")]);

    await screen.findByText("Review before saving");
    expect(screen.getByRole("alert").textContent).toContain("not a supported file type");
    expect(screen.getByText(/1 file can't be imported/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Confirm & save/ }));

    await screen.findByText("Statement imported");
    const [sentFiles, options] = api.uploadStatements.mock.calls[1];
    expect(sentFiles.map((f) => f.name)).toEqual(["good.csv"]);
    expect(options).toEqual({ preview: false });
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  it("cannot be confirmed when no file could be read", async () => {
    api.uploadStatements.mockResolvedValue({ files: [badFile("a.pdf", "Not supported")] });
    render(<UploadStatement />);

    chooseFiles([makeFile("a.pdf")]);

    await screen.findByText("Review before saving");
    expect(screen.getByRole("button", { name: /Confirm & save/ }).disabled).toBe(true);
  });
});

describe("saving and errors", () => {
  it("says so when the same file is uploaded again and does not allow saving", async () => {
    api.uploadStatements.mockResolvedValue({
      files: [{
        fileName: "jan.csv",
        success: true,
        message: null,
        result: { rowsParsed: 10, transactionsSaved: 0, rowsRedacted: 0, duplicatesSkipped: 10, rowsSkipped: 0, transactions: [] },
      }],
    });
    render(<UploadStatement />);

    chooseFiles([makeFile("jan.csv")]);

    await screen.findByText("Review before saving");
    expect(screen.getAllByText(/already imported/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Confirm & save/ }).disabled).toBe(true);
  });

  it("shows a summary for every file after saving", async () => {
    api.uploadStatements.mockResolvedValue({ files: [okFile("jan.csv"), okFile("feb.csv", ["2026-02-01", "2026-02-02"])] });
    render(<UploadStatement />);
    chooseFiles([makeFile("jan.csv"), makeFile("feb.csv")]);
    await screen.findByText("Review before saving");

    fireEvent.click(screen.getByRole("button", { name: /Confirm & save 2 files/ }));

    await screen.findByText("Statements imported");
    expect(screen.getByText(/from 2 files/)).toBeTruthy();
    expect(screen.getAllByText(/Added: 2 transactions/)).toHaveLength(2);
  });

  it("shows the backend's message when the whole request is rejected", async () => {
    api.uploadStatements.mockRejectedValue(new Error("You can upload at most 12 files at a time. You chose 13."));
    render(<UploadStatement />);

    chooseFiles([makeFile("a.csv")]);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("at most 12 files"));
  });

  it("Cancel returns to the empty upload screen", async () => {
    api.uploadStatements.mockResolvedValue({ files: [okFile("jan.csv")] });
    render(<UploadStatement />);
    chooseFiles([makeFile("jan.csv")]);
    await screen.findByText("Review before saving");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText(/up to 12 files here/i)).toBeTruthy();
  });
});

describe("summarizeBatch", () => {
  it("adds up only the files that worked", () => {
    const summary = summarizeBatch({ files: [okFile("a.csv"), badFile("b.pdf", "no")] });
    expect(summary.okCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.count).toBe(2);
    expect(summary.totalIncome).toBe(100);
    expect(summary.totalExpenses).toBe(40);
  });
});
