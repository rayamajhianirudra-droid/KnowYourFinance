import { useState } from "react";
import "./App.css";
import UploadStatement from "./components/UploadStatement";
import Dashboard from "./components/Dashboard";
import TransactionList from "./components/TransactionList";
import ManualEntry from "./components/ManualEntry";
import { DashboardIcon, UploadIcon, PlusIcon, ListIcon, LockIcon } from "./components/Icons";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { id: "upload", label: "Upload Statement", icon: UploadIcon },
  { id: "manual", label: "Add Transaction", icon: PlusIcon },
  { id: "transactions", label: "Transactions", icon: ListIcon },
];

/**
 * The app shell: a persistent header (brand + what the product does),
 * a tab-based nav (no routing library - four views, swapped by state),
 * and the active view. `refreshKey` is the one piece of shared state:
 * bump it after anything that changes the transaction data (an import,
 * a manual add, an edit) and every view with it in a useEffect
 * dependency array refetches - a simple way to keep the dashboard and
 * transaction list in sync without a bigger state-management tool.
 */
function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  function handleImported() {
    setRefreshKey((key) => key + 1);
    setActiveTab("dashboard"); // jump straight to the numbers after a successful import
  }

  function handleManualAdd() {
    setRefreshKey((key) => key + 1);
  }

  function goToUpload() {
    setActiveTab("upload");
  }

  function goToManual() {
    setActiveTab("manual");
  }

  function goToTransactions() {
    setActiveTab("transactions");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="content-container site-header__inner">
          <div className="site-header__row">
            <div className="brand">
              <span className="brand__mark" aria-hidden="true">
                <DashboardIcon width={18} height={18} />
              </span>
              <span className="brand__name">KnowYourFinance</span>
            </div>
            <p className="trust-badge">
              <LockIcon width={14} height={14} aria-hidden="true" />
              Your finances. Your data. Your control.
            </p>
          </div>
          <p className="site-header__tagline">Understand where your money goes.</p>
          <p className="site-header__sub">
            Upload your statement and turn transactions into clear financial insights.
          </p>
        </div>
      </header>

      <nav className="site-nav" aria-label="Main">
        <div className="content-container site-nav__inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`nav-item${isActive ? " nav-item--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon width={17} height={17} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="site-main">
        <div className="content-container">
          {activeTab === "dashboard" && (
            <Dashboard
              refreshKey={refreshKey}
              onUploadClick={goToUpload}
              onAddClick={goToManual}
              onViewTransactions={goToTransactions}
            />
          )}
          {activeTab === "upload" && <UploadStatement onImported={handleImported} />}
          {activeTab === "manual" && <ManualEntry onAdded={handleManualAdd} />}
          {activeTab === "transactions" && (
            <TransactionList
              refreshKey={refreshKey}
              onUploadClick={goToUpload}
              onAddClick={goToManual}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
