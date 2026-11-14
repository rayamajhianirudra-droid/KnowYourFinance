/**
 * A small decorative illustration: a stylized dollar bill with a bank card
 * resting on top of it. It is drawn here as plain SVG shapes, so there is
 * no image file to download and it uses the same color tokens as the rest
 * of the app.
 *
 * It is deliberately not a copy of anything real. The bill is a simplified
 * flat drawing with no portrait, seal or serial number, and the card has no
 * bank logo or real number. Its "number" is a row of redaction bars, which
 * is exactly what KnowYourFinance does to account numbers in a statement.
 *
 * It is hidden from screen readers because it carries no information.
 */
function MoneyArt({ className = "" }) {
  return (
    <svg
      className={`money-art ${className}`.trim()}
      viewBox="0 0 340 210"
      aria-hidden="true"
      focusable="false"
    >
      {/* ---------- The bill (behind) ---------- */}
      <g transform="rotate(-8 150 100)">
        <rect x="26" y="34" width="238" height="124" rx="10" className="art-bill" />
        {/* Inner frame */}
        <rect x="36" y="44" width="218" height="104" rx="6" className="art-bill-frame" />
        {/* Fine concentric rings behind the dollar sign, like engraving */}
        <g className="art-bill-rings">
          <circle cx="145" cy="96" r="44" />
          <circle cx="145" cy="96" r="36" />
          <circle cx="145" cy="96" r="28" />
        </g>
        <circle cx="145" cy="96" r="22" className="art-bill-seal" />
        <text x="145" y="106" textAnchor="middle" className="art-bill-dollar">$</text>
        {/* Corner marks */}
        <circle cx="58" cy="66" r="9" className="art-bill-corner" />
        <circle cx="232" cy="126" r="9" className="art-bill-corner" />
        <text x="58" y="70" textAnchor="middle" className="art-bill-corner-text">$</text>
        <text x="232" y="130" textAnchor="middle" className="art-bill-corner-text">$</text>
        {/* Side ornaments */}
        <g className="art-bill-lines">
          <line x1="52" y1="104" x2="92" y2="104" />
          <line x1="52" y1="112" x2="86" y2="112" />
          <line x1="52" y1="120" x2="92" y2="120" />
          <line x1="198" y1="72" x2="238" y2="72" />
          <line x1="204" y1="80" x2="238" y2="80" />
          <line x1="198" y1="88" x2="238" y2="88" />
        </g>
      </g>

      {/* ---------- The card (in front) ---------- */}
      <g className="art-card-group"><g transform="translate(16 12) rotate(9 238 128)">
        <rect x="150" y="76" width="168" height="106" rx="12" className="art-card" />
        {/* Soft highlight along the top edge */}
        <path d="M162 76 h144 a12 12 0 0 1 12 12 v6 h-168 v-6 a12 12 0 0 1 12 -12 z" className="art-card-shine" />
        {/* Chip */}
        <rect x="168" y="104" width="30" height="23" rx="5" className="art-card-chip" />
        <path d="M168 115.5 h30 M183 104 v23" className="art-card-chip-lines" />
        {/* Contactless waves */}
        <g className="art-card-wave">
          <path d="M214 107 q6 8 0 16" />
          <path d="M221 103 q9 12 0 24" />
          <path d="M228 99 q12 16 0 32" />
        </g>
        {/* Card number shown as redaction bars, four groups of four */}
        <g className="art-card-redact">
          <rect x="168" y="144" width="22" height="7" rx="1.5" />
          <rect x="195" y="144" width="22" height="7" rx="1.5" />
          <rect x="222" y="144" width="22" height="7" rx="1.5" />
          <rect x="249" y="144" width="22" height="7" rx="1.5" />
        </g>
        {/* Name and expiry placeholders */}
        <rect x="168" y="162" width="48" height="5" rx="2.5" className="art-card-text" />
        <rect x="270" y="162" width="28" height="5" rx="2.5" className="art-card-text" />
      </g></g>
    </svg>
  );
}

export default MoneyArt;
