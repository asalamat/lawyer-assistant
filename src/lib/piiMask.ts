import { getPiiMaskingSettings, type PiiMaskingSettings } from "./settings";

// Luhn checksum — used both for credit card numbers and Canadian SIN
// validation (a SIN's check digit is Luhn-based, same algorithm, just 9
// digits instead of a variable-length card number). Filters out the large
// majority of random digit sequences that would otherwise false-positive
// as a real identifier.
function luhnValid(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export interface MaskCounts {
  sin: number;
  ssn: number;
  creditCard: number;
  phone: number;
  email: number;
}

// Order matters: email (structurally distinct, "@") first, then the
// checksum-validated numeric patterns (credit card, SIN), then the
// looser format-only patterns (SSN, phone) last — so a token already
// replaced with "[REDACTED:...]" can never be re-matched by a later,
// broader pattern.
export function maskSensitiveIdentifiers(
  text: string,
  options: PiiMaskingSettings,
): { masked: string; counts: MaskCounts } {
  const counts: MaskCounts = { sin: 0, ssn: 0, creditCard: 0, phone: 0, email: 0 };
  let result = text;

  if (options.email) {
    result = result.replace(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g, () => {
      counts.email++;
      return "[REDACTED:EMAIL]";
    });
  }

  if (options.creditCard) {
    result = result.replace(/\b\d(?:[ -]?\d){12,18}\b/g, (match) => {
      const digits = match.replace(/[^\d]/g, "");
      if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) return match;
      counts.creditCard++;
      return "[REDACTED:CARD]";
    });
  }

  // Requires the standard 3-3-3 grouping SIN is virtually always written
  // with in real documents — a bare, unseparated 9-digit run is left
  // alone since that pattern is too common in file/docket/reference
  // numbers to safely treat as a SIN even with the Luhn check.
  if (options.sin) {
    result = result.replace(/\b\d{3}[-\s]\d{3}[-\s]\d{3}\b/g, (match) => {
      const digits = match.replace(/[^\d]/g, "");
      if (!luhnValid(digits)) return match;
      counts.sin++;
      return "[REDACTED:SIN]";
    });
  }

  if (options.ssn) {
    result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
      counts.ssn++;
      return "[REDACTED:SSN]";
    });
  }

  if (options.phone) {
    result = result.replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, () => {
      counts.phone++;
      return "[REDACTED:PHONE]";
    });
  }

  return { masked: result, counts };
}

// The single choke point every AI-bound context should pass through.
// Reads the current settings itself so callers don't each need to fetch
// and thread them through separately.
export async function maskForAI(text: string): Promise<string> {
  if (!text) return text;
  const settings = await getPiiMaskingSettings();
  if (!settings.enabled) return text;
  return maskSensitiveIdentifiers(text, settings).masked;
}
