import { useEffect, useMemo, useState } from "react";
import { listTransactions, updateTransaction, deleteTransaction } from "../api";
import { formatCurrency, categoryLabel } from "../utils/format";
import { SearchIcon, ArrowUpIcon, ArrowDownIcon, EditIcon, TrashIcon, CheckCircleIcon, XIcon } from "./Icons";
import EmptyState from "./EmptyState";

const CATEGORIES = [
  "GROCERIES", "DINING", "RENT_MORTGAGE", "UTILITIES", "SUBSCRIPTIONS",
  "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION",
  "TRAVEL", "INCOME", "TRANSFER", "OTHER",
];

const TYPE_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "INCOME", label: "Income" },
  { id: "EXPENSE", label: "Expense" },
];

/**
 * Every transaction on file for the user - the "receipts" view behind
 * the dashboard's summary numbers. Also where a user fixes a
 * transaction AutoCategorizer guessed wrong: the category cell is an
 * editable dropdown rather than a label, since that's the single most
 * common correction (an unusual merchant name landing in OTHER, or a
 * keyword match that doesn't fit).
 */
function TransactionList({ refreshKey, onUploadClick, onAddClick }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // Full-row editing (FR-403: date, description, amount, category) -
  // editingId tracks which row is in edit mode, editDraft holds its
  // in-progress field values, and editErrors holds any field-level
  // validation messages the backend sent back on a failed save.
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Delete (FR-404) is a two-step confirm inline in the row, rather
  // than a native confirm() dialog, so it matches the rest of the
  // design system instead of popping a browser-chrome alert.
  const [deletingId, setDeletingId] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState(null);

  useEffect(() => {
    setLoading(true);
    listTransactions()
      .then(setTransactions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  async function handleCategoryChange(transaction, newCategory) {
    setSavingId(transaction.id);
    try {
      const updated = await updateTransaction(transaction.id, {
        ...transaction,
        category: newCategory,
      });
      setTransactions((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(t) {
    setDeletingId(null);
    setEditingId(t.id);
    setEditErrors({});
    setEditDraft({
      date: t.date,
      description: t.description,
      amount: String(t.amount),
      category: t.category ?? "OTHER",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditErrors({});
  }

  async function saveEdit(t) {
    setEditSaving(true);
    setEditErrors({});
    try {
      const updated = await updateTransaction(t.id, {
        ...t,
        date: editDraft.date,
        description: editDraft.description,
        amount: editDraft.amount,
        category: editDraft.category,
      });
      setTransactions((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      cancelEdit();
    } catch (err) {
      setEditErrors(err.fieldErrors || {});
      if (!err.fieldErrors) setError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete(id) {
    setDeleteBusyId(id);
    try {
      await deleteTransaction(id);
      setTransactions((prev) => prev.filter((row) => row.id !== id));
      setDeletingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteBusyId(null);
    }
  }

  function toggleSort(field) {
    if (sortBy === field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = transactions.filter((t) => {
      if (term && !t.description?.toLowerCase().includes(term)) return false;
      if (categoryFilter !== "ALL" && (t.category ?? "OTHER") !== categoryFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });

    rows = rows.sort((a, b) => {
      let diff;
      if (sortBy === "amount") {
        diff = Number(a.amount) - Number(b.amount);
      } else {
        diff = new Date(a.date) - new Date(b.date);
      }
      return sortDir === "asc" ? diff : -diff;
    });

    return rows;
  }, [transactions, search, categoryFilter, typeFilter, startDate, endDate, sortBy, sortDir]);

  function clearFilters() {
    setSearch("");
    setCategoryFilter("ALL");
    setTypeFilter("ALL");
    setStartDate("");
    setEndDate("");
  }

  const hasActiveFilters =
    search || categoryFilter !== "ALL" || typeFilter !== "ALL" || startDate || endDate;

  function SortButton({ field, label }) {
    const active = sortBy === field;
    return (
      <button
        type="button"
        className={`sort-btn${active ? " sort-btn--active" : ""}`}
        onClick={() => toggleSort(field)}
        aria-label={`Sort by ${label}, ${active && sortDir === "asc" ? "currently ascending" : "currently descending"}`}
      >
        {label}
        {active && (
          sortDir === "asc"
            ? <ArrowUpIcon width={13} height={13} aria-hidden="true" />
            : <ArrowDownIcon width={13} height={13} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Transactions</h1>
      <p className="page-subtitle">
        Every transaction on file. Fix a category from its dropdown,
        edit a row with the pencil, or remove one entirely — every
        change updates your dashboard immediately.
      </p>

      <div className="panel filter-bar">
        <label className="search-field">
          <SearchIcon width={16} height={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search by description"
          />
        </label>

        <label className="filter-field">
          <span className="filter-field__label">Category</span>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="ALL">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
          </select>
        </label>

        <div className="filter-field">
          <span className="filter-field__label">Type</span>
          <div className="segmented" role="group" aria-label="Filter by type">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`segmented__btn${typeFilter === f.id ? " segmented__btn--active" : ""}`}
                onClick={() => setTypeFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <label className="filter-field">
          <span className="filter-field__label">From</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="filter-field">
          <span className="filter-field__label">To</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>

        {hasActiveFilters && (
          <button type="button" className="btn btn--text" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {loading && (
        <div className="panel">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {!loading && transactions.length === 0 && (
        <EmptyState
          title="No transactions yet"
          message="Upload a bank statement or add one by hand to see it appear here."
          onUploadClick={onUploadClick}
          onAddClick={onAddClick}
        />
      )}

      {!loading && transactions.length > 0 && filtered.length === 0 && (
        <div className="panel empty-filtered">
          <p className="muted">No transactions match these filters.</p>
          <button type="button" className="btn btn--secondary" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="panel table-panel">
          <table className="transactions-table">
            <thead>
              <tr>
                <th><SortButton field="date" label="Date" /></th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th className="amount-col"><SortButton field="amount" label="Amount" /></th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                if (editingId === t.id) {
                  return (
                    <tr key={t.id} className="row-editing">
                      <td className="cell-date">
                        <input
                          type="date"
                          value={editDraft.date}
                          onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                          aria-invalid={Boolean(editErrors.date)}
                          aria-label="Edit date"
                        />
                        {editErrors.date && <span className="field__error">{editErrors.date}</span>}
                      </td>
                      <td className="cell-description">
                        <input
                          type="text"
                          value={editDraft.description}
                          onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                          aria-invalid={Boolean(editErrors.description)}
                          aria-label="Edit description"
                        />
                        {editErrors.description && <span className="field__error">{editErrors.description}</span>}
                      </td>
                      <td>
                        <select
                          className="category-select"
                          value={editDraft.category}
                          onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                          aria-label="Edit category"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{categoryLabel(c)}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge badge--${t.type.toLowerCase()}`}>
                          {t.type === "INCOME" ? "Income" : "Expense"}
                        </span>
                      </td>
                      <td className="amount-col">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="cell-amount-input"
                          value={editDraft.amount}
                          onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                          aria-invalid={Boolean(editErrors.amount)}
                          aria-label="Edit amount"
                        />
                        {editErrors.amount && <span className="field__error">{editErrors.amount}</span>}
                      </td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn--confirm"
                            onClick={() => saveEdit(t)}
                            disabled={editSaving}
                            aria-label="Save changes"
                            title="Save"
                          >
                            <CheckCircleIcon width={17} height={17} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={cancelEdit}
                            disabled={editSaving}
                            aria-label="Cancel edit"
                            title="Cancel"
                          >
                            <XIcon width={17} height={17} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={t.id}>
                    <td className="cell-date">{t.date}</td>
                    <td className="cell-description">{t.description}</td>
                    <td>
                      <select
                        className="category-select"
                        value={t.category ?? "OTHER"}
                        disabled={savingId === t.id}
                        onChange={(e) => handleCategoryChange(t, e.target.value)}
                        aria-label={`Category for ${t.description}`}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{categoryLabel(c)}</option>
                        ))}
                      </select>
                      {t.lowConfidence && (
                        <span
                          className="low-confidence-badge"
                          title="Auto-assigned with low confidence - double-check this one"
                        >
                          auto-guessed
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge--${t.type.toLowerCase()}`}>
                        {t.type === "INCOME" ? "Income" : "Expense"}
                      </span>
                    </td>
                    <td className={`amount-col amount amount--${t.type.toLowerCase()}`}>
                      {t.type === "EXPENSE" ? "-" : "+"}{formatCurrency(t.amount)}
                    </td>
                    <td className="actions-col">
                      {deletingId === t.id ? (
                        <div className="row-actions row-actions--confirm">
                          <span className="row-actions__prompt">Delete?</span>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => confirmDelete(t.id)}
                            disabled={deleteBusyId === t.id}
                            aria-label={`Confirm delete ${t.description}`}
                            title="Confirm delete"
                          >
                            <CheckCircleIcon width={17} height={17} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setDeletingId(null)}
                            disabled={deleteBusyId === t.id}
                            aria-label="Cancel delete"
                            title="Cancel"
                          >
                            <XIcon width={17} height={17} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => startEdit(t)}
                            aria-label={`Edit ${t.description}`}
                            title="Edit"
                          >
                            <EditIcon width={16} height={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => setDeletingId(t.id)}
                            aria-label={`Delete ${t.description}`}
                            title="Delete"
                          >
                            <TrashIcon width={16} height={16} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="table-footnote">
            Showing {filtered.length} of {transactions.length} transaction{transactions.length === 1 ? "" : "s"}.
          </p>
        </div>
      )}
    </div>
  );
}

export default TransactionList;
