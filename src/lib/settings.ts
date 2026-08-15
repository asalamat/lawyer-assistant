import { randomBytes } from "crypto";
import { decryptText, encryptText, isEncryptedText } from "./crypto";
import { readSecureJson, writeSecureJson } from "./secureStore";

const SETTINGS_FILE = "settings.json";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

// JWT Grant (server-to-server, no interactive login) + remote signing
// (DocuSign emails the recipient and hosts the whole signing ceremony on
// its own site) — the only combination that works for an app with no
// public URL of its own. See src/lib/docusign.ts.
export interface DocuSignConfig {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  demo: boolean;
  enabled: boolean;
}

// Twilio's REST API is called directly via fetch (Basic Auth with
// accountSid:authToken) — no SDK dependency needed for send + list.
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
}

// One-way invoice sync (this app -> QuickBooks Online), Intuit's standard
// OAuth 2.0 authorization-code flow (no PKCE — Intuit doesn't require it
// the way Google/Microsoft's public-client flows do). App registration
// (set once, admin step) and the resulting connection (set after the
// OAuth round-trip) are separate objects, same reasoning as Drive/OneDrive
// splitting driveOAuthApp.ts from the connection in settings.ts — only one
// provider here, so both still live in this file rather than a dedicated one.
export interface QuickBooksAppCredentials {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
}

export interface QuickBooksConnection {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string | null;
  companyName: string | null;
}

// Stripe Checkout (hosted payment page) — no card data ever touches this
// app, so no PCI scope beyond redirecting to Stripe's own page. No webhook
// secret stored/needed: this app has no public URL for Stripe to call, so
// payment confirmation is done by polling Stripe's API directly instead
// (see stripe.ts / stripePaymentScheduler.ts), same reasoning as the
// DocuSign/Twilio integrations.
export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
}

export interface WeatherLocation {
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
}

export type AiProvider = "anthropic" | "openai" | "gemini" | "ollama";

// Independent review draws from a wider provider universe than the primary
// chain above — DeepSeek and Moonshot are review-only (see the AI model
// settings page for why: most primary features need strict structured-JSON
// output, which those two aren't verified to support as reliably as the
// four primary providers; a review is always plain text, so that risk
// doesn't apply here). A fallback SEQUENCE, not a single pick — same
// failover behavior as the primary chain, just a separate order.
export type IndependentReviewProvider = "anthropic" | "openai" | "gemini" | "ollama" | "deepseek" | "moonshot";

export const AI_PROVIDER_LABELS: Record<IndependentReviewProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  gemini: "Google (Gemini)",
  ollama: "Ollama (local)",
  deepseek: "DeepSeek",
  moonshot: "Moonshot AI (Kimi)",
};
// ollama last by default — it's the only provider that runs entirely on
// this machine (no account, no cost, no data ever leaving it), which also
// means its output quality depends entirely on which local model the
// account owner has pulled. A good fit as the last-resort/sensitive-local
// option the original architecture doc called for, not as the default
// first choice.
const DEFAULT_AI_PROVIDER_ORDER: AiProvider[] = ["anthropic", "openai", "gemini", "ollama"];

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export interface PiiMaskingSettings {
  enabled: boolean;
  sin: boolean;
  ssn: boolean;
  creditCard: boolean;
  phone: boolean;
  email: boolean;
}

const DEFAULT_PII_MASKING: PiiMaskingSettings = {
  enabled: true,
  sin: true,
  ssn: true,
  creditCard: true,
  phone: true,
  email: true,
};

export type CloudBackupProvider = "s3" | "google-drive" | "onedrive";

export interface S3BackupConfig {
  provider: "s3";
  // Blank endpoint = real AWS S3 (region-derived default endpoint). Set this
  // for any other S3-compatible provider — Cloudflare R2, Backblaze B2,
  // Wasabi, DigitalOcean Spaces, MinIO, etc. — this is what makes the
  // feature "any cloud", not just AWS.
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
  // Path-style (bucket in the URL path) is required by some non-AWS
  // providers/self-hosted MinIO; AWS itself supports either.
  forcePathStyle?: boolean;
}

export interface DriveBackupConfig {
  provider: "google-drive" | "onedrive";
  accessToken: string;
  refreshToken: string;
  // Google Drive addresses uploads by folder ID (created on first connect);
  // OneDrive addresses uploads by path instead, so this stays unused there.
  folderId?: string;
}

// Single-literal-discriminant variants of DriveBackupConfig, used only in
// the CloudBackupConfig union below — TypeScript can't fully narrow a
// union member out of a larger union via control flow when that member's
// own discriminant property is itself a union of two literals (as
// DriveBackupConfig's is), so cloudBackup.ts's provider dispatch needs
// these instead to narrow CloudBackupConfig cleanly. cloudDriveBackup.ts
// itself still uses the plain DriveBackupConfig shape throughout, since it
// never narrows on `.provider` — it's always told which provider via a
// separate parameter.
export interface GoogleDriveBackupConfig extends Omit<DriveBackupConfig, "provider"> {
  provider: "google-drive";
}
export interface OneDriveBackupConfig extends Omit<DriveBackupConfig, "provider"> {
  provider: "onedrive";
}

