import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MoneyArt from "../components/MoneyArt";
import PageHero from "../components/PageHero";

afterEach(cleanup);

describe("MoneyArt", () => {
  it("is hidden from screen readers because it is only decoration", () => {
    const { container } = render(<MoneyArt />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("shows no real card number, only redaction bars", () => {
    const { container } = render(<MoneyArt />);
    // The only text in the drawing is dollar signs. No digits anywhere.
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.querySelectorAll(".art-card-redact rect").length).toBe(4);
  });
});

describe("PageHero", () => {
  it("shows the illustration only when asked", () => {
    const withArt = render(<PageHero title="A" art />);
    expect(withArt.container.querySelector(".money-art")).not.toBeNull();
    cleanup();
    const without = render(<PageHero title="B" />);
    expect(without.container.querySelector(".money-art")).toBeNull();
  });

  it("renders the title as the page heading", () => {
    const { getByRole } = render(<PageHero title="Dashboard" subtitle="Hello" />);
    expect(getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
  });
});
