const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { readFile } = require("node:fs/promises");
const { chromium } = require("playwright");

async function run() {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({
      baseURL: "http://localhost:3000",
      viewport: { width: 390, height: 844 },
      timezoneId: "UTC",
    });
    page.setDefaultTimeout(15_000);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const deadline = `${now.getUTCFullYear() + 1}-12-31`;

    await page.goto("/");
    await page.getByRole("button", { name: "Create an account", exact: true }).click();
    await page.getByLabel("Email").fill("browser-smoke@example.test");
    await page.getByLabel("Password").fill(randomBytes(24).toString("hex"));
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();

    const csrfResponse = await page.request.get("/api/auth/csrf");
    assert.equal(csrfResponse.ok(), true);
    const { token, headerName } = await csrfResponse.json();
    const transaction = await page.request.post("/api/transactions", {
      headers: { [headerName]: token },
      data: { date: today, description: "Browser smoke coffee", amount: 4.50, type: "EXPENSE" },
    });
    assert.equal(transaction.ok(), true, `Create transaction returned ${transaction.status()}`);

    await page.reload();
    await page.getByRole("heading", { name: "Daily financial briefing" }).waitFor();
    await page.getByText("Safe to spend and balance forecast", { exact: true }).click();
    await page.getByLabel("Current available cash").fill("700");
    const weeklyEstimate = page.getByRole("listitem").filter({ hasText: /Next seven days/ });
    const dailyEstimate = page.getByRole("listitem").filter({ hasText: /^Today ·/ });
    try {
      assert.match(await weeklyEstimate.innerText(), /\$700\.00/);
      assert.match(await dailyEstimate.innerText(), /\$100\.00/);
    } catch (error) {
      console.error(await page.getByRole("region", { name: "Daily financial briefing" }).innerText());
      throw error;
    }

    await page.getByText("Add savings goal", { exact: true }).click();
    await page.getByLabel("Goal name").fill("Emergency fund");
    await page.getByLabel("Target amount").fill("500");
    await page.getByLabel("Already saved").fill("125");
    await page.getByLabel("Deadline").fill(deadline);
    await page.getByRole("button", { name: "Save goal", exact: true }).click();
    await page.getByText("Emergency fund", { exact: true }).waitFor();

    await page.reload();
    await page.getByText("Emergency fund", { exact: true }).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download monthly report (CSV)" }).click(),
    ]);
    assert.equal(download.suggestedFilename(), `kyf-monthly-report-${today.slice(0, 7)}.csv`);
    const csv = await readFile(await download.path(), "utf8");
    assert.match(csv, /"Expenses",4\.5/);
    assert.match(csv, /"Emergency fund",125,500/);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
