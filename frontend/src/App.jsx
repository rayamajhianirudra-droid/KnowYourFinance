import AccountGate from "./components/AccountGate";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import UploadStatement from "./components/UploadStatement";
import Budgets from "./components/Budgets";
import Dashboard from "./components/Dashboard";
import TransactionList from "./components/TransactionList";
import ManualEntry from "./components/ManualEntry";
import ProfileBadge from "./components/ProfileBadge";
import ThemeToggle from "./components/ThemeToggle";
import ResetDataDialog from "./components/ResetDataDialog";
import { getProfile } from "./api";
import { DashboardIcon, UploadIcon, PlusIcon, ListIcon, LockIcon, SavingsIcon } from "./components/Icons";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { id: "upload", label: "Upload Statements", icon: UploadIcon },
  { id: "manual", label: "Add Transaction", icon: PlusIcon },
  { id: "transactions", label: "Transactions", icon: ListIcon },
  { id: "budgets", label: "Budgets", icon: SavingsIcon },
];

/**
 * The app shell: one slim top bar (brand, nav, privacy promise),
 * a tab-based nav (no routing library - five views, swapped by state),
 * and the active view. `refreshKey` is the one piece of shared state:
 * bump it after anything that changes the transaction data (an import,
 * a manual add, an edit) and every view with it in a useEffect
 * dependency array refetches - a simple way to keep the dashboard and
 * transaction list in sync without a bigger state-management tool.
 */
function App() {
  return <AccountGate>{(session) => <FinanceApp {...session} />}</AccountGate>;
}

function FinanceApp({ signOut, pending, error }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [fullName, setFullName] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  // Load the saved name once. If it can't be loaded the app still works,
  // it just asks for the name instead of showing it.
  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (!cancelled && profile && typeof profile.fullName === "string") setFullName(profile.fullName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function handleImported() {
    setRefreshKey((key) => key + 1);
    setActiveTab("dashboard"); // jump straight to the numbers after a successful import
  }

  function handleManualAdd() {
    setRefreshKey((key) => key + 1);
  }

  function handleDataDeleted(result) {
    setRefreshKey((key) => key + 1);
    if (result.nameRemoved) setFullName(null);
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

  // When the person switches views, move keyboard and screen reader focus
  // to the new page and scroll back to the top. Without this the old
  // scroll position stays and a screen reader never hears that the
  // content changed. Skipped on first load so the page does not steal focus.
  const mainRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [activeTab]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>

      {/* One slim bar on top: brand, the five views, and the privacy promise.
          On phones the same nav moves to the bottom of the screen, where a
          thumb can reach it, with a small label under each icon. */}
      <header className="topbar">
        <div className="content-container topbar__inner">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <DashboardIcon width={18} height={18} />
            </span>
            <span className="brand__name">KnowYourFinance</span>
          </div>

          <nav className="site-nav" aria-label="Main">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`nav-item${isActive ? " nav-item--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon width={18} height={18} aria-hidden="true" />
                  <span className="nav-item__label">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <p className="trust-badge">
            <LockIcon width={14} height={14} aria-hidden="true" />
            Your finances. Your data. Your control.
          </p>

          <ThemeToggle />
          <ProfileBadge fullName={fullName} onSaved={setFullName} onDeleteData={() => setResetOpen(true)} />
        </div>
        <div className="content-container account-actions">
          {error && <p role="alert">{error}</p>}
          <button type="button" className="btn btn--secondary" onClick={signOut} disabled={pending}>Sign out</button>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="site-main">
        <div className="content-container">
          {activeTab === "dashboard" && (
            <Dashboard
              fullName={fullName}
              refreshKey={refreshKey}
              onUploadClick={goToUpload}
              onAddClick={goToManual}
              onViewTransactions={goToTransactions}
            />
          )}
          {activeTab === "budgets" && <Budgets refreshKey={refreshKey} />}
          {activeTab === "upload" && <UploadStatement onImported={handleImported} />}
          {activeTab === "manual" && <ManualEntry fullName={fullName} onAdded={handleManualAdd} />}
          {activeTab === "transactions" && (
            <TransactionList
              refreshKey={refreshKey}
              onUploadClick={goToUpload}
              onAddClick={goToManual}
            />
          )}
        </div>
      </main>

      {resetOpen && (
        <ResetDataDialog
          hasName={Boolean(fullName)}
          onClose={() => setResetOpen(false)}
          onDeleted={handleDataDeleted}
          onUpload={() => {
            setResetOpen(false);
            goToUpload();
          }}
        />
      )}
    </div>
  );
}

export default App;
