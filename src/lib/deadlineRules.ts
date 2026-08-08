import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { DeadlineRule, Holiday, MatterDeadline } from "./types";

// Firm-editable deadline rule library — see the comment on the
// deadline_rules table in db.ts for why this isn't a licensed,
// jurisdiction-authoritative rules database.

export async function listDeadlineRules(): Promise<DeadlineRule[]> {
  return db
    .prepare("SELECT * FROM deadline_rules ORDER BY name ASC")
    .all()
    .map((row) => toPlain<DeadlineRule>(row));
}

export async function getDeadlineRule(id: string): Promise<DeadlineRule | null> {
  const row = db.prepare("SELECT * FROM deadline_rules WHERE id = ?").get(id);
  return row ? toPlain<DeadlineRule>(row) : null;
}

export async function createDeadlineRule(input: {
  name: string;
  description?: string | null;
  offsetDays: number;
  offsetUnit: DeadlineRule["offsetUnit"];
  direction: DeadlineRule["direction"];
}): Promise<DeadlineRule> {
  const name = input.name.trim();
  if (!name) throw new Error("Rule name is required");
  if (!Number.isFinite(input.offsetDays) || input.offsetDays < 0) {
    throw new Error("offsetDays must be zero or a positive number");
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO deadline_rules (id, name, description, offsetDays, offsetUnit, direction, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, name, input.description ?? null, input.offsetDays, input.offsetUnit, input.direction, createdAt);
  return {
    id,
    name,
    description: input.description ?? null,
    offsetDays: input.offsetDays,
    offsetUnit: input.offsetUnit,
    direction: input.direction,
    createdAt,
  };
}

export async function deleteDeadlineRule(id: string): Promise<void> {
  db.prepare("DELETE FROM deadline_rules WHERE id = ?").run(id);
}

export async function listHolidays(): Promise<Holiday[]> {
  return db
    .prepare("SELECT * FROM holidays ORDER BY date ASC")
    .all()
    .map((row) => toPlain<Holiday>(row));
}

export async function createHoliday(input: {
  name: string;
  date: string;
  recurringYearly: boolean;
}): Promise<Holiday> {
  const name = input.name.trim();
  if (!name) throw new Error("Holiday name is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("date must be in YYYY-MM-DD format");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare("INSERT INTO holidays (id, name, date, recurringYearly, createdAt) VALUES (?, ?, ?, ?, ?)").run(
    id,
    name,
    input.date,
    input.recurringYearly ? 1 : 0,
    createdAt,
  );
  return { id, name, date: input.date, recurringYearly: input.recurringYearly ? 1 : 0, createdAt };
}

export async function deleteHoliday(id: string): Promise<void> {
  db.prepare("DELETE FROM holidays WHERE id = ?").run(id);
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date, holidays: Holiday[]): boolean {
  return holidays.some((h) => {
    const hDate = parseIsoDate(h.date);
    if (h.recurringYearly) {
      return hDate.getUTCMonth() === date.getUTCMonth() && hDate.getUTCDate() === date.getUTCDate();
    }
    return formatIsoDate(hDate) === formatIsoDate(date);
  });
}

// Business-day counting steps one calendar day at a time in the rule's
// direction, only counting days that aren't a weekend or a configured
// holiday — matches how "21 business days" is actually meant in practice,
// not a naive 5/7 multiplier.
export function computeDeadlineDate(
  triggerDate: string,
  rule: Pick<DeadlineRule, "offsetDays" | "offsetUnit" | "direction">,
  holidays: Holiday[],
): string {
  const step = rule.direction === "after" ? 1 : -1;
  let date = parseIsoDate(triggerDate);

  if (rule.offsetUnit === "calendar") {
    date.setUTCDate(date.getUTCDate() + step * rule.offsetDays);
    return formatIsoDate(date);
  }

  let counted = 0;
  while (counted < rule.offsetDays) {
    date = new Date(date.getTime() + step * 24 * 60 * 60 * 1000);
    if (!isWeekend(date) && !isHoliday(date, holidays)) counted++;
  }
  return formatIsoDate(date);
}

// Computes and inserts a deadline for a matter from a saved rule — lands in
// the same matter_deadlines list a lawyer already looks at, tagged so it
// survives a later AI re-extraction (see replaceDeadlines in matters.ts).
export async function applyDeadlineRule(
  matterId: string,
  ruleId: string,
  triggerDate: string,
): Promise<MatterDeadline> {
  const rule = await getDeadlineRule(ruleId);
  if (!rule) throw new Error("Deadline rule not found");
  const holidays = await listHolidays();
  const dueDate = computeDeadlineDate(triggerDate, rule, holidays);

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const description = `${rule.name} (${rule.offsetDays} ${rule.offsetUnit} days ${rule.direction} ${triggerDate})`;
  db.prepare(
    `INSERT INTO matter_deadlines (id, matterId, description, dueDate, sourceDocument, source, ruleId, triggerDate, createdAt)
     VALUES (?, ?, ?, ?, NULL, 'rule-computed', ?, ?, ?)`,
  ).run(id, matterId, description, dueDate, ruleId, triggerDate, createdAt);

  await recordAuditEvent(
    "deadline_computed",
    matterId,
    `Computed deadline "${description}" → ${dueDate} using rule "${rule.name}"`,
  );

  return {
    id,
    matterId,
    description,
    dueDate,
    sourceDocument: null,
    source: "rule-computed",
    ruleId,
    triggerDate,
    createdAt,
  };
}
