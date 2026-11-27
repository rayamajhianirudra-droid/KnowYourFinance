const STEPS = [
  "Sign in to your bank's website or app and open the account you want.",
  "Find Download, Export or Statements. It is usually near the list of transactions.",
  "Choose a date range and pick CSV (or Excel) as the file type. PDF files cannot be read.",
  "Save the file, then drop it here. Some banks limit how far back one download goes, so you can add up to 12 files at once.",
];

// Where the download lives for a few big banks. Menus change from time to
// time, so these are pointers, not exact click paths.
const BANKS = [
  { name: "Chase", where: "Open the account, then use the download icon above the transaction list and choose CSV." },
  { name: "Bank of America", where: "Open the account, then choose Download above the transactions and pick CSV or Excel." },
  { name: "Wells Fargo", where: "Open Account Activity, then use Download Account Activity and choose Comma Separated (CSV)." },
  { name: "Capital One", where: "Open the account, choose View Transactions, then Download Transactions and pick CSV." },
  { name: "Credit unions and others", where: "Look for Download, Export or Statements on the account page. Credit cards work the same way." },
];

/**
 * A short, collapsed guide for the first thing new people get stuck on:
 * where to find a statement file in their bank. It also links to a small
 * sample file so someone can see the layout we read before using their own.
 */
function StatementHelp() {
  return (
    <details className="panel statement-help">
      <summary>Not sure how to get your statement? Show me how</summary>

      <ol className="statement-help__steps">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h2 className="statement-help__heading">Where to look at some banks</h2>
      <dl className="statement-help__banks">
        {BANKS.map((bank) => (
          <div key={bank.name}>
            <dt>{bank.name}</dt>
            <dd>{bank.where}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">Menu names change now and then. If you cannot find it, search your bank's help for "download transactions".</p>

      <h2 className="statement-help__heading">What the file should look like</h2>
      <p>
        One row per transaction with a date, a description and an amount. Spending can be negative, or in separate
        debit and credit columns. Want to see it first?{" "}
        <a href="/sample-statement.csv" download="sample-statement.csv">Download a sample file</a>{" "}
        and upload it to try the app.
      </p>
    </details>
  );
}

export default StatementHelp;
