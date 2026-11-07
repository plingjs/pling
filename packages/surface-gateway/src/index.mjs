export { BRIDGE_PROTOCOL, SURFACE_PROTOCOL, createSurfaceGateway } from "./gateway.mjs";
export { createSurfaceServer } from "./server.mjs";
export { createMcpHandler, TOOLS } from "./mcp.mjs";
export { ConfigError, loadConfig, normalizeConfig, normalizeOrigin } from "./config.mjs";
export { GatewayError, asGatewayError } from "./errors.mjs";
export { cliHelp, runSurfaceGatewayCli } from "./cli.mjs";
export { PACKAGE_VERSION } from "./version.mjs";
