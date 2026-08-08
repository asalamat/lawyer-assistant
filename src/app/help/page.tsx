import { getAppVersion } from "@/lib/systemInfo";
import HelpGuide from "@/components/HelpGuide";

export default async function HelpIndexPage() {
  const version = await getAppVersion();
  return <HelpGuide version={version} />;
}
