import { useEffect, useState } from "react";
import { getBudgets } from "../api";

const KEY = "kyf-checklist-dismissed";

function wasDismissed() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Three small steps for a new person: transactions in, a budget, a goal.
 * It disappears once everything is done, and can be dismissed earlier.
 */
export default function FirstRunChecklist({ hasTransactions, hasGoal, monthKey, onBudgets, onGoals, refreshKey }) {
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [hasBudget, setHasBudget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getBudgets(monthKey)
      .then((data) => { if (!cancelled) setHasBudget(Array.isArray(data) && data.length > 0); })
      .catch(() => { if (!cancelled) setHasBudget(null); });
    return () => { cancelled = true; };
  }, [monthKey, refreshKey]);

  if (dismissed || hasBudget === null) return null;
  const steps = [
    { id: "data", done: hasTransactions, label: "Add your transactions", action: null },
    { id: "budget", done: hasBudget, label: "Set a monthly budget", action: onBudgets, button: "Set a budget" },
    { id: "goal", done: hasGoal, label: "Set a savings goal", action: onGoals, button: "Set a goal" },
  ];
  if (steps.every((step) => step.done)) return null;
  const doneCount = steps.filter((step) => step.done).length;

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Storage is blocked: it will show again next time, which is harmless.
    }
    setDismissed(true);
  }

  return (
    <section className="panel checklist" aria-labelledby="checklist-title">
      <div className="checklist__head">
        <h2 className="panel-title" id="checklist-title">Get set up ({doneCount} of {steps.length} done)</h2>
        <button type="button" className="link-btn" onClick={dismiss}>Hide this</button>
      </div>
      <ul className="checklist__steps">
        {steps.map((step) => (
          <li key={step.id} className={step.done ? "checklist__step checklist__step--done" : "checklist__step"}>
            <span aria-hidden="true">{step.done ? "✓" : "○"}</span>
            <span>{step.label}{step.done ? " (done)" : ""}</span>
            {!step.done && step.action && (
              <button type="button" className="btn btn--secondary" onClick={step.action}>{step.button}</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
