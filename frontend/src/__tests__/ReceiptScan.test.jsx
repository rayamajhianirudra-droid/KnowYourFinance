import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../utils/ocr", () => ({ readReceiptText: vi.fn() }));

import ReceiptScanner from "../components/ReceiptScanner";
import TransactionList from "../components/TransactionList";
import { readReceiptText } from "../utils/ocr";
import { buildLines, findDate, findMatches, parseReceipt } from "../utils/receipt";
import { itemCategorizer } from "../utils/itemCategory";

const WALMART_TEXT = `WALMART
Save money. Live better.
MANAGER JOHN SMITH
(507) 555-0100
123 MAIN ST MARSHALL MN
GV 2% MILK      007874 F   3.48
BANANAS         4011 F     1.24
SAMSUNG 43 TV   88123456 X  298.00
2 @ 1.50
EGGS LRG 18CT   0626 F     4.12
SUBTOTAL                  306.84
TAX 1  6.875 %             20.52
TOTAL                     327.36
VISA TEND                 327.36
CHANGE DUE                  0.00
09/03/26 14:22
# ITEMS SOLD 4`;

beforeEach(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:receipt"), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("reading receipt text", () => {
  it("finds the store, date, total, tax and items", () => {
    const parsed = parseReceipt(WALMART_TEXT);
    expect(parsed.merchant).toBe("WALMART");
    expect(parsed.date).toBe("2026-09-03");
    expect(parsed.total).toBe(327.36);
    expect(parsed.tax).toBe(20.52);
    expect(parsed.items.map((i) => i.amount)).toEqual([3.48, 1.24, 298, 4.12]);
    expect(parsed.items.map((i) => i.label)).toEqual(["GV 2% MILK", "BANANAS", "SAMSUNG 43 TV", "EGGS LRG 18CT"]);
  });

  it("drops the tax flag letter the register prints, in either case", () => {
    const parsed = parseReceipt("STORE\nSAMSUNG 43 TV x  298.00\nBANANAS F 1.24\nTOTAL 299.24");
    expect(parsed.items.map((i) => i.label)).toEqual(["SAMSUNG 43 TV", "BANANAS"]);
  });

  it("does not treat totals, payments or change as items", () => {
    const parsed = parseReceipt("CORNER CAFE\nLATTE 4.50\nSUBTOTAL 4.50\nTAX 0.31\nTOTAL 4.81\nCASH 10.00\nCHANGE 5.19");
    expect(parsed.items).toEqual([{ label: "LATTE", amount: 4.5 }]);
    expect(parsed.total).toBe(4.81);
  });

  it("works out the total when the receipt has none", () => {
    const parsed = parseReceipt("SHOP\nPEN 2.00\nPAD 3.00\nTAX 0.40");
    expect(parsed.total).toBe(5.4);
  });

  it("reads commas as decimal points and ignores empty text", () => {
    expect(parseReceipt("STORE\nAPPLES 3,50\nTOTAL 3,50").total).toBe(3.5);
    expect(parseReceipt("").items).toEqual([]);
    expect(parseReceipt(null).merchant).toBe("");
  });

  it("understands common date styles and refuses impossible ones", () => {
    expect(findDate("2026-09-03")).toBe("2026-09-03");
    expect(findDate("9/3/2026")).toBe("2026-09-03");
    expect(findDate("Sep 3, 2026")).toBe("2026-09-03");
    expect(findDate("13/45/26")).toBe("");
    expect(findDate("no date here")).toBe("");
  });

  it("adds one line for tax and anything else so the lines match the total", () => {
    const lines = buildLines(parseReceipt(WALMART_TEXT), itemCategorizer("WALMART"));
    expect(lines.at(-1)).toMatchObject({ label: "Tax", amount: "20.52" });
    const sum = lines.reduce((s, l) => s + Number(l.amount), 0);
    expect(sum).toBeCloseTo(327.36, 2);

    const other = buildLines({ total: 20, tax: null, items: [{ label: "PEN", amount: 5 }] }, itemCategorizer("X"));
    expect(other.at(-1)).toMatchObject({ label: "Tax and other", amount: "15.00" });
  });
});

