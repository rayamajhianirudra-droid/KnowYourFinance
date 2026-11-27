import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AccountGate from "../components/AccountGate";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens the protected shell after signup and hides it after signout", async () => {
  const email = "test@example.test";
  const fetchMock = vi.fn(async (url) => {
    if (url.endsWith("/session")) return { ok: false, status: 401 };
    if (url.endsWith("/csrf")) return { ok: true, json: async () => ({ token: "test-token", headerName: "X-CSRF-TOKEN" }) };
    if (url.endsWith("/signup")) return { ok: true, json: async () => ({ email }) };
    if (url.endsWith("/signout")) return { ok: true, status: 204 };
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<AccountGate>{({ account, signOut }) =>
    <button onClick={signOut}>Sign out {account.email}</button>
  }</AccountGate>);
  fireEvent.click(await screen.findByRole("button", { name: "Create an account" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Synthetic test password" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  fireEvent.click(await screen.findByRole("button", { name: /Sign out/ }));
  expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/csrf"))).toHaveLength(2);
});
