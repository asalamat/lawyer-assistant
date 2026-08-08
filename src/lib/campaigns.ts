import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { sendEmail } from "./email";
import type { Campaign, CampaignEnrollment, CampaignStep, Lead, LeadStage } from "./types";

// Queries the leads table directly rather than importing getLead() from
// leads.ts — that module will call into this one (enrollLeadIfMatching, on
// every stage change), and a straight function-level circular import
// between the two is easy to get subtly wrong depending on module load
// order. A one-line duplicated query is a small price for not having to
// think about that.
function getLeadRow(id: string): Lead | null {
  const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  return row ? toPlain<Lead>(row) : null;
}

export async function listCampaigns(): Promise<(Campaign & { steps: CampaignStep[] })[]> {
  const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY createdAt DESC").all().map((row) => toPlain<Campaign>(row));
  return campaigns.map((campaign) => ({
    ...campaign,
    steps: db
      .prepare("SELECT * FROM campaign_steps WHERE campaignId = ? ORDER BY stepOrder ASC")
      .all(campaign.id)
      .map((row) => toPlain<CampaignStep>(row)),
  }));
}

export async function createCampaign(input: {
  name: string;
  triggerStage: LeadStage;
  steps: { delayDays: number; subject: string; body: string }[];
}): Promise<Campaign & { steps: CampaignStep[] }> {
  const name = input.name.trim();
  if (!name) throw new Error("Campaign name is required");
  if (input.steps.length === 0) throw new Error("At least one email step is required");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare("INSERT INTO campaigns (id, name, triggerStage, active, createdAt) VALUES (?, ?, ?, 1, ?)").run(
    id,
    name,
    input.triggerStage,
    createdAt,
  );

  const steps: CampaignStep[] = input.steps.map((step, index) => {
    const stepId = randomUUID();
    db.prepare(
      "INSERT INTO campaign_steps (id, campaignId, stepOrder, delayDays, subject, body) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(stepId, id, index, step.delayDays, step.subject, step.body);
    return { id: stepId, campaignId: id, stepOrder: index, delayDays: step.delayDays, subject: step.subject, body: step.body };
  });

  return { id, name, triggerStage: input.triggerStage, active: 1, createdAt, steps };
}

export async function deleteCampaign(id: string): Promise<void> {
  db.prepare("DELETE FROM campaign_enrollments WHERE campaignId = ?").run(id);
  db.prepare("DELETE FROM campaign_steps WHERE campaignId = ?").run(id);
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
}

export async function getEnrollmentForLead(leadId: string): Promise<(CampaignEnrollment & { campaignName: string }) | null> {
  const row = db
    .prepare(
      `SELECT campaign_enrollments.*, campaigns.name as campaignName
       FROM campaign_enrollments JOIN campaigns ON campaigns.id = campaign_enrollments.campaignId
       WHERE campaign_enrollments.leadId = ? AND campaign_enrollments.finishedAt IS NULL
       ORDER BY campaign_enrollments.enrolledAt DESC LIMIT 1`,
    )
    .get(leadId);
  return row ? toPlain<CampaignEnrollment & { campaignName: string }>(row) : null;
}

// One query for every lead's active enrollment, for the Leads board — much
// cheaper than a getEnrollmentForLead() call per lead card.
export async function listActiveEnrollmentsByLeadId(): Promise<Record<string, string>> {
  const rows = db
    .prepare(
      `SELECT campaign_enrollments.leadId as leadId, campaigns.name as campaignName
       FROM campaign_enrollments JOIN campaigns ON campaigns.id = campaign_enrollments.campaignId
       WHERE campaign_enrollments.finishedAt IS NULL`,
    )
    .all() as { leadId: string; campaignName: string }[];
  return Object.fromEntries(rows.map((r) => [r.leadId, r.campaignName]));
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

// Called from updateLead() the moment a lead's stage actually changes —
// auto-enrolls the lead in every active campaign whose triggerStage
// matches, skipping any campaign it's already (still) enrolled in. A lead
// can be enrolled in more than one matching campaign at once; each is
// tracked independently.
export async function enrollLeadIfMatching(leadId: string, newStage: LeadStage): Promise<void> {
  const campaigns = db
    .prepare("SELECT * FROM campaigns WHERE triggerStage = ? AND active = 1")
    .all(newStage)
    .map((row) => toPlain<Campaign>(row));
  if (campaigns.length === 0) return;

  const now = new Date().toISOString();
  for (const campaign of campaigns) {
    const already = db
      .prepare("SELECT id FROM campaign_enrollments WHERE campaignId = ? AND leadId = ?")
      .get(campaign.id, leadId);
    if (already) continue;

    const firstStep = db
      .prepare("SELECT * FROM campaign_steps WHERE campaignId = ? ORDER BY stepOrder ASC LIMIT 1")
      .get(campaign.id) as { delayDays: number } | undefined;
    if (!firstStep) continue;

    db.prepare(
      "INSERT INTO campaign_enrollments (id, campaignId, leadId, enrolledAt, nextStepIndex, nextSendAt, finishedAt) VALUES (?, ?, ?, ?, 0, ?, NULL)",
    ).run(randomUUID(), campaign.id, leadId, now, addDays(now, firstStep.delayDays));

    await recordAuditEvent("lead_enrolled_in_campaign", null, `Enrolled a lead in campaign "${campaign.name}"`);
  }
}

function mergeLeadFields(template: string, lead: Lead): string {
  return template
    .replace(/\{\{lead\.name\}\}/g, lead.name)
    .replace(/\{\{lead\.email\}\}/g, lead.email ?? "")
    .replace(/\{\{lead\.phone\}\}/g, lead.phone ?? "")
    .replace(/\{\{lead\.source\}\}/g, lead.source ?? "");
}

// Meant to be called on a schedule (see /api/campaigns/run-due) — finds
// every enrollment whose next step is due, sends that step's email, and
// either advances to the next step or marks the enrollment finished.
// Best-effort per enrollment: one lead with no email address, or one send
// failure, doesn't stop the rest from running.
export async function runDueSteps(): Promise<{ sent: number; skipped: number }> {
  const now = new Date().toISOString();
  const due = db
    .prepare("SELECT * FROM campaign_enrollments WHERE finishedAt IS NULL AND nextSendAt IS NOT NULL AND nextSendAt <= ?")
    .all(now)
    .map((row) => toPlain<CampaignEnrollment>(row));

  let sent = 0;
  let skipped = 0;

  for (const enrollment of due) {
    try {
      const lead = getLeadRow(enrollment.leadId);
      const step = db
        .prepare("SELECT * FROM campaign_steps WHERE campaignId = ? AND stepOrder = ?")
        .get(enrollment.campaignId, enrollment.nextStepIndex) as CampaignStep | undefined;

      if (!lead || !step) {
        db.prepare("UPDATE campaign_enrollments SET finishedAt = ? WHERE id = ?").run(now, enrollment.id);
        skipped += 1;
        continue;
      }

      if (lead.email) {
        await sendEmail({
          to: lead.email,
          subject: mergeLeadFields(step.subject, lead),
          text: mergeLeadFields(step.body, lead),
        });
        sent += 1;
      } else {
        skipped += 1;
      }

      const nextStep = db
        .prepare("SELECT * FROM campaign_steps WHERE campaignId = ? AND stepOrder = ?")
        .get(enrollment.campaignId, enrollment.nextStepIndex + 1) as { delayDays: number } | undefined;

      if (nextStep) {
        db.prepare("UPDATE campaign_enrollments SET nextStepIndex = ?, nextSendAt = ? WHERE id = ?").run(
          enrollment.nextStepIndex + 1,
          addDays(now, nextStep.delayDays),
          enrollment.id,
        );
      } else {
        db.prepare("UPDATE campaign_enrollments SET finishedAt = ? WHERE id = ?").run(now, enrollment.id);
      }
    } catch {
      // Best-effort — one bad enrollment (send failure, etc.) never stops
      // the rest of the run; it stays due and retries next run.
      skipped += 1;
    }
  }

  return { sent, skipped };
}
