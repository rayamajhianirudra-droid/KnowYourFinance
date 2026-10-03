// A small set of hand-picked line icons, all sharing the same 1.5px
// stroke weight and 20x20 viewbox, so the nav/cards/empty-states read
// as one consistent system instead of a grab-bag of styles. No icon
// library - this app only needs about a dozen icons, which is cheap
// enough to hand-draw and keeps the dependency list small.

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function DashboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="6.5" height="8" rx="1.5" />
      <rect x="11" y="2.5" width="6.5" height="5" rx="1.5" />
      <rect x="11" y="9.5" width="6.5" height="8" rx="1.5" />
      <rect x="2.5" y="12.5" width="6.5" height="5" rx="1.5" />
    </svg>
  );
}

export function UploadIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 12.5V3" />
      <path d="M6 7l4-4 4 4" />
      <path d="M3.5 13v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 4.5v11" />
      <path d="M4.5 10h11" />
    </svg>
  );
}

export function ListIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 5h10" />
      <path d="M7 10h10" />
      <path d="M7 15h10" />
      <circle cx="3.2" cy="5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="3.2" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="3.2" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LockIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="9" width="11" height="8" rx="2" />
      <path d="M6.75 9V6.5a3.25 3.25 0 0 1 6.5 0V9" />
    </svg>
  );
}

export function ArrowUpIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 15.5V4.5" />
      <path d="M5.5 9l4.5-4.5L14.5 9" />
    </svg>
  );
}

export function ArrowDownIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 4.5v11" />
      <path d="M5.5 11l4.5 4.5L14.5 11" />
    </svg>
  );
}

export function IncomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v7" />
      <path d="M7.5 9l2.5-2.5L12.5 9" />
    </svg>
  );
}

export function ExpenseIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v7" />
      <path d="M7.5 11l2.5 2.5L12.5 11" />
    </svg>
  );
}

export function SavingsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 11.5c0-3.5 2.8-6 6.5-6s6.5 2.3 6.5 5-2 4-2 4v1.5a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1V15h-2v.5a1 1 0 0 1-1 1H8.2" />
      <circle cx="13.2" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RateIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 16L16 4" />
      <circle cx="6.5" cy="6.5" r="2" />
      <circle cx="13.5" cy="13.5" r="2" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8.8" cy="8.8" r="5.3" />
      <path d="M16 16l-3.4-3.4" />
    </svg>
  );
}

export function FileIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 2.5h6l3 3v12a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
      <path d="M11.5 2.5v3h3" />
    </svg>
  );
}

export function InboxIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11l2.2-6.6A1.5 1.5 0 0 1 6.6 3.5h6.8a1.5 1.5 0 0 1 1.4.9L17 11" />
      <path d="M3 11v4a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 15v-4" />
      <path d="M3 11h4.2a1.3 1.3 0 0 1 1.2.8l.3.7a1.3 1.3 0 0 0 1.2.8h.2a1.3 1.3 0 0 0 1.2-.8l.3-.7a1.3 1.3 0 0 1 1.2-.8H17" />
    </svg>
  );
}

export function CheckCircleIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M6.8 10.2l2.2 2.2 4.2-4.8" />
    </svg>
  );
}

export function AlertIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3.5l7.5 13h-15z" />
      <path d="M10 8.3v3.3" />
      <circle cx="10" cy="14.1" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  );
}

export function EditIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12.3 3.8l3.9 3.9-9 9-4.4 1 1-4.4z" />
      <path d="M10.9 5.2l3.9 3.9" />
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h12" />
      <path d="M7.5 6V4.3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
      <path d="M5.5 6l.6 9.3a1.3 1.3 0 0 0 1.3 1.2h5.2a1.3 1.3 0 0 0 1.3-1.2L14.5 6" />
      <path d="M8.3 9v4.5" />
      <path d="M11.7 9v4.5" />
    </svg>
  );
}

export function XIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 5.5l9 9" />
      <path d="M14.5 5.5l-9 9" />
    </svg>
  );
}