export type CloudBackupConfig = S3BackupConfig | GoogleDriveBackupConfig | OneDriveBackupConfig;

// Flat on-disk shape covering every provider's fields as optional — simpler
// than a real discriminated union in JSON, since only `provider` says which
// subset is actually populated. getCloudBackupConfig() reassembles the
// right typed shape for whichever provider is currently active.
interface StoredCloudBackup {
  provider?: CloudBackupProvider;
  // S3 fields
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix?: string;
  forcePathStyle?: boolean;
  // Google Drive / OneDrive fields
  driveAccessToken?: string;
  driveRefreshToken?: string;
  driveTokenExpiresAt?: string;
  driveAccountEmail?: string;
  driveFolderId?: string;
  // Shared status
  lastRunAt?: string;
  lastStatus?: "ok" | "error";
  lastError?: string;
  lastUploadedFileName?: string;
}

export interface BackupScheduleConfig {
  enabled: boolean;
  intervalHours: number;
}

interface StoredBackupSchedule extends BackupScheduleConfig {
  lastRunAt?: string;
  lastStatus?: "ok" | "error";
  lastError?: string;
}

const DEFAULT_BACKUP_SCHEDULE: BackupScheduleConfig = { enabled: false, intervalHours: 1 };

export interface ChangeBackupConfig {
  enabled: boolean;
  // How long the app needs to go quiet after the last change before
  // backing up — resets on every new change, so a burst of activity
  // doesn't trigger a backup mid-burst.
  debounceMinutes: number;
  // Floor between two change-triggered backups regardless of how much
  // activity happens — prevents continuous usage from running full
  // backups back to back all day.
  cooldownMinutes: number;
}

interface StoredChangeBackup extends ChangeBackupConfig {
  lastRunAt?: string;
  lastStatus?: "ok" | "error";
  lastError?: string;
}

const DEFAULT_CHANGE_BACKUP: ChangeBackupConfig = {
  enabled: false,
  debounceMinutes: 2,
  cooldownMinutes: 10,
};

interface Settings {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  moonshotApiKey?: string;
  independentReviewProviderOrder?: IndependentReviewProvider[];
  canliiApiKey?: string;
  smtp?: SmtpConfig;
  docusign?: DocuSignConfig;
  twilio?: TwilioConfig;
  // Cursor for smsScheduler.ts's inbound-SMS poll — no public URL for
  // Twilio to webhook to (same constraint as DocuSign), so it polls
  // Twilio's message list instead, same reasoning as docusignScheduler.ts.
  lastSmsPollAt?: string;
  quickbooksApp?: QuickBooksAppCredentials;
  quickbooksConnection?: QuickBooksConnection;
  stripe?: StripeConfig;
  location?: WeatherLocation;
  aiProviderOrder?: AiProvider[];
  cronSecret?: string;
  calendarFeedSecret?: string;
  defaultTranslationLanguage?: string;
  piiMasking?: Partial<PiiMaskingSettings>;
  ollama?: Partial<OllamaConfig>;
  malwareScanningEnabled?: boolean;
  cloudBackup?: StoredCloudBackup;
  backupSchedule?: StoredBackupSchedule;
  changeBackup?: StoredChangeBackup;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  disbursementCategories?: string[];
}

export const DEFAULT_TRANSLATION_LANGUAGE = "French";

const SECRET_FIELDS = [
  "anthropicApiKey",
  "openaiApiKey",
  "geminiApiKey",
  "deepseekApiKey",
  "moonshotApiKey",
  "canliiApiKey",
  "cronSecret",
  "calendarFeedSecret",
  "vapidPrivateKey",
] as const;

