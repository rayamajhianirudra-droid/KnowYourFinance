import { useEffect, useRef, useState } from "react";
import { saveProfile } from "../api";
import { initials } from "../utils/names";

/**
 * The person's name in the top bar. It shows their initials and full
 * name. Pressing it opens a small form to add or change the name. With no
 * name saved yet it invites them to add one.
 */
function ProfileBadge({ fullName, onSaved }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes the form and clicking elsewhere does too.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function openForm() {
    setDraft(fullName || "");
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProfile(draft);
      onSaved(saved.fullName);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const label = fullName ? `Your profile: ${fullName}` : "Add your name";

  return (
    <div className="profile" ref={wrapperRef}>
      <button
        type="button"
        className="profile__button"
        onClick={() => (open ? setOpen(false) : openForm())}
        aria-expanded={open}
        aria-label={label}
      >
        <span className="profile__avatar" aria-hidden="true">{initials(fullName) || "+"}</span>
        <span className="profile__name">{fullName || "Add your name"}</span>
      </button>

      {open && (
        <form className="profile__panel" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Full name</span>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={80}
              autoComplete="name"
              placeholder="e.g. Ada Lovelace"
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={Boolean(error)}
            />
            {error && <span className="field__error" role="alert">{error}</span>}
          </label>
          <div className="profile__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving..." : "Save name"}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ProfileBadge;
