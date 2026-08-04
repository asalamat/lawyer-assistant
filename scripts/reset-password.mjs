import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync } from "crypto";
import { existsSync } from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "app.db");
const email = process.argv[2];

if (!email) {
  console.log("Usage: npm run reset-password -- <email>");
  console.log("Resets that user's password to a random temporary one they must change on next login.");
  process.exit(1);
}

if (!existsSync(dbPath)) {
  console.log("No database found — nothing to reset.");
  process.exit(0);
}

const db = new DatabaseSync(dbPath);
const normalizedEmail = email.trim().toLowerCase();
const user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);

if (!user) {
  console.log(`No user found with email ${normalizedEmail}.`);
  process.exit(1);
}

const temporaryPassword = randomBytes(9).toString("base64url");
const salt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(temporaryPassword, salt, 64).toString("hex");

db.prepare(
  "UPDATE users SET passwordHash = ?, passwordSalt = ?, mustChangePassword = 1 WHERE id = ?",
).run(passwordHash, salt, user.id);
db.prepare("DELETE FROM sessions WHERE userId = ?").run(user.id);

console.log(`Temporary password for ${normalizedEmail}: ${temporaryPassword}`);
console.log("They'll be required to change it on next login.");
