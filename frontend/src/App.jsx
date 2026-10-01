import { useState } from "react";
import "./App.css";
import UploadStatement from "./components/UploadStatement";
import Dashboard from "./components/Dashboard";
import TransactionList from "./components/TransactionList";
import ManualEntry from "./components/ManualEntry";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "upload", label: "Upload statement" },
  { id: "manual", label: "Add cash transaction" },
  { id: "transactions", label: "Transactions" },
];

/**
 * A deliberately minimal shell: three tabs, no routing library, no
 * global state management. This is a first working frontend meant to
 * prove the backend pipeline end-to-end (upload -> parse -> redact ->
 * categorize -> dashboard), not a polished product UI.
 *
 * `refreshKey` is a small trick worth understanding: after a successful
 * upload, we increment this number and pass it down as a prop to
 * Dashboard/TransactionList. Both of those components have it in their
 * useEffect dependency array, so changing it triggers them to refetch
 * - a simple way to say "something changed, go get fresh data" without
 * reaching for a bigger state-management tool.
 */
function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  function handleImported() {
    setRefreshKey((key) => key + 1);
    setActiveTab("dashboard"); // jump straight to the numbers after a successful upload
  }

  function handleManualAdd() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>KnowYourFinance</h1>
        <p className="tagline">
          Upload a statement. See what you earned, spent, and saved — no
          bank linking required.
        </p>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === "dashboard" && <Dashboard refreshKey={refreshKey} />}
        {activeTab === "upload" && (
          <UploadStatement onImported={handleImported} />
        )}
        {activeTab === "manual" && <ManualEntry onAdded={handleManualAdd} />}
        {activeTab === "transactions" && (
          <TransactionList refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}

export default App;
