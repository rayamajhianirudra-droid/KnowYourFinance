import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountGate from "../components/AccountGate";
import { buildRecoverySheet } from "../utils/recoverySheet";

const CODE = "ABCD-EFGH-JKLM-NPQR-STUV";

function stubServer({ signupBody = { email: "a@b.test", recoveryCode: CODE }, resetStatus = 200 } = {}) {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    if (url.endsWith("/csrf")) return { ok: true, json: async () => ({ token: "t", headerName: "X-CSRF-TOKEN" }) };
    if (url.endsWith("/session")) return { ok: false, status: 401 };
    calls.push([url, options.body ? JSON.parse(options.body) : null]);
    if (url.endsWith("/signup")) return { ok: true, status: 200, json: async () => signupBody };
    if (url.endsWith("/reset-password")) {
      return resetStatus === 200
        ? { ok: true, status: 200, json: async () => ({ recoveryCode: "WXYZ-2345-6789-ABCD-EFGH" }) }
        : { ok: false, status: 401, json: async () => ({ message: "The email or recovery code is not correct." }) };
    }
    throw new Error(`Unexpected request ${url}`);
  }));
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sign-up shows the recovery code once", () => {
  it("holds the person on the code until they confirm it is saved", async () => {
    stubServer();
    render(<AccountGate>{({ account }) => <p>Inside as {account.email}</p>}</AccountGate>);
    fireEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a long enough password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(CODE)).toBeTruthy();
    expect(screen.queryByText(/Inside as/)).toBeNull();
    const next = screen.getByRole("button", { name: "Continue to my account" });
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("I have saved my recovery code"));
    fireEvent.click(next);
    expect(await screen.findByText("Inside as a@b.test")).toBeTruthy();
  });
});

describe("forgot password", () => {
  async function openForm() {
    render(<AccountGate>{() => <p>Inside</p>}</AccountGate>);
    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
  }

  it("sets a new password with the code, then shows the next code", async () => {
    const calls = stubServer();
    await openForm();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.test" } });
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: CODE } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a brand new password" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("WXYZ-2345-6789-ABCD-EFGH")).toBeTruthy();
    expect(calls.find(([u]) => u.endsWith("/reset-password"))[1]).toEqual({
      email: "a@b.test", recoveryCode: CODE, newPassword: "a brand new password",
    });
    fireEvent.click(screen.getByLabelText("I have saved my recovery code"));
    fireEvent.click(screen.getByRole("button", { name: "Go to sign in" }));
    expect(await screen.findByText("Your password was changed. Sign in with the new password.")).toBeTruthy();
  });

  it("shows the server's message when the code is wrong", async () => {
    stubServer({ resetStatus: 401 });
    await openForm();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.test" } });
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a brand new password" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("The email or recovery code is not correct."));
  });
});

describe("recovery sheet", () => {
  it("holds the email and code and never a password", () => {
    const sheet = buildRecoverySheet("a@b.test", CODE);
    expect(sheet).toContain("Account email: a@b.test");
    expect(sheet).toContain(`Recovery code: ${CODE}`);
    expect(sheet.toLowerCase()).not.toContain("password:");
  });
});
