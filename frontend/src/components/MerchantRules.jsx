import { categoryLabel } from "../utils/format";
import { XIcon } from "./Icons";

/**
 * The list of remembered merchants ("walmart" goes to Shopping) with a
 * remove button on each. Removing a rule only affects future uploads;
 * transactions already stored keep the category they have.
 */
function MerchantRules({ rules, onRemove, busyId }) {
  return (
    <details className="panel merchant-rules">
      <summary>
        My merchant rules
        <span className="merchant-rules__count">{rules.length}</span>
      </summary>
      {rules.length === 0 ? (
        <p className="muted">
          No rules yet. Change a category in the table and the app will offer to remember it for that merchant.
        </p>
      ) : (
        <ul className="merchant-rules__list">
          {rules.map((rule) => (
            <li key={rule.id}>
              <span className="merchant-rules__pattern">{rule.pattern}</span>
              <span className="merchant-rules__arrow" aria-hidden="true">goes to</span>
              <span className="merchant-rules__category">{categoryLabel(rule.category)}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onRemove(rule)}
                disabled={busyId === rule.id}
                aria-label={`Remove rule for ${rule.pattern}`}
                title="Remove rule"
              >
                <XIcon width={15} height={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {rules.length > 0 && (
        <p className="muted merchant-rules__note">
          Removing a rule only affects future uploads. Transactions you already have stay as they are.
        </p>
      )}
    </details>
  );
}

export default MerchantRules;