describe("guessing an item's category", () => {
  it("knows food from a TV, and flags what it is unsure about", () => {
    const categorize = itemCategorizer("WALMART");
    expect(categorize("Bananas")).toEqual({ category: "GROCERIES", guessed: false });
    expect(categorize("Eggs Lrg 18ct")).toEqual({ category: "GROCERIES", guessed: false });
    expect(categorize("Samsung 43 Tv")).toEqual({ category: "SHOPPING", guessed: false });
    expect(categorize("Zzyzx Widget")).toEqual({ category: "SHOPPING", guessed: true });
    expect(itemCategorizer("KROGER")("Zzyzx Widget")).toEqual({ category: "GROCERIES", guessed: true });
    expect(itemCategorizer("STARBUCKS")("Latte").category).toBe("DINING");
  });
});

describe("matching a receipt to a charge on file", () => {
  const stored = [
    { id: 1, type: "EXPENSE", date: "2026-09-03", description: "WALMART SUPERCENTER", amount: 327.36 },
    { id: 2, type: "EXPENSE", date: "2026-09-04", description: "SOMETHING ELSE", amount: 327.36 },
    { id: 3, type: "EXPENSE", date: "2026-09-03", description: "WALMART", amount: 100 },
    { id: 4, type: "EXPENSE", date: "2026-09-03", description: "WALMART", amount: 327.36, splitGroup: "g" },
    { id: 5, type: "EXPENSE", date: "2026-05-01", description: "WALMART", amount: 327.36 },
    { id: 6, type: "INCOME", date: "2026-09-03", description: "WALMART", amount: 327.36 },
  ];

  it("keeps only unsplit expenses with the same total close in date, store first", () => {
    const found = findMatches(stored, { totalCents: 32736, date: "2026-09-03", merchant: "WALMART" });
    expect(found.map((t) => t.id)).toEqual([1, 2]);
  });

  it("finds nothing without a total", () => {
    expect(findMatches(stored, { totalCents: null, date: "", merchant: "" })).toEqual([]);
  });
});

function pickPhoto() {
  const input = screen.getByLabelText("Receipt photo");
  fireEvent.change(input, { target: { files: [new File(["x"], "receipt.jpg", { type: "image/jpeg" })] } });
}

