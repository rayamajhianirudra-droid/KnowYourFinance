import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountActivityDialog from "../components/AccountActivityDialog";
import { deviceName } from "../utils/device";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FIREFOX_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

function stubFetch(handler) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (String(url).endsWith("/csrf")) {
      return { ok: true, json: async () => ({ headerName: "X-CSRF-TOKEN", token: "mock-token" }) };
    }
    const result = handler(String(url), options);
    return { ok: result.ok ?? true, status: result.status ?? 200, json: async () => result.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("deviceName", () => {
  it("summarises common user agents and handles unknowns", () => {
    expect(deviceName(CHROME_MAC)).toBe("Chrome on macOS");
    expect(deviceName(FIREFOX_WIN)).toBe("Firefox on Windows");
    expect(deviceName("")).toBe("Unknown device");
    expect(deviceName("Unknown device")).toBe("Unknown device");
  });
});

describe("AccountActivityDialog", () => {
  function routes({ sessions, history }) {
    return stubFetch((url, options) => {
      if (url.endsWith("/auth/sessions") && (!options.method || options.method === "GET")) {
        return { body: sessions };
      }
      if (url.endsWith("/auth/login-history")) return { body: history };
      if (url.includes("/auth/sessions/") && options.method === "DELETE") return { status: 204, body: null };
      if (url.endsWith("/auth/sessions/revoke-others")) return { body: { signedOutOtherDevices: 1 } };
      return { body: {} };
    });
  }

  it("lists devices and recent activity, flagging the current device", async () => {
    routes({
      sessions: [
        { handle: "h1", createdAt: "2026-11-28T10:00:00Z", device: CHROME_MAC, current: true },
        { handle: "h2", createdAt: "2026-11-28T09:00:00Z", device: FIREFOX_WIN, current: false },
      ],
      history: [
        { outcome: "FAILURE", at: "2026-11-28T10:05:00Z", device: CHROME_MAC, ipAddress: "1.2.3.4" },
        { outcome: "SUCCESS", at: "2026-11-28T10:00:00Z", device: CHROME_MAC, ipAddress: "1.2.3.4" },
      ],
    });
    render(<AccountActivityDialog onClose={() => {}} />);

    expect(await screen.findByText(/this device/)).toBeTruthy();
    // Chrome on macOS appears for the current device and in the activity rows.
    expect(screen.getAllByText(/Chrome on macOS/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Firefox on Windows/)).toBeTruthy();
    expect(screen.getByText(/Failed sign-in attempt/)).toBeTruthy();
    expect(screen.getByText(/Successful sign-in/)).toBeTruthy();
    // Only the non-current device offers a per-device sign-out button.
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1);
  });

  it("signs out one device and reloads the list", async () => {
    const fetchMock = routes({
      sessions: [
        { handle: "h1", createdAt: "2026-11-28T10:00:00Z", device: CHROME_MAC, current: true },
        { handle: "h2", createdAt: "2026-11-28T09:00:00Z", device: FIREFOX_WIN, current: false },
      ],
      history: [],
    });
    render(<AccountActivityDialog onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, o]) => url.includes("/auth/sessions/h2") && o.method === "DELETE")).toBe(true));
  });

  it("signs out all other devices", async () => {
    const fetchMock = routes({
      sessions: [
        { handle: "h1", createdAt: "2026-11-28T10:00:00Z", device: CHROME_MAC, current: true },
        { handle: "h2", createdAt: "2026-11-28T09:00:00Z", device: FIREFOX_WIN, current: false },
      ],
      history: [],
    });
    render(<AccountActivityDialog onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out all other devices" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, o]) => url.endsWith("/auth/sessions/revoke-others") && o.method === "POST")).toBe(true));
  });
});
