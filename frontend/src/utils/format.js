// Shared formatting helpers. Pulled out into its own file because
// Dashboard.jsx and TransactionList.jsx both had their own identical
// copy of formatCurrency - any component that needs to show a dollar
// amount imports it from here instead of redefining it.
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}
