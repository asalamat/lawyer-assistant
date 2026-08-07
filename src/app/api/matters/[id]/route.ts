import { NextResponse } from "next/server";
import {
  deleteMatter,
  getMatter,
  setMatterClassification,
  setMatterEthicalWall,
  setMatterLegalHold,
  setMatterRetentionDate,
  updateMatterHourlyRate,
  updateMatterStatus,
} from "@/lib/matters";
import type { MatterClassification } from "@/lib/types";

const VALID_CLASSIFICATIONS: MatterClassification[] = ["standard", "privileged", "highly-sensitive"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  return NextResponse.json(matter);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  if (body?.hourlyRate !== undefined) {
    const parsedRate = Number(body.hourlyRate);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      return NextResponse.json({ error: "hourlyRate must be a positive number" }, { status: 400 });
    }
    const matter = await updateMatterHourlyRate(id, parsedRate);
    if (!matter) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }
    return NextResponse.json(matter);
  }

  if (body?.classification !== undefined) {
    if (!VALID_CLASSIFICATIONS.includes(body.classification)) {
      return NextResponse.json(
        { error: "classification must be standard, privileged, or highly-sensitive" },
        { status: 400 },
      );
    }
    const matter = await setMatterClassification(id, body.classification);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    return NextResponse.json(matter);
  }

  if (body?.legalHold !== undefined) {
    if (typeof body.legalHold !== "boolean") {
      return NextResponse.json({ error: "legalHold must be a boolean" }, { status: 400 });
    }
    const matter = await setMatterLegalHold(id, body.legalHold, body.legalHoldReason);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    return NextResponse.json(matter);
  }

  if (body?.ethicalWall !== undefined) {
    if (typeof body.ethicalWall !== "boolean") {
      return NextResponse.json({ error: "ethicalWall must be a boolean" }, { status: 400 });
    }
    const matter = await setMatterEthicalWall(id, body.ethicalWall);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    return NextResponse.json(matter);
  }

  if (body?.retentionDate !== undefined) {
    if (body.retentionDate !== null && typeof body.retentionDate !== "string") {
      return NextResponse.json({ error: "retentionDate must be a date string or null" }, { status: 400 });
    }
    const matter = await setMatterRetentionDate(id, body.retentionDate);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    return NextResponse.json(matter);
  }

  const status = body?.status;
  if (status !== "open" && status !== "closed" && status !== "archived") {
    return NextResponse.json(
      { error: "status must be 'open', 'closed', or 'archived'" },
      { status: 400 },
    );
  }

  const matter = await updateMatterStatus(id, status);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  return NextResponse.json(matter);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const deleted = await deleteMatter(id);
    if (!deleted) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete matter" },
      { status: 400 },
    );
  }
}
