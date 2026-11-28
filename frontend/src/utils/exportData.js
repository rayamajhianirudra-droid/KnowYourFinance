// Builds one file with everything the person has stored, so they can keep a
// copy or move it elsewhere. Nothing here talks to the server; the pieces
// are fetched by the caller.

export function buildExport({ email, transactions, goals, rules, profile }) {
  return {
    app: "KnowYourFinance",
    exportedAt: new Date().toISOString(),
    account: email ?? null,
    name: profile?.fullName ?? null,
    transactions: transactions ?? [],
    savingsGoals: goals ?? [],
    merchantRules: (rules ?? []).map(({ pattern, category }) => ({ pattern, category })),
  };
}

/** Saves any object as a .json file through the browser's download. */
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
