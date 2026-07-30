import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const authPath = path.join(process.cwd(), "data", "auth.json");

if (!existsSync(authPath)) {
  console.log("No password is set — nothing to reset. Visit /login to set one.");
  process.exit(0);
}

const auth = JSON.parse(readFileSync(authPath, "utf-8"));
delete auth.passwordHash;
delete auth.passwordSalt;
delete auth.activeSessionToken;
writeFileSync(authPath, JSON.stringify(auth, null, 2), { encoding: "utf-8", mode: 0o600 });

console.log("Password cleared. Restart the server and visit /login to set a new one.");
