import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openApiDocument } from "../src/openapi/document.js";

const specPath = fileURLToPath(new URL("../openapi.json", import.meta.url));
const generated = `${JSON.stringify(openApiDocument, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const committed = (() => {
    try {
      return readFileSync(specPath, "utf8");
    } catch {
      return "";
    }
  })();

  if (committed !== generated) {
    console.error(
      "apps/api/openapi.json is out of date with the code. Run `npm run openapi:generate -w apps/api` and commit the result.",
    );
    process.exit(1);
  }

  console.log("apps/api/openapi.json is up to date.");
} else {
  writeFileSync(specPath, generated);
  console.log("Wrote apps/api/openapi.json");
}
