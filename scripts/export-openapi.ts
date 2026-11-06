import { writeFileSync } from "fs";
import { buildApp } from "../src/app.js";

async function exportOpenApi() {
  const app = buildApp();
  await app.ready();

  const spec = app.swagger();
  const output = JSON.stringify(spec, null, 2);

  writeFileSync("docs/openapi.json", output, "utf-8");
  console.log("OpenAPI spec exported to docs/openapi.json");

  await app.close();
}

exportOpenApi().catch((err) => {
  console.error("Failed to export OpenAPI spec:", err);
  process.exit(1);
});

