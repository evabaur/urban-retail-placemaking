import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function adminPassword() {
  if (process.env.URP_TEST_ADMIN_PASSWORD)
    return process.env.URP_TEST_ADMIN_PASSWORD;
  const content = readFileSync(
    join(homedir(), ".urp_app", "sites-access.txt"),
    "utf8",
  );
  const match = /Initial administrator password: ([^\r\n]+)/.exec(content);
  if (!match) throw Error("No configured test administrator credential.");
  return match[1].trim();
}
