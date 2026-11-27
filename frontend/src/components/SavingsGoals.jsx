import { useState } from "react";
import { removeGoal, saveGoal } from "../api";
import { formatCurrency } from "../utils/format";
import { goalProgress } from "../utils/financialPlanning";

const EMPTY = { name: "", targetAmount: "", savedAmount: "0", deadline: "" };

export default function SavingsGoals({ goals, today, monthlyCashFlow, onChange }) {
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function edit(goal) {
    setDraft({
      name: goal.name, targetAmount: goal.targetAmount, savedAmount: goal.savedAmount, deadline: goal.deadline,
    });
    setEditing(goal.id);
    setMessage("");
  }

  function clear() {
    setDraft(EMPTY);
    setEditing(null);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const goal = await saveGoal(draft, editing);
      onChange((previous) => [...previous.filter((item) => item.id !== goal.id), goal]
        .sort((a, b) => a.deadline.localeCompare(b.deadline)));
      clear();
      setMessage("Goal saved.");
    } catch {
      setMessage("Could not save the goal. Check your entries and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    setMessage("");
    try {
      await removeGoal(id);
      onChange((previous) => previous.filter((goal) => goal.id !== id));
      if (editing === id) clear();
      setMessage("Goal removed.");
    } catch {
      setMessage("Could not remove the goal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel spending-scenario" aria-labelledby="savings-goals">
    <h2 className="panel-title" id="savings-goals">Savings goals</h2>
    {goals && <>
      {goals.length > 0 && <ul>{goals.map((goal) => {
        const progress = goalProgress(goal, today, monthlyCashFlow);
        return <li key={goal.id}>
          <strong>{goal.name}</strong> · {progress.percentage}% · {formatCurrency(goal.savedAmount)} of{" "}
          {formatCurrency(goal.targetAmount)} by {goal.deadline}
          {progress.remaining === 0 ? <p>Goal reached.</p> : <>
            <p>{progress.required === null ? "Deadline reached with money still to save."
              : `Required monthly contribution · ${formatCurrency(progress.required / 100)}`}</p>
            {monthlyCashFlow === null ? <p>More transaction history is needed to estimate feasibility.</p>
              : <p>{progress.feasible ? "Fits your recent cash flow if fully allocated to this goal."
                : "Recent cash flow may fall short of this goal."}
                {progress.estimatedDate && ` Estimated completion if all available cash flow goes to this goal · ${progress.estimatedDate}.`}</p>}
          </>}
          <button type="button" className="btn btn--text" disabled={busy} onClick={() => edit(goal)}>Edit</button>
          <button type="button" className="btn btn--text" disabled={busy} onClick={() => remove(goal.id)}>Remove</button>
        </li>;
      })}</ul>}
      <details open={editing ? true : undefined}>
        <summary>{editing ? "Edit savings goal" : "Add savings goal"}</summary>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend>Goal details</legend>
            <label>Goal name <input required maxLength={80} value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Target amount <input required type="number" min="0.01" max="999999999.99" step="0.01"
              value={draft.targetAmount} onChange={(event) => setDraft({ ...draft, targetAmount: event.target.value })} /></label>
            <label>Already saved <input required type="number" min="0" max="999999999.99" step="0.01"
              value={draft.savedAmount} onChange={(event) => setDraft({ ...draft, savedAmount: event.target.value })} /></label>
            <label>Deadline <input required type="date" min={editing ? "1900-01-01" : today} max="9999-12-31" value={draft.deadline}
              onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>
            <button type="submit" className="btn btn--secondary">Save goal</button>
            {editing && <button type="button" className="btn btn--text" onClick={clear}>Cancel edit</button>}
          </fieldset>
        </form>
      </details>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
