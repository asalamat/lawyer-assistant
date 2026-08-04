// Minimal inline-SVG icon set — no external icon font/package dependency.
// Each icon is a plain 24x24 stroke-based glyph sized via currentColor so it
// inherits text color and can be recolored/sized with normal Tailwind classes.

import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(children: ReactNode, props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (props: IconProps) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>,
    props,
  );

export const MattersIcon = (props: IconProps) =>
  base(
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>,
    props,
  );

export const AuditIcon = (props: IconProps) =>
  base(
    <>
      <path d="M9 3h6l3 3v15H6V6z" />
      <path d="M9 3v3H6" />
      <path d="M9 12l2 2 4-4" />
    </>,
    props,
  );

export const SettingsIcon = (props: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
    props,
  );

export const HelpIcon = (props: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 1.75-2 3.5" />
      <path d="M12 17h.01" />
    </>,
    props,
  );

export const SunIcon = (props: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>,
    props,
  );

export const MoonIcon = (props: IconProps) =>
  base(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />, props);

export const MonitorIcon = (props: IconProps) =>
  base(
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>,
    props,
  );

export const AiIcon = (props: IconProps) =>
  base(
    <>
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 3l1.5 3M15 3l-1.5 3M9 13h.01M15 13h.01" />
    </>,
    props,
  );

export const IntegrationIcon = (props: IconProps) =>
  base(
    <>
      <rect x="2" y="6" width="8" height="8" rx="2" />
      <rect x="14" y="10" width="8" height="8" rx="2" />
      <path d="M10 10h4" />
    </>,
    props,
  );

export const SecurityIcon = (props: IconProps) =>
  base(<path d="M12 2l8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z" />, props);

export const UpdateIcon = (props: IconProps) =>
  base(
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </>,
    props,
  );

export const BackupIcon = (props: IconProps) =>
  base(
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </>,
    props,
  );

export const UsersIcon = (props: IconProps) =>
  base(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
    props,
  );

export const SearchIcon = (props: IconProps) =>
  base(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>,
    props,
  );

export const LogoutIcon = (props: IconProps) =>
  base(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>,
    props,
  );

export const OverviewIcon = (props: IconProps) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </>,
    props,
  );

export const DocumentIcon = (props: IconProps) =>
  base(
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M15 2v5h5M9 13h6M9 17h6" />
    </>,
    props,
  );

export const DigestIcon = (props: IconProps) =>
  base(
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8M8 13h8M8 17h4" />
    </>,
    props,
  );

export const DeadlineIcon = (props: IconProps) =>
  base(
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>,
    props,
  );

export const EvidenceIcon = (props: IconProps) =>
  base(
    <>
      <path d="M12 3v18M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" />
      <path d="M5 7h14M9 21h6" />
    </>,
    props,
  );

export const DraftIcon = (props: IconProps) =>
  base(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>,
    props,
  );

export const TimesheetIcon = (props: IconProps) =>
  base(
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4M12 13v3l2 1" />
    </>,
    props,
  );

export const ActivityIcon = (props: IconProps) =>
  base(<path d="M3 12h4l2-7 4 14 2-7h6" />, props);

export const ChatIcon = (props: IconProps) =>
  base(
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>,
    props,
  );

export const MicIcon = (props: IconProps) =>
  base(
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
    </>,
    props,
  );

export const MailIcon = (props: IconProps) =>
  base(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 6 10-6" />
    </>,
    props,
  );

export const NoteIcon = (props: IconProps) =>
  base(
    <>
      <path d="M9 2h9a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
      <path d="M9 2v5H4M8 12h8M8 16h5" />
    </>,
    props,
  );

export const ReviewIcon = (props: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>,
    props,
  );

export const LibraryIcon = (props: IconProps) =>
  base(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7" />
    </>,
    props,
  );

export const ScaleIcon = (props: IconProps) =>
  base(
    <>
      <path d="M12 3v18M8 21h8" />
      <path d="M5 7h6M13 7h6" />
      <path d="M3 7l2.5 6a2.5 2.5 0 0 0 5 0L8 7" />
      <path d="M13 7l2.5 6a2.5 2.5 0 0 0 5 0L18 7" />
    </>,
    props,
  );

export const PanelCollapseIcon = (props: IconProps) =>
  base(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M14.5 9.5L12 12l2.5 2.5" />
    </>,
    props,
  );

export const PanelExpandIcon = (props: IconProps) =>
  base(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M12.5 9.5L15 12l-2.5 2.5" />
    </>,
    props,
  );
