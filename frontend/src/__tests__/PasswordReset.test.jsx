import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountGate from "../components/AccountGate";
import ResetPasswordScreen from "../components/ResetPasswordScreen";
import { requestPasswordReset, resetPassword } from "../api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Leave the URL back at the root so one test's reset link does not leak
  // into the next.
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

describe("password reset api", () => {
  it("posts the email to forgot-password", async () => {
    const fetchMock = stubFetch(() => ({ body: { message: "ok" } }));
    await requestPasswordReset("person@example.test");
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith("/auth/forgot-password"));
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body)).toEqual({ email: "person@example.test" });
  });

  it("posts the token and new password to reset-password", async () => {
    const fetchMock = stubFetch(() => ({ body: { message: "ok" } }));
    await resetPassword("the-token", "brand-new-password-2");
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith("/auth/reset-password"));
    expect(JSON.parse(call[1].body)).toEqual({ token: "the-token", newPassword: "brand-new-password-2" });
  });

  it("passes on the server's message when a reset is refused", async () => {
    stubFetch(() => ({ ok: false, status: 400, body: { message: "This reset link is invalid or has expired. Request a new one." } }));
    await expect(resetPassword("bad", "brand-new-password-2"))
      .rejects.toThrow("This reset link is invalid or has expired. Request a new one.");
  });
});

describe("ResetPasswordScreen", () => {
  it("keeps the button disabled until a valid, matching password is entered", () => {
    stubFetch(() => ({ body: { message: "ok" } }));
    const onDone = vi.fn();
    render(<ResetPasswordScreen token="t" onDone={onDone} />);
    const next = screen.getByLabelText(/^New password/);
    const confirm = screen.getByLabelText(/^Confirm new password/);
    const submit = screen.getByRole("button", { name: "Reset password" });
    expect(submit.disabled).toBe(true);

    fireEvent.change(next, { target: { value: "short" } });
    expect(screen.getByText("Use at least 12 characters.")).toBeTruthy();
    expect(submit.disabled).toBe(true);

    fireEvent.change(next, { target: { value: "brand-new-password-2" } });
    fireEvent.change(confirm, { target: { value: "different-one-9999" } });
    expect(screen.getByText("The new passwords do not match.")).toBeTruthy();
    expect(submit.disabled).toBe(true);

    fireEvent.change(confirm, { target: { value: "brand-new-password-2" } });
    expect(submit.disabled).toBe(false);
  });

  it("resets the password and then hands back to sign in", async () => {
    stubFetch(() => ({ body: { message: "ok" } }));
    const onDone = vi.fn();
    render(<ResetPasswordScreen token="t" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: "brand-new-password-2" } });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: "brand-new-password-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText(/Your password has been reset/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to sign in" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("shows the server's error when the link is invalid", async () => {
    stubFetch(() => ({ ok: false, status: 400, body: { message: "This reset link is invalid or has expired. Request a new one." } }));
    render(<ResetPasswordScreen token="bad" onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: "brand-new-password-2" } });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: "brand-new-password-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or has expired/);
  });
});

describe("AccountGate reset and forgot flows", () => {
  it("shows the reset screen when the page is opened from a reset link", async () => {
    window.history.replaceState({}, "", "/reset-password?token=abc123");
    stubFetch((url) => (url.endsWith("/session") ? { ok: false, status: 401 } : { body: {} }));
    render(<AccountGate>{() => <div>app</div>}</AccountGate>);
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeTruthy();
  });

  it("asks for an email and confirms a reset was requested without revealing anything", async () => {
    const fetchMock = stubFetch((url) =>
      url.endsWith("/session") ? { ok: false, status: 401 } : { body: { message: "ok" } });
    render(<AccountGate>{() => <div>app</div>}</AccountGate>);

    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/a reset link is on its way/)).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/auth/forgot-password"))).toBe(true));
  });
});
