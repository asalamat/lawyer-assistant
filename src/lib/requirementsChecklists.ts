// Seeds a starting practice-area checklist when a new matter is opened,
// same fuzzy matterType-matching approach as taskTemplates.ts/
// limitationPeriods.ts. Generic "what's typically needed" content, not
// statute-specific — a starting point for the lawyer to adapt, not an
// authoritative or complete list for the actual application/case type.
export interface RequirementItemTemplate {
  key: string;
  label: string;
}

export const REQUIREMENTS_CHECKLISTS: Record<string, RequirementItemTemplate[]> = {
  immigration: [
    { key: "passport", label: "Passport/travel document copy" },
    { key: "status-proof", label: "Proof of current status (visa/PR/work permit)" },
    { key: "application-form", label: "Application form(s) completed" },
    { key: "photos", label: "Photos meeting IRCC specifications" },
    { key: "proof-of-funds", label: "Proof of funds" },
    { key: "biometrics", label: "Biometrics completed" },
    { key: "medical-exam", label: "Medical exam (if required)" },
    { key: "police-certificates", label: "Police certificates" },
    { key: "supporting-letters", label: "Supporting letters (employment/sponsor)" },
    { key: "application-fee", label: "Application fee paid" },
  ],
  "real estate": [
    { key: "aps-signed", label: "Agreement of Purchase and Sale signed" },
    { key: "title-search", label: "Title search reviewed" },
    { key: "mortgage-commitment", label: "Mortgage commitment letter" },
    { key: "status-certificate", label: "Status certificate (if condo)" },
    { key: "home-inspection", label: "Home inspection report" },
    { key: "property-tax", label: "Property tax statement" },
    { key: "discharge-statement", label: "Existing mortgage discharge statement" },
    { key: "fire-insurance", label: "Fire insurance binder" },
    { key: "trust-ledger", label: "Closing/trust ledger reconciled" },
  ],
  family: [
    { key: "marriage-certificate", label: "Marriage certificate" },
    { key: "financial-disclosure", label: "Sworn financial disclosure (Form 13/13.1, tax returns, pay stubs)" },
    { key: "parenting-plan", label: "Parenting plan/schedule proposal" },
    { key: "separation-agreement", label: "Separation agreement draft (if applicable)" },
    { key: "asset-list", label: "Property/asset list" },
    { key: "support-calculation", label: "Child support guideline calculation" },
  ],
  "criminal defence": [
    { key: "disclosure", label: "Disclosure received from Crown" },
    { key: "release-order", label: "Bail/release order copy" },
    { key: "witness-statements", label: "Witness statements reviewed" },
    { key: "prior-record", label: "Prior record disclosure" },
    { key: "expert-reports", label: "Expert/forensic reports (if any)" },
    { key: "plea-instructions", label: "Plea instructions confirmed" },
  ],
  "criminal law": [
    { key: "disclosure", label: "Disclosure received from Crown" },
    { key: "release-order", label: "Bail/release order copy" },
    { key: "witness-statements", label: "Witness statements reviewed" },
    { key: "prior-record", label: "Prior record disclosure" },
    { key: "expert-reports", label: "Expert/forensic reports (if any)" },
    { key: "plea-instructions", label: "Plea instructions confirmed" },
  ],
  "personal injury": [
    { key: "incident-report", label: "Accident/incident report" },
    { key: "medical-records", label: "Medical records and treatment history" },
    { key: "insurance-declaration", label: "Insurance policy declaration page" },
    { key: "wage-loss", label: "Wage-loss documentation" },
    { key: "expert-medical-report", label: "Expert medical report" },
    { key: "photos", label: "Photos of injury/scene" },
    { key: "special-damages", label: "Statement of special damages" },
  ],
  "civil litigation": [
    { key: "pleadings", label: "Pleadings drafted/filed" },
    { key: "affidavit-of-documents", label: "Affidavit of documents" },
    { key: "contracts", label: "Relevant contracts/correspondence collected" },
    { key: "notice-requirements", label: "Notice requirements confirmed" },
    { key: "expert-reports", label: "Expert reports (if any)" },
  ],
  "wills and estates": [
    { key: "will-signed", label: "Will/codicil signed and witnessed" },
    { key: "asset-inventory", label: "Asset and liability inventory" },
    { key: "beneficiary-designations", label: "Beneficiary designations confirmed" },
    { key: "executor-acceptance", label: "Executor acceptance" },
    { key: "death-certificate", label: "Death certificate (if administering)" },
    { key: "probate-application", label: "Probate application (if required)" },
  ],
  corporate: [
    { key: "articles", label: "Articles of incorporation" },
    { key: "minute-book", label: "Minute book up to date" },
    { key: "shareholder-agreement", label: "Shareholder/partnership agreement" },
    { key: "resolutions", label: "Corporate resolutions" },
    { key: "share-register", label: "Share register" },
  ],
  traffic: [
    { key: "certificate-of-offence", label: "Certificate of offence copy" },
    { key: "disclosure", label: "Disclosure requested/received" },
    { key: "drivers-abstract", label: "Driver's abstract" },
    { key: "trial-date", label: "Trial date confirmed/requested" },
  ],
  "provincial offences": [
    { key: "certificate-of-offence", label: "Certificate of offence copy" },
    { key: "disclosure", label: "Disclosure requested/received" },
    { key: "drivers-abstract", label: "Driver's abstract" },
    { key: "trial-date", label: "Trial date confirmed/requested" },
  ],
  employment: [
    { key: "employment-contract", label: "Employment contract" },
    { key: "termination-letter", label: "Termination letter/ROE" },
    { key: "pay-stubs", label: "Pay stubs/T4s" },
    { key: "company-policies", label: "Relevant company policies" },
    { key: "esa-complaint", label: "ESA complaint form (if filed)" },
  ],
};

function normalize(matterType: string): string {
  return matterType.trim().toLowerCase();
}

export function findRequirementsChecklist(matterType: string): RequirementItemTemplate[] | null {
  const key = normalize(matterType);
  if (!key) return null;
  if (REQUIREMENTS_CHECKLISTS[key]) return REQUIREMENTS_CHECKLISTS[key];
  const match = Object.keys(REQUIREMENTS_CHECKLISTS).find((k) => key.includes(k) || k.includes(key));
  return match ? REQUIREMENTS_CHECKLISTS[match] : null;
}
