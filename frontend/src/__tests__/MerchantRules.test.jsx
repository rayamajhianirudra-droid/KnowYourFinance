import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TransactionList from "../components/TransactionList";
import MerchantRules from "../components/MerchantRules";
import { deleteRule, listRules, saveRule } from "../api";
import { countOthers, isMixedStore, suggestPattern } from "../utils/merchant";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(handler) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const result = handler(String(url), options);
    return { ok: result.ok ?? true, status: result.status ?? 200, json: async () => result.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("merchant helpers", () => {
  it("turns a bank description into a short merchant name", () => {
    expect(suggestPattern("STARBUCKS #4521")).toBe("starbucks");
    expect(suggestPattern("WALMART SUPERCENTER 0042")).toBe("walmart");
    expect(suggestPattern("WHOLE FOODS MKT 10234")).toBe("whole foods");
    expect(suggestPattern("UBER *TRIP HELP.UBER.COM")).toBe("uber trip");
    expect(suggestPattern("TRADER JOE'S #123")).toBe("trader");
    expect(suggestPattern("12345 6789")).toBe("");
    expect(suggestPattern(null)).toBe("");
  });

  it("spots stores that sell everything", () => {
    expect(isMixedStore("WALMART SUPERCENTER")).toBe(true);
    expect(isMixedStore("Costco Wholesale #12")).toBe(true);
    expect(isMixedStore("STARBUCKS")).toBe(false);
    expect(isMixedStore(undefined)).toBe(false);
  });

  it("counts other matching transactions that would change", () => {
    const rows = [
      { id: 1, description: "STARBUCKS #1", category: "DINING" },
      { id: 2, description: "STARBUCKS #2", category: "OTHER" },
      { id: 3, description: "Starbucks Reserve", category: "ENTERTAINMENT" },
      { id: 4, description: "STARBUCKS split", category: "OTHER", splitGroup: "g" },
      { id: 5, description: "SHELL", category: "OTHER" },
    ];
    expect(countOthers(rows, "starbucks", "ENTERTAINMENT", 1)).toBe(1);
    expect(countOthers(rows, "s", "ENTERTAINMENT", 1)).toBe(0);
  });
});

describe("rules api", () => {
  it("loads, saves and removes rules for the current user", async () => {
    const fetchMock = stubFetch((url, options) => {
      if (options.method === "POST") return { body: { rule: { id: 3, pattern: "walmart", category: "SHOPPING" }, updated: 2 } };
      if (options.method === "DELETE") return { body: null };
      return { body: [{ id: 3, pattern: "walmart", category: "SHOPPING" }] };
    });

    expect(await listRules()).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/rules?userId=1");

    const saved = await saveRule({ pattern: "walmart", category: "SHOPPING", applyToExisting: true });
    expect(saved.updated).toBe(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/rules?userId=1");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      pattern: "walmart", category: "SHOPPING", applyToExisting: true,
    });

    await deleteRule(3);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/rules/3?userId=1");
    expect(fetchMock.mock.calls[2][1].method).toBe("DELETE");
  });

  it("shows the reason when a rule is refused", async () => {
    stubFetch(() => ({ ok: false, status: 400, body: { message: "Choose a category." } }));
    await expect(saveRule({ pattern: "walmart" })).rejects.toThrow("Choose a category.");
  });
});