// Settings secrets are encrypted at rest. Values written before this feature
// shipped are still plaintext on disk — migrate them to encrypted form the
// first time they're read, so nothing needs a separate migration script.
async function readSettings(): Promise<Settings> {
  const settings = await readSecureJson<Settings>(SETTINGS_FILE, {});
  let migrated = false;
  for (const field of SECRET_FIELDS) {
    const value = settings[field];
    if (typeof value === "string" && !isEncryptedText(value)) {
      settings[field] = await encryptText(value);
      migrated = true;
    }
  }
  if (settings.smtp?.password && !isEncryptedText(settings.smtp.password)) {
    settings.smtp.password = await encryptText(settings.smtp.password);
    migrated = true;
  }
  if (settings.docusign?.privateKey && !isEncryptedText(settings.docusign.privateKey)) {
    settings.docusign.privateKey = await encryptText(settings.docusign.privateKey);
    migrated = true;
  }
  if (settings.twilio?.authToken && !isEncryptedText(settings.twilio.authToken)) {
    settings.twilio.authToken = await encryptText(settings.twilio.authToken);
    migrated = true;
  }
  if (settings.quickbooksApp?.clientSecret && !isEncryptedText(settings.quickbooksApp.clientSecret)) {
    settings.quickbooksApp.clientSecret = await encryptText(settings.quickbooksApp.clientSecret);
    migrated = true;
  }
  if (settings.quickbooksConnection?.accessToken && !isEncryptedText(settings.quickbooksConnection.accessToken)) {
    settings.quickbooksConnection.accessToken = await encryptText(settings.quickbooksConnection.accessToken);
    migrated = true;
  }
  if (settings.quickbooksConnection?.refreshToken && !isEncryptedText(settings.quickbooksConnection.refreshToken)) {
    settings.quickbooksConnection.refreshToken = await encryptText(settings.quickbooksConnection.refreshToken);
    migrated = true;
  }
  if (settings.stripe?.secretKey && !isEncryptedText(settings.stripe.secretKey)) {
    settings.stripe.secretKey = await encryptText(settings.stripe.secretKey);
    migrated = true;
  }
  if (settings.cloudBackup?.accessKeyId && !isEncryptedText(settings.cloudBackup.accessKeyId)) {
    settings.cloudBackup.accessKeyId = await encryptText(settings.cloudBackup.accessKeyId);
    migrated = true;
  }
  if (settings.cloudBackup?.secretAccessKey && !isEncryptedText(settings.cloudBackup.secretAccessKey)) {
    settings.cloudBackup.secretAccessKey = await encryptText(settings.cloudBackup.secretAccessKey);
    migrated = true;
  }
  if (settings.cloudBackup?.driveAccessToken && !isEncryptedText(settings.cloudBackup.driveAccessToken)) {
    settings.cloudBackup.driveAccessToken = await encryptText(settings.cloudBackup.driveAccessToken);
    migrated = true;
  }
  if (settings.cloudBackup?.driveRefreshToken && !isEncryptedText(settings.cloudBackup.driveRefreshToken)) {
    settings.cloudBackup.driveRefreshToken = await encryptText(settings.cloudBackup.driveRefreshToken);
    migrated = true;
  }
  if (migrated) await writeSecureJson(SETTINGS_FILE, settings);
  return settings;
}

async function writeSettings(settings: Settings): Promise<void> {
  await writeSecureJson(SETTINGS_FILE, settings);
}

async function decryptSecret(value: string | undefined): Promise<string | undefined> {
  return value ? decryptText(value) : undefined;
}

export async function getAnthropicApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
}

export async function setAnthropicApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.anthropicApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getAnthropicApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.anthropicApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getGeminiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.geminiApiKey)) || process.env.GEMINI_API_KEY;
}

export async function setGeminiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.geminiApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getGeminiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.geminiApiKey)) || process.env.GEMINI_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.geminiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getDeepseekApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.deepseekApiKey)) || process.env.DEEPSEEK_API_KEY;
}

export async function setDeepseekApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.deepseekApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getDeepseekApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.deepseekApiKey)) || process.env.DEEPSEEK_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.deepseekApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getMoonshotApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.moonshotApiKey)) || process.env.MOONSHOT_API_KEY;
}

export async function setMoonshotApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.moonshotApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getMoonshotApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.moonshotApiKey)) || process.env.MOONSHOT_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.moonshotApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getIndependentReviewProviderOrder(): Promise<IndependentReviewProvider[]> {
  const settings = await readSettings();
  return settings.independentReviewProviderOrder ?? ["openai"];
}

export async function setIndependentReviewProviderOrder(order: IndependentReviewProvider[]): Promise<void> {
  const settings = await readSettings();
  settings.independentReviewProviderOrder = order;
  await writeSettings(settings);
}

export async function getSmtpConfig(): Promise<SmtpConfig | undefined> {
  const settings = await readSettings();
  if (!settings.smtp) return undefined;
  return { ...settings.smtp, password: await decryptText(settings.smtp.password) };
}

export async function setSmtpConfig(config: SmtpConfig): Promise<void> {
  const settings = await readSettings();
  settings.smtp = { ...config, password: await encryptText(config.password) };
  await writeSettings(settings);
}

// Returns the config with the password redacted, for display in the UI.
export async function getSmtpStatus(): Promise<{
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  fromName: string | null;
  fromEmail: string | null;
}> {
  const settings = await readSettings();
  const smtp = settings.smtp;
  if (!smtp) {
    return {
      configured: false,
      host: null,
      port: null,
      secure: true,
      username: null,
      fromName: null,
      fromEmail: null,
    };
  }
  return {
    configured: true,
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    username: smtp.username,
    fromName: smtp.fromName,
    fromEmail: smtp.fromEmail,
  };
}

export async function getTwilioConfig(): Promise<TwilioConfig | undefined> {
  const settings = await readSettings();
  if (!settings.twilio) return undefined;
  return { ...settings.twilio, authToken: await decryptText(settings.twilio.authToken) };
}

export async function setTwilioConfig(config: TwilioConfig): Promise<void> {
  const settings = await readSettings();
  settings.twilio = { ...config, authToken: await encryptText(config.authToken) };
  await writeSettings(settings);
}

