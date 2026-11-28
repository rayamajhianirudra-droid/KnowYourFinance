/**
 * Turns a raw browser User-Agent string into a short, friendly label like
 * "Chrome on macOS" for the devices and activity lists. Order matters: Chrome's
 * User-Agent also contains "Safari", and Edge's contains "Chrome", so the more
 * specific names are checked first.
 */
export function deviceName(userAgent) {
  if (!userAgent || userAgent === "Unknown device") return "Unknown device";
  const ua = userAgent;

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return os ? `${browser} on ${os}` : browser;
}
