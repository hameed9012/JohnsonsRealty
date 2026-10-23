// The house line icon set, ported from design-system/components/bundle.js (24px grid, 1.6px stroke, square ends, mitred corners).
import { cx } from "@/lib/cx";

export const ICONS = {
  "bed": ["M3 6v13","M3 15h18v4","M3 12h7v3","M10 11h8a3 3 0 0 1 3 3v1","M5.5 9.5h2.5v2h-2.5z"],
  "bath": ["M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z","M6 12V6.5a2 2 0 0 1 4 0","M7 19l-1 2","M17 19l1 2"],
  "garage": ["M3 21V9l9-5 9 5v12","M7 21v-8h10v8","M7 16h10"],
  "area": ["M4 4h16v16H4z","M8 16l8-8","M12.5 8H16v3.5","M8 12.5V16h3.5"],
  "lot": ["M3 20l4-14h10l4 14z","M9.5 6l-1 14","M14.5 6l1 14","M5 13h14"],
  "calendar": ["M4 6h16v14H4z","M4 10h16","M8 3v4","M16 3v4","M8 14h2","M14 14h2"],
  "pool": ["M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17","M3 21c2 0 2-1.5 4.5-1.5S9.5 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21","M8 14V5.5a2 2 0 0 1 4 0","M14 14V5.5a2 2 0 0 1 4 0","M8 9h6","M8 12h6"],
  "office": ["M4 14h16","M6 14v6","M18 14v6","M8 4h8v7H8z","M12 11v3"],
  "laundry": ["M5 3h14v18H5z","M5 7.5h14","M8 5.3h1.5","M8.2 14a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0 -7.6 0"],
  "gate": ["M4 21V5","M20 21V5","M4 9h16","M4 17h16","M9 9v8","M12 9v8","M15 9v8"],
  "pin": ["M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z","M9.5 9.5a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0"],
  "school": ["M2 9l10-5 10 5-10 5z","M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5","M22 9v6"],
  "police": ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z","M9 12l2 2 4-4"],
  "fire": ["M12 21c-4 0-7-2.5-7-6.5 0-3 2-5 3-7 1 2 2 3 3 3 0-3 1-5.5 3-7.5 1 3 5 5.5 5 11.5 0 4-3 6.5-7 6.5z"],
  "key": ["M4 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0","M11 12l9-9","M17 6l3 3","M14.5 8.5l2 2"],
  "document": ["M6 3h9l4 4v14H6z","M15 3v4h4","M9 12h7","M9 16h7"],
  "stamp": ["M9 13V9a3 3 0 1 1 6 0v4","M5 13h14v4H5z","M4 21h16"],
  "chat": ["M4 5h16v11H9l-5 4z"],
  "search": ["M5 11a6 6 0 1 0 12 0a6 6 0 1 0 -12 0","M20 20l-4.5-4.5"],
  "filter": ["M4 6h16","M7 12h10","M10 18h4"],
  "heart": ["M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z"],
  "arrow-right": ["M5 12h14","M13 6l6 6-6 6"],
  "lock": ["M6 11h12v10H6z","M8 11V7a4 4 0 0 1 8 0v4"],
  "camera": ["M4 7h4l2-3h4l2 3h4v13H4z","M8.5 13a3.5 3.5 0 1 0 7.0 0a3.5 3.5 0 1 0 -7.0 0"],
  "user": ["M8 8a4 4 0 1 0 8 0a4 4 0 1 0 -8 0","M4 21c1-4 4-6 8-6s7 2 8 6"],
  "users": ["M5.5 8a3.5 3.5 0 1 0 7.0 0a3.5 3.5 0 1 0 -7.0 0","M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5","M15.5 4.8a3.5 3.5 0 0 1 0 6.4","M17.5 14.8c2 .7 3.4 2.4 4 5.2"],
  "chart": ["M4 20V4","M4 20h16","M8 16v-5","M12 16V8","M16 16v-3"],
  "check": ["M5 12.5l4.5 4.5L19 7.5"],
  "menu": ["M4 7h16","M4 12h16","M4 17h16"],
  "home": ["M3 11l9-7 9 7","M5 9.5V20h14V9.5","M10 20v-6h4v6"],
  "list": ["M9 6h11","M9 12h11","M9 18h11","M4 6h1","M4 12h1","M4 18h1"],
  "pipeline": ["M4 4h4v16H4z","M10 4h4v10h-4z","M16 4h4v6h-4z"],
  "inbox": ["M4 4h16v16H4z","M4 14h4.5l1.5 2.5h4l1.5-2.5H20"],
  "bell": ["M6 16V11a6 6 0 0 1 12 0v5l2 2H4z","M10 20.5h4"],
  "activity": ["M3 12h4l3-7 4 14 3-7h4"],
  "settings": ["M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0","M12 2.5v3","M12 18.5v3","M2.5 12h3","M18.5 12h3","M5.3 5.3l2.1 2.1","M16.6 16.6l2.1 2.1","M5.3 18.7l2.1-2.1","M16.6 7.4l2.1-2.1"],
  "dollar": ["M12 3v18","M16.5 7.5c-.6-1.6-2.3-2.5-4.5-2.5-2.6 0-4.5 1.3-4.5 3.3 0 4.7 9.5 2.4 9.5 7.3 0 2-2 3.4-5 3.4-2.4 0-4.2-1-4.8-2.8"],
  "share": ["M3.5 12a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0","M15.5 6a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0","M15.5 18a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0","M8.3 10.8l7.4-3.6","M8.3 13.2l7.4 3.6"],
  "image": ["M4 5h16v14H4z","M4 16l5-5 4 4 2.5-2.5L20 17","M14.0 9a1.5 1.5 0 1 0 3.0 0a1.5 1.5 0 1 0 -3.0 0"],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  label?: string;
  className?: string;
}

export function Icon({ name, size = 20, label, className }: IconProps) {
  const d = ICONS[name] ?? [];
  return (
    <svg
      className={cx("jr-icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {d.map((x, i) => (
        <path key={i} d={x} />
      ))}
    </svg>
  );
}

Icon.names = Object.keys(ICONS) as IconName[];