export async function getTwilioStatus(): Promise<{
  configured: boolean;
  accountSid: string | null;
  fromPhoneNumber: string | null;
}> {
  const settings = await readSettings();
  const twilio = settings.twilio;
  if (!twilio) return { configured: false, accountSid: null, fromPhoneNumber: null };
  return { configured: true, accountSid: twilio.accountSid, fromPhoneNumber: twilio.fromPhoneNumber };
}

export async function getLastSmsPollAt(): Promise<string | undefined> {
  const settings = await readSettings();
  return settings.lastSmsPollAt;
}

export async function setLastSmsPollAt(iso: string): Promise<void> {
  const settings = await readSettings();
  settings.lastSmsPollAt = iso;
  await writeSettings(settings);
}

export async function getQuickBooksAppCredentials(): Promise<QuickBooksAppCredentials | undefined> {
  const settings = await readSettings();
  if (!settings.quickbooksApp) return undefined;
  return { ...settings.quickbooksApp, clientSecret: await decryptText(settings.quickbooksApp.clientSecret) };
}

export async function setQuickBooksAppCredentials(app: QuickBooksAppCredentials): Promise<void> {
  const settings = await readSettings();
  settings.quickbooksApp = { ...app, clientSecret: await encryptText(app.clientSecret) };
  await writeSettings(settings);
}

export async function getQuickBooksConnection(): Promise<QuickBooksConnection | undefined> {
  const settings = await readSettings();
  if (!settings.quickbooksConnection) return undefined;
  return {
    ...settings.quickbooksConnection,
    accessToken: await decryptText(settings.quickbooksConnection.accessToken),
    refreshToken: await decryptText(settings.quickbooksConnection.refreshToken),
  };
}

export async function saveQuickBooksConnection(connection: QuickBooksConnection): Promise<void> {
  const settings = await readSettings();
  settings.quickbooksConnection = {
    ...connection,
    accessToken: await encryptText(connection.accessToken),
    refreshToken: await encryptText(connection.refreshToken),
  };
  await writeSettings(settings);
}

export async function updateQuickBooksTokens(
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: string | null,
): Promise<void> {
  const settings = await readSettings();
  if (!settings.quickbooksConnection) return;
  settings.quickbooksConnection = {
    ...settings.quickbooksConnection,
    accessToken: await encryptText(accessToken),
    refreshToken: await encryptText(refreshToken),
    tokenExpiresAt,
  };
  await writeSettings(settings);
}

export async function disconnectQuickBooks(): Promise<void> {
  const settings = await readSettings();
  delete settings.quickbooksConnection;
  await writeSettings(settings);
}

export async function getQuickBooksStatus(): Promise<{
  appConfigured: boolean;
  sandbox: boolean;
  connected: boolean;
  companyName: string | null;
  realmId: string | null;
}> {
  const settings = await readSettings();
  return {
    appConfigured: Boolean(settings.quickbooksApp),
    sandbox: settings.quickbooksApp?.sandbox ?? true,
    connected: Boolean(settings.quickbooksConnection),
    companyName: settings.quickbooksConnection?.companyName ?? null,
    realmId: settings.quickbooksConnection?.realmId ?? null,
  };
}

export async function getStripeConfig(): Promise<StripeConfig | undefined> {
  const settings = await readSettings();
  if (!settings.stripe) return undefined;
  return { ...settings.stripe, secretKey: await decryptText(settings.stripe.secretKey) };
}

export async function setStripeConfig(config: StripeConfig): Promise<void> {
  const settings = await readSettings();
  settings.stripe = { ...config, secretKey: await encryptText(config.secretKey) };
  await writeSettings(settings);
}

export async function getStripeStatus(): Promise<{ configured: boolean; publishableKey: string | null }> {
  const settings = await readSettings();
  if (!settings.stripe) return { configured: false, publishableKey: null };
  return { configured: true, publishableKey: settings.stripe.publishableKey };
}

export async function getDocuSignConfig(): Promise<DocuSignConfig | undefined> {
  const settings = await readSettings();
  if (!settings.docusign) return undefined;
  return { ...settings.docusign, privateKey: await decryptText(settings.docusign.privateKey) };
}

export async function setDocuSignConfig(config: DocuSignConfig): Promise<void> {
  const settings = await readSettings();
  settings.docusign = { ...config, privateKey: await encryptText(config.privateKey) };
  await writeSettings(settings);
}

// Returns the config with the private key redacted, for display in the UI.
export async function getDocuSignStatus(): Promise<{
  configured: boolean;
  enabled: boolean;
  integrationKey: string | null;
  userId: string | null;
  accountId: string | null;
  demo: boolean;
}> {
  const settings = await readSettings();
  const docusign = settings.docusign;
  if (!docusign) {
    return { configured: false, enabled: false, integrationKey: null, userId: null, accountId: null, demo: true };
  }
  return {
    configured: true,
    enabled: docusign.enabled,
    integrationKey: docusign.integrationKey,
    userId: docusign.userId,
    accountId: docusign.accountId,
    demo: docusign.demo,
  };
}

