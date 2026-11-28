import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountSettingsDialog from "../components/AccountSettingsDialog";
import ProfileBadge from "../components/ProfileBadge";
import { changePassword } from "../api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(handler) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/csrf") {
      return { ok: true, json: async () => ({ headerName: "X-CSRF-TOKEN", token: "mock-token" }) };
    }
    const result = handler(String(url), options);
    return { ok: result.ok ?? true, status: result.status ?? 200, json: async () => result.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("change password api", () => {
  it("posts the current and new password to the change-password endpoint", async () => {
    const fetchMock = stubFetch(() => ({ body: { signedOutOtherDevices: 2 } }));
    expect(await changePassword("old-password-1", "new-password-22")).toEqual({ signedOutOtherDevices: 2 });
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/auth/change-password");
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body)).toEqual({
      currentPassword: "old-password-1",
      newPassword: "new-password-22",
    });
  });

  it("passes on the server's message when the change is refused", async () => {
    stubFetch(() => ({ ok: false, status: 403, body: { message: "Current password is incorrect." } }));
    await expect(changePassword("wrong", "new-password-22")).rejects.toThrow("Current password is incorrect.");
  });
});

describe("AccountSettingsDialog", () => {
  let handlers;
  beforeEach(() => {
    handlers = { onClose: vi.fn() };
  });

  // Anchored regexes: an inline validation message lives inside the same
  // <label>, so it becomes part of the field's accessible name.
  function fields() {
    return {
      current: screen.getByLabelText(/^Current password/),
      next: screen.getByLabelText(/^New password/),
      confirm: screen.getByLabelText(/^Confirm new password/),
      submit: screen.getByRole("button", { name: "Change password" }),
    };
  }

  it("keeps submit disabled until a valid, matching, long-enough new password is entered", () => {
    stubFetch(() => ({ body: { signedOutOtherDevices: 0 } }));
    render(<AccountSettingsDialog {...handlers} />);
    const f = fields();
    expect(f.submit.disabled).toBe(true);

    fireEvent.change(f.current, { target: { value: "old-password-1" } });
    fireEvent.change(f.next, { target: { value: "short" } });
    expect(screen.getByText("Use at least 12 characters.")).toBeTruthy();
    expect(f.submit.disabled).toBe(true);

    fireEvent.change(f.next, { target: { value: "new-password-22" } });
    fireEvent.change(f.confirm, { target: { value: "new-password-nomatch" } });
    expect(screen.getByText("The new passwords do not match.")).toBeTruthy();
    expect(f.submit.disabled).toBe(true);

    fireEvent.change(f.confirm, { target: { value: "new-password-22" } });
    expect(f.submit.disabled).toBe(false);
  });

  it("refuses a new password equal to the current one", () => {
    stubFetch(() => ({ body: {} }));
    render(<AccountSettingsDialog {...handlers} />);
    const f = fields();
    fireEvent.change(f.current, { target: { value: "same-password-123" } });
    fireEvent.change(f.next, { target: { value: "same-password-123" } });
    fireEvent.change(f.confirm, { target: { value: "same-password-123" } });
    expect(screen.getByText(/different from your current one/)).toBeTruthy();
    expect(f.submit.disabled).toBe(true);
  });

  it("changes the password and reports how many devices were signed out", async () => {
    stubFetch(() => ({ body: { signedOutOtherDevices: 1 } }));
    render(<AccountSettingsDialog {...handlers} />);
    const f = fields();
    fireEvent.change(f.current, { target: { value: "old-password-1" } });
    fireEvent.change(f.next, { target: { value: "new-password-22" } });
    fireEvent.change(f.confirm, { target: { value: "new-password-22" } });
    fireEvent.click(f.submit);

    expect(await screen.findByText(/signed out 1 other device\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it("shows the server's error and stays open when the change fails", async () => {
    stubFetch(() => ({ ok: false, status: 403, body: { message: "Current password is incorrect." } }));
    render(<AccountSettingsDialog {...handlers} />);
    const f = fields();
    fireEvent.change(f.current, { target: { value: "wrong-password-1" } });
    fireEvent.change(f.next, { target: { value: "new-password-22" } });
    fireEvent.change(f.confirm, { target: { value: "new-password-22" } });
    fireEvent.click(f.submit);
    expect((await screen.findByRole("alert")).textContent).toBe("Current password is incorrect.");
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("closes with Cancel and with Escape", () => {
    stubFetch(() => ({ body: {} }));
    render(<AccountSettingsDialog {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handlers.onClose).toHaveBeenCalledTimes(2);
  });
});

describe("profile menu change-password entry", () => {
  it("offers Change password and closes the menu when chosen", async () => {
    const onChangePassword = vi.fn();
    render(
      <ProfileBadge
        fullName="AJ Rayamajhi"
        onSaved={() => {}}
        onChangePassword={onChangePassword}
        onDeleteData={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Your profile/ }));
    fireEvent.click(screen.getByRole("button", { name: /Change password/ }));
    expect(onChangePassword).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Change password/ })).toBeNull());
  });
});
