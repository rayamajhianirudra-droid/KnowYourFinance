// The small text file a person keeps somewhere safe. It holds the two things
// needed to get back into an account: the email it was made with, and the
// one-time recovery code. Nothing else, and never the password.

export function buildRecoverySheet(email, code) {
  return [
    "KnowYourFinance recovery sheet",
    "",
    `Account email: ${email}`,
    `Recovery code: ${code}`,
    "",
    "If you forget your password, choose Forgot password on the sign-in page",
    "and enter this email and code. Each code works once; you get a new one",
    "after using it. Keep this file somewhere private. Anyone with the code",
    "and your email can reset your password.",
    "",
  ].join("\n");
}

export function downloadRecoverySheet(email, code) {
  const blob = new Blob([buildRecoverySheet(email, code)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "knowyourfinance-recovery.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