export async function getCanliiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.canliiApiKey)) || process.env.CANLII_API_KEY;
}

export async function setCanliiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.canliiApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getCanliiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.canliiApiKey)) || process.env.CANLII_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.canliiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getWeatherLocation(): Promise<WeatherLocation | undefined> {
  const settings = await readSettings();
  return settings.location;
}

export async function setWeatherLocation(location: WeatherLocation): Promise<void> {
  const settings = await readSettings();
  settings.location = location;
  await writeSettings(settings);
}

export async function getDefaultTranslationLanguage(): Promise<string> {
  const settings = await readSettings();
  return settings.defaultTranslationLanguage || DEFAULT_TRANSLATION_LANGUAGE;
}

export async function setDefaultTranslationLanguage(language: string): Promise<void> {
  const settings = await readSettings();
  settings.defaultTranslationLanguage = language.trim() || DEFAULT_TRANSLATION_LANGUAGE;
  await writeSettings(settings);
}

// Controls whether SIN/SSN/credit card numbers (and optionally phone/email)
// get masked out of matter content before it's sent to any AI provider —
// see src/lib/piiMask.ts for the actual detection/masking logic. Default
// on: the account owner's explicit choice, favouring safety over the risk
// that a draft needing to state a real number shows a placeholder instead
// until masking is turned off for that case.
export async function getPiiMaskingSettings(): Promise<PiiMaskingSettings> {
  const settings = await readSettings();
  return { ...DEFAULT_PII_MASKING, ...settings.piiMasking };
}

export async function setPiiMaskingSettings(
  partial: Partial<PiiMaskingSettings>,
): Promise<PiiMaskingSettings> {
  const settings = await readSettings();
  const merged = { ...DEFAULT_PII_MASKING, ...settings.piiMasking, ...partial };
  settings.piiMasking = merged;
  await writeSettings(settings);
  return merged;
}

export async function getAiProviderOrder(): Promise<AiProvider[]> {
  const settings = await readSettings();
  if (!settings.aiProviderOrder || settings.aiProviderOrder.length === 0) {
    return DEFAULT_AI_PROVIDER_ORDER;
  }
  return settings.aiProviderOrder;
}

export async function setAiProviderOrder(order: AiProvider[]): Promise<void> {
  const settings = await readSettings();
  settings.aiProviderOrder = order;
  await writeSettings(settings);
}

export async function getOpenaiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.openaiApiKey)) || process.env.OPENAI_API_KEY;
}

export async function setOpenaiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.openaiApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getOpenaiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.openaiApiKey)) || process.env.OPENAI_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.openaiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

// No API key, no encryption needed — a base URL and a locally-installed
// model name aren't secrets. Model has no default: unlike a hosted
// provider, there's no single model this app can assume is available —
// the account owner has to say which one they've actually pulled
// (`ollama pull <model>`) before this provider is usable.
export async function getOllamaConfig(): Promise<OllamaConfig | undefined> {
  const settings = await readSettings();
  if (!settings.ollama?.model) return undefined;
  return {
    baseUrl: settings.ollama.baseUrl || DEFAULT_OLLAMA_BASE_URL,
    model: settings.ollama.model,
  };
}

export async function setOllamaConfig(config: OllamaConfig): Promise<void> {
  const settings = await readSettings();
  settings.ollama = { baseUrl: config.baseUrl.trim() || DEFAULT_OLLAMA_BASE_URL, model: config.model.trim() };
  await writeSettings(settings);
}

// Default on — if ClamAV isn't actually installed, scanning is a silent
// no-op anyway (see malwareScan.ts), so defaulting to enabled costs nothing
// on a machine without it and needs no setup on one that has it. An admin
// can still turn it off (e.g. if scan latency becomes a problem).
export async function getMalwareScanningEnabled(): Promise<boolean> {
  const settings = await readSettings();
  return settings.malwareScanningEnabled ?? true;
}

export async function setMalwareScanningEnabled(enabled: boolean): Promise<void> {
  const settings = await readSettings();
  settings.malwareScanningEnabled = enabled;
  await writeSettings(settings);
}

// A separate secret for unattended endpoints (e.g. an OS cron job checking
// legislation watches) that can't go through the normal browser session
// login. Auto-generated on first access so there's always a value to check
// against, distinct from the user's login password.
export async function getOrCreateCronSecret(): Promise<string> {
  const settings = await readSettings();
  if (settings.cronSecret) return (await decryptSecret(settings.cronSecret)) as string;
  const secret = randomBytes(32).toString("hex");
  settings.cronSecret = await encryptText(secret);
  await writeSettings(settings);
  return secret;
}

// Embedded directly in the calendar subscription feed's URL path (see
// /api/deadlines/feed/[token]) rather than sent as a bearer header — a
// calendar app subscribing to a feed URL has no way to attach a custom
// Authorization header, so the secret has to be part of the URL itself.
// Distinct from cronSecret so rotating one doesn't invalidate the other.
export async function getOrCreateCalendarFeedSecret(): Promise<string> {
  const settings = await readSettings();
  if (settings.calendarFeedSecret) return (await decryptSecret(settings.calendarFeedSecret)) as string;
  const secret = randomBytes(32).toString("hex");
  settings.calendarFeedSecret = await encryptText(secret);
  await writeSettings(settings);
  return secret;
}

