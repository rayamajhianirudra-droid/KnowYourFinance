import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResetDataDialog from "../components/ResetDataDialog";
import ProfileBadge from "../components/ProfileBadge";
import { getDataSummary, resetData } from "../api";
import { transactionsToCsv } from "../utils/csvExport";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(handler) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/csrf") return { ok: true, json: async () => ({ headerName: "X-CSRF-TOKEN", token: "mock-token" }) };
    const result = handler(String(url), options);
    return {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      json: async () => result.body,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("reset data api", () => {
  it("asks for the summary of the current user", async () => {
    const fetchMock = stubFetch(() => ({ body: { transactions: 4, budgets: 2 } }));
    expect(await getDataSummary()).toEqual({ transactions: 4, budgets: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/data/summary");
  });

  it("sends the confirm word with a DELETE request", async () => {
    const fetchMock = stubFetch(() => ({ body: { deletedTransactions: 4, deletedBudgets: 2, nameRemoved: false } }));
    await resetData();
    const [url, options] = fetchMock.mock.calls.at(-1);
    expect(url).toBe("/api/data?confirm=DELETE&includeName=false");
    expect(options.method).toBe("DELETE");
  });

  it("passes on the message when the server refuses", async () => {
    stubFetch(() => ({ ok: false, status: 400, body: { message: "Type DELETE to confirm." } }));
    await expect(resetData()).rejects.toThrow("Type DELETE to confirm.");
  });
});

describe("ResetDataDialog", () => {
  let handlers;
  beforeEach(() => {
    handlers = { onClose: vi.fn(), onDeleted: vi.fn(), onUpload: vi.fn() };
  });

  function open(summary, { hasName = false } = {}) {
    const fetchMock = stubFetch((url, options) => {
      if (options.method === "DELETE") {
        return { body: { deletedTransactions: summary.transactions, deletedBudgets: summary.budgets, nameRemoved: false } };
      }
      return { body: summary };
    });
    render(<ResetDataDialog hasName={hasName} {...handlers} />);
    return fetchMock;
  }

  it("says exactly what will be removed and keeps delete disabled until DELETE is typed", async () => {
    open({ transactions: 38, budgets: 1 });
    expect(await screen.findByText(/removes 38 transactions and 1 budget\./)).toBeTruthy();

    const button = screen.getByRole("button", { name: "Delete everything" });
    expect(button.disabled).toBe(true);

    const input = screen.getByLabelText(/Type DELETE to confirm/);
    fireEvent.change(input, { target: { value: "delete" } });
    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(button.disabled).toBe(false);
  });

  it("deletes, reports the result and offers to upload a fresh statement", async () => {
    const fetchMock = open({ transactions: 3, budgets: 0 });
    fireEvent.change(await screen.findByLabelText(/Type DELETE to confirm/), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete everything" }));

    expect(await screen.findByText(/Your data has been removed/)).toBeTruthy();
    expect(handlers.onDeleted).toHaveBeenCalledWith({ deletedTransactions: 3, deletedBudgets: 0, nameRemoved: false });
    const deleteCall = fetchMock.mock.calls.find(([, options]) => options?.method === "DELETE");
    expect(deleteCall[0]).toContain("includeName=false");

    fireEvent.click(screen.getByRole("button", { name: "Upload a statement" }));
    expect(handlers.onUpload).toHaveBeenCalled();
  });

  it("can also remove the saved name when asked", async () => {
    const fetchMock = open({ transactions: 3, budgets: 0 }, { hasName: true });
    fireEvent.click(await screen.findByLabelText(/Also remove my saved name/));
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    await screen.findByText(/Your data has been removed/);
    const deleteCall = fetchMock.mock.calls.find(([, options]) => options?.method === "DELETE");
    expect(deleteCall[0]).toContain("includeName=true");
  });

  it("does not offer to delete when nothing is saved", async () => {
    open({ transactions: 0, budgets: 0 });
    expect(await screen.findByText(/nothing to delete/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete everything" })).toBeNull();
  });

  it("shows the server's message and keeps the data screen open when deleting fails", async () => {
    stubFetch((url, options) => options.method === "DELETE"
      ? { ok: false, status: 500, body: { message: "Something went wrong." } }
      : { body: { transactions: 2, budgets: 0 } });
    render(<ResetDataDialog hasName={false} {...handlers} />);
    fireEvent.change(await screen.findByLabelText(/Type DELETE to confirm/), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong.");
    expect(handlers.onDeleted).not.toHaveBeenCalled();
  });

  it("closes with Cancel and with Escape", async () => {
    open({ transactions: 2, budgets: 0 });
    await screen.findByLabelText(/Type DELETE to confirm/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handlers.onClose).toHaveBeenCalledTimes(2);
  });
});

describe("profile menu entry", () => {
  it("offers the delete option and closes the menu when it is chosen", async () => {
    const onDeleteData = vi.fn();
    render(<ProfileBadge fullName="AJ Rayamajhi" onSaved={() => {}} onDeleteData={onDeleteData} />);
    fireEvent.click(screen.getByRole("button", { name: /Your profile/ }));
    fireEvent.click(screen.getByRole("button", { name: /Delete all my data/ }));
    expect(onDeleteData).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Delete all my data/ })).toBeNull());
  });
});

describe("csv backup", () => {
  it("writes expenses as negative numbers and guards against formulas", () => {
    const csv = transactionsToCsv([
      { date: "2026-11-01", description: "=HYPERLINK(1)", category: "SHOPPING", type: "EXPENSE", amount: "12.5" },
      { date: "2026-11-02", description: "Pay", category: "INCOME", type: "INCOME", amount: 100 },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Date","Description","Category","Type","Amount"');
    expect(lines[1]).toBe('"2026-11-01","\'=HYPERLINK(1)","Shopping","EXPENSE",-12.5');
    expect(lines[2]).toBe('"2026-11-02","Pay","Income","INCOME",100');
  });
});
