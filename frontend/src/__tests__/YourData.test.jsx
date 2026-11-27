import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YourData from "../components/YourData";
import { buildExport } from "../utils/exportData";
import { useIdleSignOut } from "../utils/useIdleSignOut";

const api = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  getProfile: vi.fn(),
  listGoals: vi.fn(),
  listRules: vi.fn(),
  listTransactions: vi.fn(),
}));
vi.mock("../api", () => api);

const downloads = vi.hoisted(() => ({ json: vi.fn(), csv: vi.fn() }));
vi.mock("../utils/exportData", async (original) => ({ ...(await original()), downloadJson: downloads.json }));
vi.mock("../utils/csvExport", () => ({ downloadTransactionsCsv: downloads.csv }));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  downloads.json.mockReset();
  downloads.csv.mockReset();
  api.listTransactions.mockResolvedValue([{ id: 1, description: "WALMART" }]);
  api.listGoals.mockResolvedValue([{ id: 2 }]);
  api.listRules.mockResolvedValue([{ id: 3, pattern: "walmart", category: "SHOPPING", userId: 9 }]);
  api.getProfile.mockResolvedValue({ fullName: "Sam Student" });
});
afterEach(() => cleanup());

describe("YourData", () => {
  it("says where the data lives", () => {
    render(<YourData email="a@b.test" onClose={() => {}} onDeleted={() => {}} />);
    expect(screen.getByText(/stored in the database on the computer that runs this app/)).toBeTruthy();
  });

  it("downloads everything without internal ids of rules", async () => {
    render(<YourData email="a@b.test" onClose={() => {}} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Download all my data" }));
    await waitFor(() => expect(downloads.json).toHaveBeenCalled());
    const [name, data] = downloads.json.mock.calls[0];
    expect(name).toMatch(/^know-your-finance-.*\.json$/);
    expect(data.transactions).toHaveLength(1);
    expect(data.merchantRules).toEqual([{ pattern: "walmart", category: "SHOPPING" }]);
    expect(data.account).toBe("a@b.test");
  });

  it("downloads a spreadsheet", async () => {
    render(<YourData email="a@b.test" onClose={() => {}} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Download transactions as a spreadsheet" }));
    await waitFor(() => expect(downloads.csv).toHaveBeenCalledWith([{ id: 1, description: "WALMART" }]));
  });

  it("asks for the password before deleting the account", async () => {
    api.deleteAccount.mockResolvedValue();
    const onDeleted = vi.fn();
    render(<YourData email="a@b.test" onClose={() => {}} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    const confirm = screen.getByRole("button", { name: "Permanently delete my account" });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Enter your password to confirm"), { target: { value: "hunter2 is long enough" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(api.deleteAccount).toHaveBeenCalledWith("hunter2 is long enough");
  });

  it("shows the reason when the password is wrong and keeps the account", async () => {
    api.deleteAccount.mockRejectedValue(new Error("That password is not correct."));
    const onDeleted = vi.fn();
    render(<YourData email="a@b.test" onClose={() => {}} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    fireEvent.change(screen.getByLabelText("Enter your password to confirm"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete my account" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("That password is not correct.")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

describe("buildExport", () => {
  it("handles missing pieces", () => {
    const data = buildExport({});
    expect(data.transactions).toEqual([]);
    expect(data.name).toBeNull();
  });
});

describe("useIdleSignOut", () => {
  it("signs out after the quiet period and restarts on activity", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const { unmount } = renderHook(() => useIdleSignOut(onIdle, 1000));
    act(() => { vi.advanceTimersByTime(900); });
    act(() => { window.dispatchEvent(new Event("keydown")); });
    act(() => { vi.advanceTimersByTime(900); });
    expect(onIdle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onIdle).toHaveBeenCalledTimes(1);
    unmount();
    vi.useRealTimers();
  });
});
