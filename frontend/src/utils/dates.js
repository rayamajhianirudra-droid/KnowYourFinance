// Date helpers for the date pickers.
//
// The old code used new Date().toISOString().slice(0, 10), which prints the
// date in UTC. In the evening in Minnesota (UTC-6) that is already
// tomorrow's date, so "today" in the form was a day ahead. These helpers
// build the yyyy-mm-dd text from the person's own local calendar instead.

/** Formats a Date as yyyy-mm-dd using the local calendar day. */
export function toLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's local date as yyyy-mm-dd. */
export function todayInput() {
  return toLocalDateInput(new Date());
}