export async function regenerateCalendarFeedSecret(): Promise<string> {
  const settings = await readSettings();
  const secret = randomBytes(32).toString("hex");
  settings.calendarFeedSecret = await encryptText(secret);
  await writeSettings(settings);
  return secret;
}

// Decrypted, for actually performing an upload (cloudBackup.ts/
// cloudDriveBackup.ts only). Returns undefined until either the S3 fields
// or a Drive OAuth connection have actually been completed.
export async function getCloudBackupConfig(): Promise<CloudBackupConfig | undefined> {
  const settings = await readSettings();
  const cb = settings.cloudBackup;
  if (!cb) return undefined;

  if (cb.provider === "google-drive" || cb.provider === "onedrive") {
    if (!cb.driveAccessToken || !cb.driveRefreshToken) return undefined;
    return {
      provider: cb.provider,
      accessToken: (await decryptSecret(cb.driveAccessToken)) as string,
      refreshToken: (await decryptSecret(cb.driveRefreshToken)) as string,
      folderId: cb.driveFolderId,
    };
  }

  if (!cb.bucket || !cb.accessKeyId || !cb.secretAccessKey) return undefined;
  return {
    provider: "s3",
    endpoint: cb.endpoint,
    region: cb.region ?? "us-east-1",
    bucket: cb.bucket,
    accessKeyId: (await decryptSecret(cb.accessKeyId)) as string,
    secretAccessKey: (await decryptSecret(cb.secretAccessKey)) as string,
    prefix: cb.prefix,
    forcePathStyle: cb.forcePathStyle,
  };
}

// Preserves lastRunAt/lastStatus/lastError/lastUploadedFileName across a
// credential update — saving new keys shouldn't erase the run history.
// Switching provider (e.g. S3 -> Google Drive) clears the other provider's
// fields so a stale bucket/credential can't linger after switching away.
export async function setS3BackupConfig(config: Omit<S3BackupConfig, "provider">): Promise<void> {
  const settings = await readSettings();
  const previous = settings.cloudBackup;
  settings.cloudBackup = {
    provider: "s3",
    endpoint: config.endpoint?.trim() || undefined,
    region: config.region.trim(),
    bucket: config.bucket.trim(),
    accessKeyId: await encryptText(config.accessKeyId),
    secretAccessKey: await encryptText(config.secretAccessKey),
    prefix: config.prefix?.trim() || undefined,
    forcePathStyle: Boolean(config.forcePathStyle),
    lastRunAt: previous?.lastRunAt,
    lastStatus: previous?.lastStatus,
    lastError: previous?.lastError,
    lastUploadedFileName: previous?.lastUploadedFileName,
  };
  await writeSettings(settings);
}

// Called once after a successful Drive/OneDrive OAuth callback.
export async function saveDriveBackupConnection(params: {
  provider: "google-drive" | "onedrive";
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string | null;
  accountEmail: string;
  folderId?: string;
}): Promise<void> {
  const settings = await readSettings();
  const previous = settings.cloudBackup;
  settings.cloudBackup = {
    provider: params.provider,
    driveAccessToken: await encryptText(params.accessToken),
    driveRefreshToken: await encryptText(params.refreshToken),
    driveTokenExpiresAt: params.tokenExpiresAt ?? undefined,
    driveAccountEmail: params.accountEmail,
    driveFolderId: params.folderId,
    lastRunAt: previous?.provider === params.provider ? previous?.lastRunAt : undefined,
    lastStatus: previous?.provider === params.provider ? previous?.lastStatus : undefined,
    lastError: previous?.provider === params.provider ? previous?.lastError : undefined,
    lastUploadedFileName: previous?.provider === params.provider ? previous?.lastUploadedFileName : undefined,
  };
  await writeSettings(settings);
}

// A refreshed access token (and occasionally a rotated refresh token —
// Microsoft sometimes reissues one) needs to be persisted so the next
// upload doesn't have to refresh again. Silently no-ops if the provider was
// switched away from in the meantime, since there'd be nothing to update.
// Google Drive addresses uploads by folder ID, discovered/created lazily on
// first upload (see cloudDriveBackup.ts) rather than at connect time — kept
// here rather than folded into saveDriveBackupConnection since it's set on
// a completely different, later code path (the first upload, not the OAuth
// callback).
export async function setDriveBackupFolderId(folderId: string): Promise<void> {
  const settings = await readSettings();
  if (!settings.cloudBackup || settings.cloudBackup.provider !== "google-drive") return;
  settings.cloudBackup.driveFolderId = folderId;
  await writeSettings(settings);
}

