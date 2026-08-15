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
  traffic: {
    description:
      "Possible prosecution-commencement limitation — verify against Provincial Offences Act s.76 (Ontario): a prosecution generally must be commenced within 6 months of the alleged offence, unless another Act specifies otherwise, not matter-open date",
    offsetDays: 182,
  },
  "provincial offences": {
    description:
      "Possible prosecution-commencement limitation — verify against Provincial Offences Act s.76 (Ontario): a prosecution generally must be commenced within 6 months of the alleged offence, unless another Act specifies otherwise, not matter-open date",
    offsetDays: 182,
  },
  immigration: {
    description:
      "Possible judicial-review deadline — verify against IRPA s.72(2)/Federal Courts Act: a leave application to the Federal Court is generally due within 15 days of receiving the decision for matters arising in Canada (60 days if the decision arose outside Canada) — confirm which applies and the actual decision-received date, not matter-open date",
    offsetDays: 15,
  },
  "real estate": {
    description:
      "Possible limitation period — verify against Limitations Act, 2002 (Ontario): basic 2-year period from discovery for a claim arising out of the transaction (e.g. breach of the Agreement of Purchase and Sale, undisclosed defects) — closing/requisition dates are deal-specific and aren't covered by this entry, and the trigger is discovery of the problem, not matter-open date",
    offsetDays: 730,
  },
  property: {
    description:
      "Possible limitation period — verify against Limitations Act, 2002 (Ontario): basic 2-year period from discovery for a claim arising out of the transaction (e.g. breach of the Agreement of Purchase and Sale, undisclosed defects) — closing/requisition dates are deal-specific and aren't covered by this entry, and the trigger is discovery of the problem, not matter-open date",
    offsetDays: 730,
  },
  family: {
    description:
      "Possible equalization-claim deadline — verify against Family Law Act s.7(3) (Ontario): a property/equalization claim is generally due the EARLIER of 6 years after the date of separation or 2 years after a divorce/annulment — this entry uses the outer 6-year bound as a placeholder, but the real deadline depends on which of those two dates applies and is almost never matter-open date",
    offsetDays: 2190,
  },
  employment: {
    description:
      "Possible wrongful-dismissal/ESA-complaint deadline — verify against Limitations Act, 2002 (Ontario): basic 2-year period from termination/discovery for a common-law wrongful dismissal claim, and Employment Standards Act s.96(3) sets the same 2-year window for a Ministry of Labour complaint — not matter-open date",
    offsetDays: 730,
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
