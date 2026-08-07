import { NextResponse } from "next/server";
import { listUsers } from "@/lib/auth";

// Assigning a colleague to a matter is something any staff member does, so
// this deliberately does NOT live under /api/users — that whole prefix is
// admin-only in src/proxy.ts. Returns only what a person picker needs; no
// password or session data (listUsers() never selects those anyway).
export async function GET() {
  const users = await listUsers();
  return NextResponse.json(
    users
      .filter((user) => user.active)
      .map(({ id, name, email, role }) => ({ id, name, email, role })),
  );
}
