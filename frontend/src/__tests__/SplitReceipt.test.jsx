import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SplitDialog from "../components/SplitDialog";
import TransactionList from "../components/TransactionList";
import { joinSplit, splitTransaction } from "../api";
import { fromCents, remainingCents, splitIsValid, toCents, toSplitParts } from "../utils/split";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(handler) {
  const fetchMock = vi.fn(async (url, options = {}) => {
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

const walmart = {
  id: 5,
  date: "2026-09-03",
  description: "WALMART SUPERCENTER",
  amount: 200,
  type: "EXPENSE",
  category: "GROCERIES",
  lowConfidence: false,
};

describe("split money maths", () => {
  it("reads typed amounts as whole cents", () => {
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("19.99")).toBe(1999);
    expect(toCents("")).toBeNull();
    expect(toCents("abc")).toBeNull();
    expect(toCents("-5")).toBeNull();
    expect(toCents("1.234")).toBeNull();
    expect(fromCents(8000)).toBe("80.00");
  });

  it("is not fooled by floating point rounding", () => {
    const lines = [{ amount: "0.1" }, { amount: "0.2" }];
    expect(remainingCents(30, lines)).toBe(0);
    expect(splitIsValid(30, lines)).toBe(true);
  });

  it("needs two lines, positive amounts and an exact total", () => {
    expect(splitIsValid(20000, [{ amount: "200" }])).toBe(false);
    expect(splitIsValid(20000, [{ amount: "80" }, { amount: "100" }])).toBe(false);
    expect(splitIsValid(20000, [{ amount: "80" }, { amount: "130" }])).toBe(false);
    expect(splitIsValid(20000, [{ amount: "80" }, { amount: "" }])).toBe(false);
    expect(splitIsValid(20000, [{ amount: "200" }, { amount: "0" }])).toBe(false);
    expect(splitIsValid(20000, [{ amount: "80" }, { amount: "120" }])).toBe(true);
  });

  it("shapes lines into the request body", () => {
    expect(toSplitParts([{ label: " Food ", category: "GROCERIES", amount: "80" }]))
      .toEqual([{ amount: "80.00", category: "GROCERIES", label: "Food" }]);
  });
});

describe("split api", () => {
  it("posts the parts to the split endpoint", async () => {
    const fetchMock = stubFetch(() => ({ body: [{ id: 5 }, { id: 6 }] }));
    const parts = [{ amount: "80.00", category: "GROCERIES", label: "Food" }];
    expect(await splitTransaction(5, parts)).toEqual([{ id: 5 }, { id: 6 }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/transactions/5/split");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ parts });
  });

  it("shows the reason the server gives when a split is refused", async () => {
    stubFetch(() => ({ ok: false, status: 400, body: { message: "The lines add up to 180 but the receipt total is 200." } }));
    await expect(splitTransaction(5, [])).rejects.toThrow("The lines add up to 180");
  });

  it("joins with a DELETE request", async () => {
    const fetchMock = stubFetch(() => ({ body: { id: 6 } }));
    await joinSplit(6);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/transactions/6/split");
    expect(options.method).toBe("DELETE");
  });
});

describe("SplitDialog", () => {
  function fill(index, { label, category, amount }) {
    if (label !== undefined) fireEvent.change(screen.getByLabelText(`Line ${index} label`), { target: { value: label } });
    if (category) fireEvent.change(screen.getByLabelText(`Line ${index} category`), { target: { value: category } });
    if (amount !== undefined) fireEvent.change(screen.getByLabelText(`Line ${index} amount`), { target: { value: amount } });
  }

  it("keeps Save disabled until the lines add up to the receipt", () => {
    render(<SplitDialog transaction={walmart} onClose={() => {}} onSplit={() => {}} />);
    const save = screen.getByRole("button", { name: "Save split" });
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("$200.00 left to assign");

    fill(1, { amount: "80" });
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("$120.00 left to assign");

    fill(2, { amount: "150" });
    expect(screen.getByRole("status").textContent).toContain("$30.00 too much");
    expect(save.disabled).toBe(true);

    fill(2, { amount: "120" });
    expect(screen.getByRole("status").textContent).toContain("Every dollar is assigned");
    expect(save.disabled).toBe(false);
  });

  it("fills in whatever is left with the Rest button", () => {
    render(<SplitDialog transaction={walmart} onClose={() => {}} onSplit={() => {}} />);
    fill(1, { amount: "75.25" });
    fireEvent.click(screen.getByRole("button", { name: "Put the rest on line 2" }));
    expect(screen.getByLabelText("Line 2 amount").value).toBe("124.75");
  });

  it("sends the lines and reports the new rows", async () => {
    const created = [{ id: 5, description: "WALMART SUPERCENTER - Food" }, { id: 6, description: "WALMART SUPERCENTER - TV" }];
    const fetchMock = stubFetch(() => ({ body: created }));
    const onSplit = vi.fn();
    render(<SplitDialog transaction={walmart} onClose={() => {}} onSplit={onSplit} />);

    fill(1, { label: "Food", category: "GROCERIES", amount: "80" });
    fill(2, { label: "TV", category: "SHOPPING", amount: "120" });
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));

    await waitFor(() => expect(onSplit).toHaveBeenCalledWith(5, created));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).parts).toEqual([
      { amount: "80.00", category: "GROCERIES", label: "Food" },
      { amount: "120.00", category: "SHOPPING", label: "TV" },
    ]);
  });

  it("adds and removes lines but never goes below two", () => {
    render(<SplitDialog transaction={walmart} onClose={() => {}} onSplit={() => {}} />);
    expect(screen.queryByRole("button", { name: "Remove line 1" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Add another line/ }));
    expect(screen.getByLabelText("Line 3 amount")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove line 3" }));
    expect(screen.queryByLabelText("Line 3 amount")).toBeNull();
  });

  it("shows the server message when the split is refused", async () => {
    stubFetch(() => ({ ok: false, status: 400, body: { message: "This receipt is already split. Join it back first." } }));
    render(<SplitDialog transaction={walmart} onClose={() => {}} onSplit={() => {}} />);
    fill(1, { amount: "80" });
    fill(2, { amount: "120" });
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already split");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<SplitDialog transaction={walmart} onClose={onClose} onSplit={() => {}} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("splitting from the transaction list", () => {
  it("replaces the receipt with its lines and can join them back", async () => {
    const food = { ...walmart, id: 5, description: "WALMART SUPERCENTER - Food", amount: 80, splitGroup: "g1", splitSourceAmount: 200 };
    const tv = { ...walmart, id: 6, description: "WALMART SUPERCENTER - TV", amount: 120, category: "SHOPPING", splitGroup: "g1", splitSourceAmount: 200 };
    const joined = { ...walmart, id: 6, category: "SHOPPING" };

    stubFetch((url, options) => {
      if (url.endsWith("/split") && options.method === "POST") return { body: [food, tv] };
      if (url.endsWith("/split") && options.method === "DELETE") return { body: joined };
      return { body: [walmart] };
    });

    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Split WALMART SUPERCENTER" }));
    fireEvent.change(screen.getByLabelText("Line 1 label"), { target: { value: "Food" } });
    fireEvent.change(screen.getByLabelText("Line 1 amount"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Line 2 label"), { target: { value: "TV" } });
    fireEvent.change(screen.getByLabelText("Line 2 amount"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));

    expect(await screen.findByText("WALMART SUPERCENTER - TV")).toBeTruthy();
    expect(screen.getByText("WALMART SUPERCENTER - Food")).toBeTruthy();
    expect(screen.getAllByText("split").length).toBe(2);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Join split receipt WALMART SUPERCENTER - TV" }));
    await waitFor(() => expect(screen.queryByText("WALMART SUPERCENTER - Food")).toBeNull());
    expect(screen.getByText("WALMART SUPERCENTER")).toBeTruthy();
    expect(screen.queryAllByText("split").length).toBe(0);
  });
});
