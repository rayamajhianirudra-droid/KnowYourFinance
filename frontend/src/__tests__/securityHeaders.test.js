// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("index.html", () => {
  it("has no inline scripts, which the content security policy would block", () => {
    const scripts = [...read("index.html").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];

    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attributes, body] of scripts) {
      expect(attributes).toContain("src=");
      expect(body.trim()).toBe("");
    }
  });

  it("loads the theme script in the head as a blocking script", () => {
    const head = read("index.html").split("</head>")[0];

    expect(head).toContain('<script src="/theme-init.js"></script>');
  });
});

describe("theme-init.js", () => {
  const run = ({ saved = null, prefersDark = false } = {}) => {
    let theme = null;
    const storage = { getItem: (key) => (key === "kyf-theme" ? saved : null) };
    const window = { matchMedia: () => ({ matches: prefersDark }) };
    const document = { documentElement: { setAttribute: (name, value) => { if (name === "data-theme") theme = value; } } };
    new Function("localStorage", "window", "document", read("public/theme-init.js"))(storage, window, document);
    return theme;
  };

  it("uses the saved choice over the system setting", () => {
    expect(run({ saved: "dark", prefersDark: false })).toBe("dark");
    expect(run({ saved: "light", prefersDark: true })).toBe("light");
  });

  it("follows the system setting when nothing valid is saved", () => {
    expect(run({ prefersDark: true })).toBe("dark");
    expect(run({ saved: "purple", prefersDark: false })).toBe("light");
  });
});

describe("nginx.conf", () => {
  const include = "include /etc/nginx/snippets/security-headers.conf;";

  it("includes the security headers at server level and wherever add_header is used", () => {
    const config = read("nginx.conf");
    const locations = [...config.matchAll(/location\s+\S+\s*\{([^}]*)\}/g)].map((match) => match[1]);

    expect(config.split(/location\s+\S+\s*\{/)[0]).toContain(include);
    for (const body of locations.filter((text) => /^\s*add_header\s/m.test(text))) {
      expect(body).toContain(include);
    }
  });

  it("sends each required header, and does not allow inline scripts", () => {
    const headers = read("security-headers.conf");

    expect(headers).toContain('X-Content-Type-Options "nosniff" always;');
    expect(headers).toContain('X-Frame-Options "DENY" always;');
    expect(headers).toContain('Referrer-Policy "no-referrer" always;');
    expect(headers).toContain('Permissions-Policy "camera=(), microphone=(), geolocation=()" always;');
    // Only this site's own scripts run. 'wasm-unsafe-eval' is there so the
    // receipt reader's WebAssembly can start; it does not allow inline
    // scripts or eval().
    expect(headers).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(headers).not.toContain("'unsafe-inline'");
    expect(headers).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(headers).not.toMatch(/script-src[^;]*https?:/);
  });
});
