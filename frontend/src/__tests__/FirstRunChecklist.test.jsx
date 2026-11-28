import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FirstRunChecklist from "../components/FirstRunChecklist";

const getBudgets = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ getBudgets }));

beforeEach(() => {
  window.localStorage.clear();
  getBudgets.mockReset();
});
afterEach(() => cleanup());

function show(props = {}) {
  return render(<FirstRunChecklist hasTransactions hasGoal={false} monthKey="2026-11"
    onBudgets={() => {}} onGoals={() => {}} refreshKey={0} {...props} />);
}

describe("FirstRunChecklist", () => {
  it("lists what is left to do and links to it", async () => {
    getBudgets.mockResolvedValue([]);
    const onBudgets = vi.fn();
    show({ onBudgets });
    expect(await screen.findByText("Get set up (1 of 3 done)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Set a budget" }));
    expect(onBudgets).toHaveBeenCalled();
  });

  it("ticks off a budget that already exists", async () => {
    getBudgets.mockResolvedValue([{ category: "DINING" }]);
    show();
    expect(await screen.findByText("Get set up (2 of 3 done)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Set a budget" })).toBeNull();
  });

  it("goes away when everything is done", async () => {
    getBudgets.mockResolvedValue([{ category: "DINING" }]);
    const { container } = show({ hasGoal: true });
    await vi.waitFor(() => expect(getBudgets).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("can be hidden and stays hidden", async () => {
    getBudgets.mockResolvedValue([]);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Hide this" }));
    expect(screen.queryByText(/Get set up/)).toBeNull();
    cleanup();
    show();
    await vi.waitFor(() => expect(getBudgets).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Get set up/)).toBeNull();
  });
});
