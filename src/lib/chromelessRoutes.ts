// Routes that should render with none of the app-wide chrome (sidebar, top
// utility bar) — either because they're pre-auth (/login) or because
// they're deliberately distraction-free full-screen views opened in a new
// tab (e.g. /graph-view for evidence/defence graphs, PDF export). Shared by
// ConditionalNav and TopUtilityBar so both stay in sync.
export function isChromelessRoute(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/graph-view/") ||
    pathname.startsWith("/export/pdf")
  );
}