export async function updateDriveBackupTokens(
  provider: "google-drive" | "onedrive",
  accessToken: string,
  refreshToken: string | undefined,
  tokenExpiresAt: string | null,
): Promise<void> {
  const settings = await readSettings();
  if (settings.cloudBackup?.provider !== provider) return;
  settings.cloudBackup.driveAccessToken = await encryptText(accessToken);
  if (refreshToken) settings.cloudBackup.driveRefreshToken = await encryptText(refreshToken);
  settings.cloudBackup.driveTokenExpiresAt = tokenExpiresAt ?? undefined;
  await writeSettings(settings);
}

export async function disconnectCloudBackup(): Promise<void> {
  const settings = await readSettings();
  settings.cloudBackup = undefined;
  await writeSettings(settings);
}

export interface CloudBackupStatus {
  provider: CloudBackupProvider | null;
  configured: boolean;
  // S3
  endpoint: string | null;
  region: string | null;
  bucket: string | null;
  prefix: string | null;
  forcePathStyle: boolean;
  accessKeyIdPreview: string | null;
  // Drive
  driveAccountEmail: string | null;
  // Shared
  lastRunAt: string | null;
  lastStatus: "ok" | "error" | null;
  lastError: string | null;
  lastUploadedFileName: string | null;
}

// Redacted (no secret material), for display in Settings.
export async function getCloudBackupStatus(): Promise<CloudBackupStatus> {
  const settings = await readSettings();
  const cb = settings.cloudBackup;
  const empty: CloudBackupStatus = {
    provider: cb?.provider ?? null,
    configured: false,
    endpoint: null,
    region: null,
    bucket: null,
    prefix: null,
    forcePathStyle: false,
    accessKeyIdPreview: null,
    driveAccountEmail: null,
    lastRunAt: cb?.lastRunAt ?? null,
    lastStatus: cb?.lastStatus ?? null,
    lastError: cb?.lastError ?? null,
    lastUploadedFileName: cb?.lastUploadedFileName ?? null,
  };
  if (!cb) return empty;

  if (cb.provider === "google-drive" || cb.provider === "onedrive") {
    return {
      ...empty,
      configured: Boolean(cb.driveAccessToken && cb.driveRefreshToken),
      driveAccountEmail: cb.driveAccountEmail ?? null,
    };
  }

  if (!cb.bucket) return empty;
  const accessKeyId = cb.accessKeyId ? await decryptSecret(cb.accessKeyId) : undefined;
  return {
    ...empty,
    configured: Boolean(cb.accessKeyId && cb.secretAccessKey),
    endpoint: cb.endpoint ?? null,
    region: cb.region ?? null,
    bucket: cb.bucket,
    prefix: cb.prefix ?? null,
    forcePathStyle: Boolean(cb.forcePathStyle),
    accessKeyIdPreview: accessKeyId ? `••••${accessKeyId.slice(-4)}` : null,
  };
}

export async function recordCloudBackupResult(
  status: "ok" | "error",
  opts: { error?: string; fileName?: string } = {},
): Promise<void> {
  const settings = await readSettings();
  if (!settings.cloudBackup) return; // nothing configured to record against
  settings.cloudBackup.lastRunAt = new Date().toISOString();
  settings.cloudBackup.lastStatus = status;
  settings.cloudBackup.lastError = status === "error" ? opts.error : undefined;
  if (status === "ok" && opts.fileName) settings.cloudBackup.lastUploadedFileName = opts.fileName;
  await writeSettings(settings);
}

export interface BackupScheduleStatus extends BackupScheduleConfig {
  lastRunAt: string | null;
  lastStatus: "ok" | "error" | null;
  lastError: string | null;
}

// Drives the in-process scheduler in backupScheduler.ts. Disabled by
// default — an hourly local backup costs disk space even with nothing to
// upload to, so this stays opt-in rather than silently running for
// everyone who upgrades into this feature.
export async function getBackupScheduleStatus(): Promise<BackupScheduleStatus> {
  const settings = await readSettings();
  const schedule = settings.backupSchedule;
  return {
    enabled: schedule?.enabled ?? DEFAULT_BACKUP_SCHEDULE.enabled,
    intervalHours: schedule?.intervalHours ?? DEFAULT_BACKUP_SCHEDULE.intervalHours,
    lastRunAt: schedule?.lastRunAt ?? null,
    lastStatus: schedule?.lastStatus ?? null,
    lastError: schedule?.lastError ?? null,
  };
}

export async function setBackupScheduleConfig(config: BackupScheduleConfig): Promise<void> {
  const settings = await readSettings();
  const previous = settings.backupSchedule;
  settings.backupSchedule = {
    enabled: config.enabled,
    intervalHours: Math.max(1, Math.round(config.intervalHours)),
    lastRunAt: previous?.lastRunAt,
    lastStatus: previous?.lastStatus,
    lastError: previous?.lastError,
  };
  await writeSettings(settings);
}

export async function recordBackupScheduleResult(
  status: "ok" | "error",
  error?: string,
): Promise<void> {
  const settings = await readSettings();
  settings.backupSchedule = {
    enabled: settings.backupSchedule?.enabled ?? DEFAULT_BACKUP_SCHEDULE.enabled,
    intervalHours: settings.backupSchedule?.intervalHours ?? DEFAULT_BACKUP_SCHEDULE.intervalHours,
    lastRunAt: new Date().toISOString(),
    lastStatus: status,
    lastError: status === "error" ? error : undefined,
  };
  await writeSettings(settings);
}