describe("MerchantRules panel", () => {
  it("explains how to make a rule when there are none", () => {
    render(<MerchantRules rules={[]} onRemove={() => {}} />);
    expect(screen.getByText(/No rules yet/)).toBeTruthy();
  });

  it("lists rules and removes one", () => {
    const onRemove = vi.fn();
    const rule = { id: 4, pattern: "walmart", category: "SHOPPING" };
    render(<MerchantRules rules={[rule]} onRemove={onRemove} />);
    expect(screen.getByText("walmart")).toBeTruthy();
    expect(screen.getByText("Shopping")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove rule for walmart" }));
    expect(onRemove).toHaveBeenCalledWith(rule);
  });
});

describe("remembering a merchant from the transaction list", () => {
  const rows = [
    { id: 1, date: "2026-09-01", description: "STARBUCKS #4521", amount: 5, type: "EXPENSE", category: "DINING" },
    { id: 2, date: "2026-09-02", description: "STARBUCKS #77", amount: 6, type: "EXPENSE", category: "OTHER" },
  ];

  it("offers to remember, applies it to the others and shows the saved rule", async () => {
    let after = false;
    const fetchMock = stubFetch((url, options) => {
      if (url.startsWith("/api/rules") && options.method === "POST") {
        after = true;
        return { body: { rule: { id: 9, pattern: "starbucks", category: "ENTERTAINMENT" }, updated: 1 } };
      }
      if (url.startsWith("/api/rules")) return { body: [] };
      if (url.startsWith("/api/transactions/1") && options.method === "PUT") {
        return { body: { ...rows[0], category: "ENTERTAINMENT" } };
      }
      return { body: after ? rows.map((r) => ({ ...r, category: "ENTERTAINMENT" })) : rows };
    });

    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    const select = await screen.findByLabelText("Category for STARBUCKS #4521");
    fireEvent.change(select, { target: { value: "ENTERTAINMENT" } });

    const input = await screen.findByLabelText("Merchant name to remember");
    expect(input.value).toBe("starbucks");
    expect(screen.getByText(/Also change 1 other matching transaction/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Yes, remember it" }));

    expect((await screen.findByRole("status")).textContent).toContain("1 other transaction moved to Entertainment");
    const post = fetchMock.mock.calls.find(([, o]) => o?.method === "POST" && String(fetchMock.mock.calls).includes("rules"));
    expect(JSON.parse(post[1].body)).toEqual({ pattern: "starbucks", category: "ENTERTAINMENT", applyToExisting: true });
    expect(screen.queryByLabelText("Merchant name to remember")).toBeNull();
    expect(screen.getByText("My merchant rules")).toBeTruthy();
    expect((await screen.findByLabelText("Category for STARBUCKS #77")).value).toBe("ENTERTAINMENT");
  });

  it("can be dismissed without saving anything", async () => {
    const fetchMock = stubFetch((url, options) => {
      if (url.startsWith("/api/rules")) return { body: [] };
      if (options.method === "PUT") return { body: { ...rows[0], category: "ENTERTAINMENT" } };
      return { body: rows };
    });
    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Category for STARBUCKS #4521"), { target: { value: "ENTERTAINMENT" } });
    fireEvent.click(await screen.findByRole("button", { name: "Just this one" }));

    expect(screen.queryByLabelText("Merchant name to remember")).toBeNull();
    expect(fetchMock.mock.calls.some(([u, o]) => String(u).startsWith("/api/rules") && o?.method === "POST")).toBe(false);
  });

  it("does not ask again when the same rule already exists", async () => {
    stubFetch((url, options) => {
      if (url.startsWith("/api/rules")) return { body: [{ id: 1, pattern: "starbucks", category: "ENTERTAINMENT" }] };
      if (options.method === "PUT") return { body: { ...rows[0], category: "ENTERTAINMENT" } };
      return { body: rows };
    });
    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    await screen.findByText("1");
    fireEvent.change(await screen.findByLabelText("Category for STARBUCKS #4521"), { target: { value: "ENTERTAINMENT" } });
    await waitFor(() => expect(screen.getByLabelText("Category for STARBUCKS #4521").value).toBe("ENTERTAINMENT"));
    expect(screen.queryByLabelText("Merchant name to remember")).toBeNull();
  });

  it("hints at a split for stores that sell everything", async () => {
    stubFetch((url) => {
      if (url.startsWith("/api/rules")) return { body: [] };
      return { body: [{ id: 7, date: "2026-09-03", description: "WALMART SUPERCENTER", amount: 200, type: "EXPENSE", category: "GROCERIES" }] };
    });
    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mixed receipt? Split it" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
