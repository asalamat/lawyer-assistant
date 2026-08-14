// Auto-seeds a starting limitation-period deadline when a new matter is
// opened, same fuzzy matterType-matching approach as taskTemplates.ts.
// Deliberately conservative: these are common-case defaults under Ontario
// law only (this app's citation formats — ONCA/ONSC/ONCJ — assume an
// Ontario practice), a real limitation period always depends on facts a
// matter-open form can't know (date of loss/discovery, disability,
// discoverability postponement, etc.). Every seeded deadline's own
// description says so explicitly — this is a safety-net reminder to check
// the real date, never a substitute for actually calculating it.
export interface LimitationPeriodTemplate {
  description: string;
  offsetDays: number;
}

export const LIMITATION_PERIODS: Record<string, LimitationPeriodTemplate> = {
  "personal injury": {
    description:
      "Possible limitation period — verify against Limitations Act, 2002 (Ontario): basic 2-year period from discovery, not necessarily matter-open date",
    offsetDays: 730,
  },
  "civil litigation": {
    description:
      "Possible limitation period — verify against Limitations Act, 2002 (Ontario): basic 2-year period from discovery, not necessarily matter-open date",
    offsetDays: 730,
  },
  "criminal defence": {
    description:
      "Possible summary-conviction limitation — verify against Criminal Code s.786(2): informations for summary offences generally must be laid within 12 months of the alleged offence date, not matter-open date",
    offsetDays: 365,
  },
  "criminal law": {
    description:
      "Possible summary-conviction limitation — verify against Criminal Code s.786(2): informations for summary offences generally must be laid within 12 months of the alleged offence date, not matter-open date",
    offsetDays: 365,
  },
  "wills and estates": {
    description:
      "Possible dependant's relief deadline — verify against Succession Law Reform Act s.61 (Ontario): 6 months from the grant of probate/administration, not matter-open date",
    offsetDays: 182,
  },
};

function normalize(matterType: string): string {
  return matterType.trim().toLowerCase();
}

export function findLimitationPeriod(matterType: string): LimitationPeriodTemplate | null {
  const key = normalize(matterType);
  if (!key) return null;
  if (LIMITATION_PERIODS[key]) return LIMITATION_PERIODS[key];
  const match = Object.keys(LIMITATION_PERIODS).find((k) => key.includes(k) || k.includes(key));
  return match ? LIMITATION_PERIODS[match] : null;
}