function stubFetch(handler) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const result = handler(String(url), options);
    return { ok: result.ok ?? true, status: result.status ?? 200, json: async () => result.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const charge = { id: 7, type: "EXPENSE", date: "2026-09-03", description: "WALMART SUPERCENTER", amount: 327.36, category: "GROCERIES" };

describe("ReceiptScanner", () => {
  it("shows what it read and attaches the items to the matching charge", async () => {
    readReceiptText.mockResolvedValue(WALMART_TEXT);
    const fetchMock = stubFetch(() => ({ body: [] }));
    const onSaved = vi.fn();
    render(<ReceiptScanner transactions={[charge]} onClose={() => {}} onSaved={onSaved} />);

    pickPhoto();

    expect((await screen.findByLabelText("Store")).value).toBe("WALMART");
    expect(screen.getByLabelText("Receipt total").value).toBe("327.36");
    expect(screen.getByLabelText("Item 3 name").value).toBe("Samsung 43 Tv");
    expect(screen.getByLabelText("Item 3 category").value).toBe("SHOPPING");
    expect(screen.getByLabelText("Item 1 category").value).toBe("GROCERIES");
    expect(screen.getByRole("status").textContent).toContain("Every dollar is assigned");
    expect(screen.getByLabelText(/WALMART SUPERCENTER charge on 2026-09-03/).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Receipt added to WALMART SUPERCENTER."));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/transactions/7/split");
    const parts = JSON.parse(options.body).parts;
    expect(parts).toHaveLength(5);
    expect(parts[2]).toEqual({ amount: "298.00", category: "SHOPPING", label: "Samsung 43 Tv" });
  });

  it("adds a new purchase then splits it when nothing matches", async () => {
    readReceiptText.mockResolvedValue(WALMART_TEXT);
    const fetchMock = stubFetch((url, options) => {
      if (url === "/api/transactions" && options.method === "POST") return { body: { id: 55 } };
      return { body: [] };
    });
    const onSaved = vi.fn();
    render(<ReceiptScanner transactions={[]} onClose={() => {}} onSaved={onSaved} />);
    pickPhoto();
    await screen.findByLabelText("Store");

    expect(screen.getByLabelText(/new purchase \(no matching charge found\)/).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Receipt from WALMART added."));
    const created = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(created).toMatchObject({ date: "2026-09-03", description: "WALMART", amount: "327.36", type: "EXPENSE" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/transactions/55/split");
  });

  it("does not add the purchase twice when saving is retried after a failure", async () => {
    readReceiptText.mockResolvedValue(WALMART_TEXT);
    let splitAttempts = 0;
    const fetchMock = stubFetch((url, options) => {
      if (url === "/api/transactions" && options.method === "POST") return { body: { id: 55 } };
      if (url.endsWith("/split")) {
        splitAttempts += 1;
        return splitAttempts === 1 ? { ok: false, status: 500, body: { message: "Try again." } } : { body: [] };
      }
      return { body: [] };
    });
    const onSaved = vi.fn();
    render(<ReceiptScanner transactions={[]} onClose={() => {}} onSaved={onSaved} />);
    pickPhoto();
    await screen.findByLabelText("Store");

    fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    const creates = fetchMock.mock.calls.filter(([u, o]) => u === "/api/transactions" && o?.method === "POST");
    expect(creates).toHaveLength(1);
  });

  it("will not save until the lines add up to the total", async () => {
    readReceiptText.mockResolvedValue(WALMART_TEXT);
    stubFetch(() => ({ body: [] }));
    render(<ReceiptScanner transactions={[]} onClose={() => {}} onSaved={() => {}} />);
    pickPhoto();
    await screen.findByLabelText("Store");

    const save = screen.getByRole("button", { name: "Save receipt" });
    expect(save.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Item 2 amount"), { target: { value: "2.00" } });
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("too much");
    fireEvent.click(screen.getByRole("button", { name: "Remove item 2" }));
    expect(screen.getByRole("status").textContent).toContain("left to assign");
  });

  it("says so when a photo has no readable items", async () => {
    readReceiptText.mockResolvedValue("smudge");
    render(<ReceiptScanner transactions={[]} onClose={() => {}} onSaved={() => {}} />);
    pickPhoto();
    expect(await screen.findByText(/No items were found/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save receipt" }).disabled).toBe(true);
  });

  it("shows why a photo could not be read and lets the person try again", async () => {
    readReceiptText.mockRejectedValue(new Error("This photo could not be opened. Try a JPG or PNG image."));
    render(<ReceiptScanner transactions={[]} onClose={() => {}} onSaved={() => {}} />);
    pickPhoto();
    expect((await screen.findByRole("alert")).textContent).toContain("JPG or PNG");
    expect(screen.getByRole("button", { name: "Choose a photo" })).toBeTruthy();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ReceiptScanner transactions={[]} onClose={onClose} onSaved={() => {}} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("scan receipt from the transaction list", () => {
  it("opens the scanner and refreshes the list after saving", async () => {
    readReceiptText.mockResolvedValue(WALMART_TEXT);
    let saved = false;
    stubFetch((url, options) => {
      if (url.startsWith("/api/rules")) return { body: [] };
      if (url.endsWith("/split") && options.method === "POST") {
        saved = true;
        return { body: [] };
      }
      return { body: saved ? [{ ...charge, description: "WALMART SUPERCENTER - Bananas", amount: 1.24 }] : [charge] };
    });
    render(<TransactionList refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    await screen.findByText("WALMART SUPERCENTER");
    fireEvent.click(screen.getByRole("button", { name: "Scan receipt" }));
    pickPhoto();
    await screen.findByLabelText("Store");
    fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));

    expect(await screen.findByText("Receipt added to WALMART SUPERCENTER.")).toBeTruthy();
    expect(await screen.findByText("WALMART SUPERCENTER - Bananas")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
