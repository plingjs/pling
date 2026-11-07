import { runSurfaceGatewayCli } from "@plingjs/surface-gateway";

try {
  await runSurfaceGatewayCli();
} catch (error) {
  process.stderr.write(`[surface-gateway] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
