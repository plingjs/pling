export type ReleaseLocale = "en" | "zh";

export interface ReleaseConfig {
  environment: "preview" | "production";
  gatewayUrl: string;
  browserApiKey: string;
  modelPolicy: {
    mode: "pinned" | "allowlist";
    models: string[];
  };
  appOrigin: string;
  allowedOrigins: string[];
  maxTurns: number;
  contextTokens: number;
  telemetryEndpoint: string;
  killSwitchUrl: string;
}

export type ReleaseCheckStatus = "pass" | "warn" | "fail";

export interface ReleaseCheck {
  id: string;
  label: string;
  status: ReleaseCheckStatus;
  detail: string;
}

export function evaluateRelease(config: ReleaseConfig, locale: ReleaseLocale = "en"): {
  ready: boolean;
  checks: ReleaseCheck[];
} {
  const zh = locale === "zh";
  const text = (en: string, cn: string) => (zh ? cn : en);
  const isProduction = config.environment === "production";
  const maxTurnLimit = isProduction ? 20 : 100;
  const isLoopback = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(?:\/|$)/.test(config.gatewayUrl);
  const modelIds = config.modelPolicy.models.filter((model) => model.trim() && model !== "*");
  const modelShapeValid =
    modelIds.length > 0 &&
    (config.modelPolicy.mode !== "pinned" || modelIds.length === 1);
  const telemetryConfigured = /^https?:\/\/[^/\s]+/i.test(config.telemetryEndpoint);
  const killSwitchConfigured = /^https?:\/\/[^/\s]+/i.test(config.killSwitchUrl);
  const originListed = config.allowedOrigins.includes(config.appOrigin);

  const checks: ReleaseCheck[] = [
    {
      id: "gateway_tls",
      label: text("Gateway uses HTTPS", "网关使用 HTTPS"),
      status: config.gatewayUrl.startsWith("https://") || (!isProduction && isLoopback) ? "pass" : "fail",
      detail: config.gatewayUrl.startsWith("https://")
        ? text("Model traffic uses TLS.", "模型流量使用 TLS。")
        : isLoopback
          ? text("Loopback HTTP is allowed only in preview; production must use HTTPS.", "只有预览可以使用本机回环 HTTP；生产必须使用 HTTPS。")
          : text("The gateway must use HTTPS.", "网关必须使用 HTTPS。"),
    },
    {
      id: "browser_key",
      label: text("No provider key in the browser", "浏览器中不保存供应商密钥"),
      status: config.browserApiKey === "" ? "pass" : "fail",
      detail: config.browserApiKey === ""
        ? text("The provider credential is supplied by the gateway.", "供应商凭据由网关提供。")
        : text("A provider key in browser configuration is public.", "写在浏览器配置里的供应商密钥等同于公开。"),
    },
    {
      id: "model_policy",
      label: text("Model is pinned or allowlisted", "模型已固定或进入白名单"),
      status: modelShapeValid ? "pass" : "fail",
      detail: modelShapeValid
        ? text(
            `${config.modelPolicy.mode === "pinned" ? "Pinned model" : "Allowlist"}: ${modelIds.join(", ")}.`,
            `${config.modelPolicy.mode === "pinned" ? "固定模型" : "白名单"}：${modelIds.join("、")}。`,
          )
        : text(
            "Provide a non-empty pinned model or a non-wildcard allowlist.",
            "请提供明确的固定模型，或不允许通配符的模型白名单。",
          ),
    },
    {
      id: "turn_budget",
      label: text("Turn budget is bounded", "轮数有上限"),
      status: config.maxTurns > 0 && config.maxTurns <= maxTurnLimit ? "pass" : "fail",
      detail: text(
        `maxTurns is ${config.maxTurns}; ${isProduction ? "production" : "preview"} allows at most ${maxTurnLimit}.`,
        `maxTurns 为 ${config.maxTurns}；${isProduction ? "生产" : "预览"}最多允许 ${maxTurnLimit}。`,
      ),
    },
    {
      id: "context_budget",
      label: text("Context budget is explicit", "上下文预算明确"),
      status: config.contextTokens >= 2_048 && config.contextTokens <= 128_000 ? "pass" : "warn",
      detail: text(`contextTokens is ${config.contextTokens}.`, `contextTokens 为 ${config.contextTokens}。`),
    },
    {
      id: "telemetry",
      label: text("Telemetry has a delivery endpoint", "遥测有明确的投递端点"),
      status: telemetryConfigured ? "pass" : "fail",
      detail: telemetryConfigured
        ? text(`Telemetry is delivered to ${config.telemetryEndpoint}.`, `遥测投递到 ${config.telemetryEndpoint}。`)
        : text("Configure an HTTP(S) telemetry endpoint before release.", "发布前必须配置 HTTP(S) 遥测端点。"),
    },
    {
      id: "origin_allowlist",
      label: text("Gateway origin is allowlisted", "网关来源已进入白名单"),
      status: config.allowedOrigins.length > 0 && !config.allowedOrigins.includes("*") && originListed ? "pass" : "fail",
      detail: config.allowedOrigins.includes("*")
        ? text("A wildcard origin lets any site use the gateway.", "通配符来源会让任何站点都能调用网关。")
        : originListed
          ? text(`The application origin ${config.appOrigin} is explicitly allowed.`, `应用来源 ${config.appOrigin} 已明确允许。`)
          : text(`Add the application origin ${config.appOrigin} to the allowlist.`, `请把应用来源 ${config.appOrigin} 加入白名单。`),
    },
    {
      id: "kill_switch",
      label: text("Kill switch is configured outside the page", "页面之外已配置停用开关"),
      status:
        killSwitchConfigured && (!isProduction || config.killSwitchUrl.startsWith("https://"))
          ? "pass"
          : "fail",
      detail: killSwitchConfigured
        ? text(
            `The switch is configured at ${config.killSwitchUrl}; verify it independently before release.`,
            `停用开关配置在 ${config.killSwitchUrl}；发布前请独立验证它确实可用。`,
          )
        : text(
            "Configure an HTTPS endpoint that can disable the assistant without a client build.",
            "请配置一个 HTTPS 端点，使团队不必重新发布前端就能关闭助手。",
          ),
    },
  ];

  return { ready: !checks.some((check) => check.status === "fail"), checks };
}

export const previewConfig: ReleaseConfig = {
  environment: "preview",
  gatewayUrl: "http://127.0.0.1:5332/api/llm/v1",
  browserApiKey: "",
  modelPolicy: { mode: "pinned", models: ["demo-model"] },
  appOrigin: "http://127.0.0.1:5261",
  allowedOrigins: ["http://127.0.0.1:5261"],
  maxTurns: 100,
  contextTokens: 8_192,
  telemetryEndpoint: "http://127.0.0.1:5332/telemetry",
  killSwitchUrl: "http://127.0.0.1:5332/release/disable",
};

export const productionConfig: ReleaseConfig = {
  environment: "production",
  gatewayUrl: "https://app.example.com/api/llm/v1",
  browserApiKey: "",
  modelPolicy: { mode: "allowlist", models: ["production-chat-model"] },
  appOrigin: "https://app.example.com",
  allowedOrigins: ["https://app.example.com"],
  maxTurns: 10,
  contextTokens: 16_384,
  telemetryEndpoint: "https://ops.example.com/telemetry",
  killSwitchUrl: "https://ops.example.com/release/disable",
};
