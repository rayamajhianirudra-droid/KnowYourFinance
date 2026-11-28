import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerifyEmailScreen from "../components/VerifyEmailScreen";
import VerifyEmailBanner from "../components/VerifyEmailBanner";
import AccountGate from "../components/AccountGate";
import { verifyEmail, resendVerification } from "../api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try { window.history.replaceState({}, "", "/"); } catch { /* ignore */ }
});

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

describe("email verification api", () => {
  it("posts the token to verify-email", async () => {
    const fetchMock = stubFetch(() => ({ body: { message: "ok" } }));
    await verifyEmail("the-token");
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith("/auth/verify-email"));
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body)).toEqual({ token: "the-token" });
  });

  it("posts to resend-verification", async () => {
    const fetchMock = stubFetch(() => ({ body: { message: "ok" } }));
    await resendVerification();
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith("/auth/resend-verification"));
    expect(call[1].method).toBe("POST");
  });
});

describe("VerifyEmailScreen", () => {
  it("verifies on load and then continues", async () => {
    stubFetch(() => ({ body: { message: "ok" } }));
    const onDone = vi.fn();
    render(<VerifyEmailScreen token="t" onDone={onDone} />);
    expect(await screen.findByText(/Your email is verified/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("shows the server's message when the link is invalid", async () => {
    stubFetch(() => ({ ok: false, status: 400, body: { message: "This verification link is invalid or has expired." } }));
    render(<VerifyEmailScreen token="bad" onDone={() => {}} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or has expired/);
  });
});

describe("VerifyEmailBanner", () => {
  it("offers to resend and confirms once sent", async () => {
    const fetchMock = stubFetch(() => ({ body: { message: "ok" } }));
    render(<VerifyEmailBanner email="person@example.test" />);
    expect(screen.getByText(/confirm your email/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
    expect(await screen.findByText(/Verification email sent/)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/auth/resend-verification"))).toBe(true);
  });
});

describe("AccountGate verification link", () => {
  it("shows the verification screen when opened from a verify link", async () => {
    window.history.replaceState({}, "", "/verify-email?token=abc123");
    stubFetch((url) => (url.endsWith("/session") ? { ok: false, status: 401 } : { body: { message: "ok" } }));
    render(<AccountGate>{() => <div>app</div>}</AccountGate>);
    expect(await screen.findByRole("heading", { name: "Email verification" })).toBeTruthy();
    expect(await screen.findByText(/Your email is verified/)).toBeTruthy();
  });
});
