import MoneyArt from "./MoneyArt";

/**
 * The top of a page: the title, a short line under it, and (optionally) the
 * money illustration on the right. Pages that do not pass `art` get a plain
 * heading, so the illustration stays a treat on the screens where it fits
 * (the Dashboard and the Upload page) and does not repeat everywhere.
 */
function PageHero({ title, subtitle, art = false, children }) {
  return (
    <header className={`page-hero${art ? " page-hero--art" : ""}`}>
      <div className="page-hero__text">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {art && <MoneyArt className="page-hero__art" />}
    </header>
  );
}

export default PageHero;
