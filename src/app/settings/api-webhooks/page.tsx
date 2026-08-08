import { listApiKeys } from "@/lib/apiKeys";
import { listWebhookSubscriptions } from "@/lib/webhooks";
import { IntegrationIcon } from "@/components/icons";
import ApiKeysAndWebhooksPanel from "@/components/ApiKeysAndWebhooksPanel";
import SettingsSection from "@/components/SettingsSection";

export const dynamic = "force-dynamic";

export default async function ApiWebhooksSettingsPage() {
  const [apiKeys, webhooks] = await Promise.all([listApiKeys(), listWebhookSubscriptions()]);

  return (
    <SettingsSection
      title="API & webhooks"
      description="Generate an API key for external tools to read/write leads and matters, and register webhook URLs to notify when a lead or matter is created — point either at Zapier's generic Webhooks trigger, n8n, or anything else. Admin-only."
      icon={IntegrationIcon}
    >
      <ApiKeysAndWebhooksPanel initialApiKeys={apiKeys} initialWebhooks={webhooks} />
    </SettingsSection>
  );
}
