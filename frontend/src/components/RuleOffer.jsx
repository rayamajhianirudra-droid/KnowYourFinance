import { useState } from "react";
import { categoryLabel } from "../utils/format";

/**
 * Shown right after a category is changed by hand. Asks whether to
 * remember the merchant, lets the person edit the merchant text, and says
 * how many other transactions would change.
 */
function RuleOffer({ offer, matches, busy, error, onAccept, onDismiss, onPatternChange }) {
  const [applyAll, setApplyAll] = useState(true);
  const pattern = offer.pattern;
  const tooShort = pattern.trim().length < 2;

  return (
    <div className="panel rule-offer" role="region" aria-label="Remember this merchant">
      <p className="rule-offer__text">
        Always put{" "}
        <input
          type="text"
          className="rule-offer__pattern"
          value={pattern}
          onChange={(e) => onPatternChange(e.target.value)}
          aria-label="Merchant name to remember"
          maxLength={60}
        />{" "}
        in <strong>{categoryLabel(offer.category)}</strong>?
      </p>
      {matches(pattern) > 0 && (
        <label className="rule-offer__check">
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
          Also change {matches(pattern)} other matching transaction{matches(pattern) === 1 ? "" : "s"}
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="rule-offer__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || tooShort}
          onClick={() => onAccept(applyAll && matches(pattern) > 0)}
        >
          {busy ? "Saving..." : "Yes, remember it"}
        </button>
        <button type="button" className="btn btn--text" onClick={onDismiss} disabled={busy}>
          Just this one
        </button>
      </div>
    </div>
  );
}

export default RuleOffer;
