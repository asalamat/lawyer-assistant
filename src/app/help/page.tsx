import { getCurrentUser } from "@/lib/auth";
import { getAppVersion } from "@/lib/systemInfo";
import HelpGuide from "@/components/HelpGuide";

export default async function HelpIndexPage() {
  const version = await getAppVersion();
  const user = await getCurrentUser();
  return <HelpGuide version={version} isAdmin={user?.role === "admin"} />;
}