export interface ChangeBackupStatus extends ChangeBackupConfig {
  lastRunAt: string | null;
  lastStatus: "ok" | "error" | null;
  lastError: string | null;
}

// Independent of, and additive to, the interval scheduler above — either
// can be on, both can be on (the interval one is then just a backstop in
// case a real change slips past proxy.ts's change-tracking hook), or both
// off. Disabled by default for the same reason: opt-in, not a silent
// upgrade into extra disk/network usage.
export async function getChangeBackupStatus(): Promise<ChangeBackupStatus> {
  const settings = await readSettings();
  const cb = settings.changeBackup;
  return {
    enabled: cb?.enabled ?? DEFAULT_CHANGE_BACKUP.enabled,
    debounceMinutes: cb?.debounceMinutes ?? DEFAULT_CHANGE_BACKUP.debounceMinutes,
    cooldownMinutes: cb?.cooldownMinutes ?? DEFAULT_CHANGE_BACKUP.cooldownMinutes,
    lastRunAt: cb?.lastRunAt ?? null,
    lastStatus: cb?.lastStatus ?? null,
    lastError: cb?.lastError ?? null,
  };
}

export async function setChangeBackupConfig(config: ChangeBackupConfig): Promise<void> {
  const settings = await readSettings();
  const previous = settings.changeBackup;
  settings.changeBackup = {
    enabled: config.enabled,
    debounceMinutes: Math.max(1, Math.round(config.debounceMinutes)),
    cooldownMinutes: Math.max(1, Math.round(config.cooldownMinutes)),
    lastRunAt: previous?.lastRunAt,
    lastStatus: previous?.lastStatus,
    lastError: previous?.lastError,
  };
  await writeSettings(settings);
}

export async function recordChangeBackupResult(status: "ok" | "error", error?: string): Promise<void> {
  const settings = await readSettings();
  settings.changeBackup = {
    enabled: settings.changeBackup?.enabled ?? DEFAULT_CHANGE_BACKUP.enabled,
    debounceMinutes: settings.changeBackup?.debounceMinutes ?? DEFAULT_CHANGE_BACKUP.debounceMinutes,
    cooldownMinutes: settings.changeBackup?.cooldownMinutes ?? DEFAULT_CHANGE_BACKUP.cooldownMinutes,
    lastRunAt: new Date().toISOString(),
    lastStatus: status,
    lastError: status === "error" ? error : undefined,
  };
  await writeSettings(settings);
}

// VAPID key pair for Web Push (see push.ts) — generated once on first use
// rather than requiring the account owner to configure anything, since
// unlike SMTP/AI keys there's no external account these come from.
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string } | undefined> {
  const settings = await readSettings();
  if (!settings.vapidPublicKey || !settings.vapidPrivateKey) return undefined;
  return { publicKey: settings.vapidPublicKey, privateKey: await decryptText(settings.vapidPrivateKey) };
}

export async function setVapidKeys(keys: { publicKey: string; privateKey: string }): Promise<void> {
  const settings = await readSettings();
  settings.vapidPublicKey = keys.publicKey;
  settings.vapidPrivateKey = await encryptText(keys.privateKey);
  await writeSettings(settings);
}

// A sensible starting list covering the most common hard costs a Canadian
// litigation/general practice bills to a matter — firm-wide (not per-matter,
// not per-matterType), editable via addDisbursementCategory below. "Other"
// always stays last so it reads as the deliberate catch-all it is.
const DEFAULT_DISBURSEMENT_CATEGORIES = [
  "Filing fee",
  "Court fee",
  "Process server",
  "Expert witness",
  "Transcript",
  "Registry/title search",
  "Courier/postage",
  "Photocopying/printing",
  "Translation/interpreter",
  "Travel",
  "Other",
];

export async function getDisbursementCategories(): Promise<string[]> {
  const settings = await readSettings();
  return settings.disbursementCategories?.length ? settings.disbursementCategories : DEFAULT_DISBURSEMENT_CATEGORIES;
}

export async function addDisbursementCategory(category: string): Promise<string[]> {
  const trimmed = category.trim();
  if (!trimmed) throw new Error("Category name is required.");
  const settings = await readSettings();
  const current = settings.disbursementCategories?.length ? settings.disbursementCategories : DEFAULT_DISBURSEMENT_CATEGORIES;
  if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return current;
  // New categories go in just before "Other" (if present) so the catch-all
  // stays last rather than getting pushed around as the list grows.
  const otherIndex = current.findIndex((c) => c.toLowerCase() === "other");
  const next =
    otherIndex === -1
      ? [...current, trimmed]
      : [...current.slice(0, otherIndex), trimmed, ...current.slice(otherIndex)];
  settings.disbursementCategories = next;
  await writeSettings(settings);
  return next;
}
