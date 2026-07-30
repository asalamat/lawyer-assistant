import { getAnthropicApiKeyStatus } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const status = await getAnthropicApiKeyStatus();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm initialStatus={status} />
    </main>
  );
}
