import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../App";

// The app talks to the backend as soon as it opens, so give it a fake
// server that answers every request with an empty but valid reply.
beforeEach(() => {
  window.scrollTo = vi.fn();
  globalThis.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          String(url).includes("/dashboard/report")
            ? {
                totalIncome: 0, totalExpenses: 0, netSavings: 0,
                categoryBreakdown: [], insights: [], previousPeriodHasData: false,
              }
            : []
        ),
    })
  );
});

afterEach(() => {
  cleanup();
  delete globalThis.fetch;
});

describe("app navigation", () => {
  it("offers all four views by name, so screen readers and phone tab bars can use them", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Dashboard", "Upload Statement", "Add Transaction", "Transactions"]) {
      expect(within(nav).getByRole("button", { name })).toBeTruthy();
    }
  });

  it("starts on the Dashboard and marks it as the current page", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
  });

  it("switches views and moves the current page marker", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Upload Statement" }));
    expect(screen.getByRole("heading", { level: 1, name: "Upload Statement" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload Statement" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
  });

  it("scrolls to the top and focuses the page when the view changes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    expect(window.scrollTo).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById("main"));
  });

  it("has a skip link that jumps to the main content", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main");
  });
});

describe("upload page", () => {
  it("explains what is accepted and what is removed before anything is uploaded", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Upload Statement" }));
    expect(screen.getByText("What to upload")).toBeTruthy();
    expect(screen.getByText("What we remove")).toBeTruthy();
  });
});
