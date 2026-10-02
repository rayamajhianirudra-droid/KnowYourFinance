import { InboxIcon, UploadIcon, PlusIcon } from "./Icons";

/**
 * A reusable empty state: an icon, a plain-language explanation of why
 * this section is blank, and (optionally) the two actions that would
 * actually fill it. Used instead of a bare "no data" sentence anywhere
 * the dashboard/transactions list might legitimately have nothing yet
 * - a first-time user's screen, which otherwise be the very first
 * impression of the product being a wall of plain text.
 */
function EmptyState({ title, message, onUploadClick, onAddClick }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <InboxIcon width={26} height={26} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {(onUploadClick || onAddClick) && (
        <div className="empty-state__actions">
          {onUploadClick && (
            <button type="button" className="btn btn--primary" onClick={onUploadClick}>
              <UploadIcon width={16} height={16} aria-hidden="true" />
              Upload Statement
            </button>
          )}
          {onAddClick && (
            <button type="button" className="btn btn--secondary" onClick={onAddClick}>
              <PlusIcon width={16} height={16} aria-hidden="true" />
              Add Transaction
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
