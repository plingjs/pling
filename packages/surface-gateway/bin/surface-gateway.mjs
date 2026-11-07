#!/usr/bin/env node
import { cliHelp, PACKAGE_VERSION, runSurfaceGatewayCli } from "../index.mjs";

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  process.stdout.write(cliHelp());
  process.exit(0);
}
if (args.has("--version") || args.has("-v")) {
  process.stdout.write(`${PACKAGE_VERSION}\n`);
  process.exit(0);
}

try {
  await runSurfaceGatewayCli();
} catch (error) {
  process.stderr.write(`[surface-gateway] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
