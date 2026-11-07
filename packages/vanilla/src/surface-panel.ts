import type { PlingUiController } from "@plingjs/ui";
import { createPlingUi } from "./ui";
import type { VanillaSurfaceGateway } from "./surface-gateway";

export interface SurfaceAccessPanelOptions {
  title?: string;
  /** UI controller used for locale, theme and message fallbacks. */
  ui?: PlingUiController;
  /** Mount target. When omitted the caller mounts `element` itself. */
  mount?: Element;
}

export interface SurfaceAccessPanel {
  readonly element: HTMLElement;
  destroy(): void;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(text: string, className: string | undefined, onClick: () => void): HTMLButtonElement {
  const element = make("button", className, text);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}

function duration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1_000));
  if (seconds === 0) return "";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

interface SurfaceCopy {
  title: string;
  idle: string;
  connecting: string;
  connected: string;
  disconnected: string;
  closed: string;
  connect: string;
  reconnect: string;
  cancel: string;
  pairing: string;
  pairingHint: string;
  pairingCode: string;
  pairExpired: string;
  claim: string;
  claiming: string;
  claimHint: string;
  access: string;
  command: string;
  copy: string;
  copied: string;
  agent: string;
  scope: string;
  revoke: string;
  revoking: string;
  expires: string;
  expired: string;
  pageSession: string;
  mcp: string;
  functionAllowlist: string;
}

function copyFor(locale: string): SurfaceCopy {
  if (!locale.toLowerCase().startsWith("zh")) {
    return {
      title: "External Agent",
      idle: "Not connected",
      connecting: "Connecting",
      connected: "Page connected",
      disconnected: "Reconnecting",
      closed: "Connection closed",
      connect: "Connect Surface",
      reconnect: "Reconnect",
      cancel: "Disconnect",
      pairing: "Create pairing code",
      pairingHint: "Give the one-time code to an external Agent. Keep this page open.",
      pairingCode: "Pairing code",
      pairExpired: "This code expired. Create a new one.",
      claim: "Create Agent token",
      claiming: "Creating…",
      claimHint: "Public-demo mode. The token belongs to this page session; never post it in chat, a repository, or public logs.",
      access: "Agent token",
      command: "Codex command",
      copy: "Copy",
      copied: "Copied",
      agent: "Bound Agent",
      scope: "Exposed capabilities",
      revoke: "Revoke Agent",
      revoking: "Revoking…",
      expires: "left",
      expired: "expired",
      pageSession: "Page session",
      mcp: "MCP endpoint",
      functionAllowlist: "Function-based allowlist",
    };
  }
  return {
    title: "外部 Agent",
    idle: "未连接",
    connecting: "正在连接",
    connected: "页面已连接",
    disconnected: "正在重连",
    closed: "连接已关闭",
    connect: "连接 Surface",
    reconnect: "重新连接",
    cancel: "断开",
    pairing: "生成配对码",
    pairingHint: "把一次性配对码交给外部 Agent。页面必须保持打开。",
    pairingCode: "配对码",
    pairExpired: "配对码已过期，请重新生成。",
    claim: "生成 Agent token",
    claiming: "正在生成…",
    claimHint: "公开演示模式。Agent token 只属于当前页面会话；不要发到对话、仓库或公开日志。",
    access: "Agent token",
    command: "Codex 接入命令",
    copy: "复制",
    copied: "已复制",
    agent: "已绑定的 Agent",
    scope: "允许的能力",
    revoke: "撤销 Agent",
    revoking: "正在撤销…",
    expires: "剩余",
    expired: "已过期",
    pageSession: "页面会话",
    mcp: "MCP 端点",
    functionAllowlist: "函数式白名单",
  };
}

const STYLE = `
.pling-surface{display:grid;gap:14px;padding:18px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:16px;background:var(--pling-surface-bg,#fff);color:var(--pling-surface-fg,#172033);font-size:13px}
.pling-surface *{box-sizing:border-box}.pling-surface button{font:inherit;cursor:pointer;border:1px solid #d5dfeb;border-radius:8px;background:#fff;color:#253449;padding:7px 10px}.pling-surface button:disabled{cursor:not-allowed;opacity:.55}
.pling-surface__head,.pling-surface__actions,.pling-surface__codeRow,.pling-surface__copyRow{display:flex;align-items:center;justify-content:space-between;gap:10px}.pling-surface__head{align-items:flex-start}
.pling-surface__eyebrow,.pling-surface__label{margin:0;color:#64748b;font-size:10px;font-weight:750;letter-spacing:.1em;text-transform:uppercase}.pling-surface h2{margin:2px 0 0;font-size:18px;letter-spacing:-.02em}
.pling-surface__status{padding:4px 8px;border:1px solid #dbe4ee;border-radius:999px;color:#64748b;font-size:11px;white-space:nowrap}.pling-surface__status.is-connected{border-color:#a7e3c4;color:#137a4b;background:#effcf5}.pling-surface__status.is-disconnected{border-color:#f4d38b;color:#93620b;background:#fff9e9}.pling-surface__status.is-closed{color:#9a3412;background:#fff4ed}
.pling-surface__error{margin:0;padding:9px 10px;border-radius:9px;color:#9f1239;background:#fff1f2}.pling-surface__session{display:grid;gap:7px;padding:10px;border-radius:10px;background:#f7fafc}.pling-surface__session>div{display:flex;justify-content:space-between;gap:12px;min-width:0}.pling-surface__session span{color:#64748b}.pling-surface__session code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pling-surface__block{display:grid;gap:8px;padding-top:12px;border-top:1px solid #edf1f5}.pling-surface__agent{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}.pling-surface__agent span{color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}.pling-surface__scope{display:flex;flex-wrap:wrap;gap:5px;margin:0;padding:0;list-style:none}.pling-surface__scope li{padding:3px 6px;border-radius:6px;background:#eef6ff;color:#0b61a4}.pling-surface__hint{margin:0;color:#64748b;line-height:1.5}.pling-surface__copyRow code{min-width:0;overflow-wrap:anywhere}.pling-surface__pair{font-size:20px!important;letter-spacing:.12em}.pling-surface__details{border:1px solid #e4ebf2;border-radius:9px;padding:8px 10px}.pling-surface__details summary{cursor:pointer;color:#27364a;font-weight:650}.pling-surface__code{display:grid;gap:8px;margin-top:8px}.pling-surface__code pre{margin:0;overflow:auto;padding:9px;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:11px;line-height:1.55}.pling-surface__primary{border-color:#1b83e8;background:#1680e8;color:#fff;font-weight:650}.pling-surface__danger{border-color:#f0b4b8;color:#b4232b;background:#fff7f7;justify-self:start}.pling-surface__actions{padding-top:4px;flex-wrap:wrap}
@media(max-width:520px){.pling-surface__head,.pling-surface__session>div{align-items:flex-start;flex-direction:column}.pling-surface__status{align-self:flex-start}}
`;

/**
 * Plain-DOM counterpart of the Vue `<SurfaceAccessPanel>`.
 *
 * It only renders the gateway's public snapshot and forwards actions; the
 * browser runtime and protocol remain in `@plingjs/surface-browser`.
 */
export function createSurfaceAccessPanel(
  gateway: VanillaSurfaceGateway,
  options: SurfaceAccessPanelOptions = {},
): SurfaceAccessPanel {
  const ownUi = options.ui ? null : createPlingUi();
  const ui = options.ui ?? ownUi!;
  const element = make("section", "pling-surface");
  element.dataset.plingUi = "";
  element.dataset.testid = "pling-surface-access";
  element.setAttribute("aria-labelledby", "pling-surface-title");
  for (const [name, value] of Object.entries(ui.cssVars)) element.style.setProperty(name, value);

  const style = make("style");
  style.textContent = STYLE;
  element.append(style);

  let copied = "";
  let now = Date.now();
  const clock = setInterval(() => {
    now = Date.now();
    render();
  }, 1_000);
  const unsubscribe = gateway.subscribe(render);
  const unsubscribeUi = ui.subscribe(render);

  function copyText(value: string, kind: string): void {
    if (!value || !navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      copied = kind;
      render();
      setTimeout(() => {
        if (copied === kind) {
          copied = "";
          render();
        }
      }, 1_500);
    });
  }

  function command(): string {
    const access = gateway.access;
    if (!access) return "";
    return [
      `export PLING_AGENT_TOKEN='${access.token}'`,
      "codex mcp remove pling-surface >/dev/null 2>&1 || true",
      `codex mcp add pling-surface --url ${access.mcpUrl} --bearer-token-env-var PLING_AGENT_TOKEN`,
    ].join("\n");
  }

  function render(): void {
    const copy = copyFor(ui.locale);
    const snapshot = gateway.getSnapshot();
    const page = snapshot.page;
    const pairing = snapshot.pairing;
    const access = snapshot.access;
    const agent = snapshot.agent;
    const expiresAt = agent?.expiresAt ?? pairing?.expiresAt ?? page?.expiresAt;
    const remaining = expiresAt ? duration(expiresAt - now) || copy.expired : "";
    const pairingExpired = Boolean(pairing && pairing.expiresAt <= now);
    const nodes: HTMLElement[] = [style];

    element.className = `pling-surface${ui.classNames.panel ? ` ${ui.classNames.panel}` : ""}`;
    for (const [name, value] of Object.entries(ui.cssVars)) element.style.setProperty(name, value);

    const head = make("header", "pling-surface__head");
    const title = make("div");
    const heading = make("h2", undefined, options.title?.trim() || copy.title);
    heading.id = "pling-surface-title";
    title.append(
      make("p", "pling-surface__eyebrow", copy.title),
      heading,
    );
    head.append(title, make("span", `pling-surface__status is-${snapshot.state}`, copy[snapshot.state]));
    nodes.push(head);

    if (snapshot.error) {
      const error = make("p", "pling-surface__error", snapshot.error);
      error.setAttribute("role", "alert");
      nodes.push(error);
    }

    if (page) {
      const session = make("div", "pling-surface__session");
      const fact = (label: string, value: string): HTMLElement => {
        const row = make("div");
        row.append(make("span", undefined, label), make("code", undefined, value));
        return row;
      };
      session.append(fact(copy.pageSession, page.pageSessionId));
      if (remaining) session.append(fact(copy.expires, remaining));
      session.append(fact(copy.mcp, page.mcpUrl));
      nodes.push(session);
    }

    if (agent) {
      const block = make("section", "pling-surface__block");
      block.append(make("p", "pling-surface__label", copy.agent));
      const identity = make("div", "pling-surface__agent");
      identity.append(make("strong", undefined, agent.agentId), make("span", undefined, agent.sessionId));
      block.append(identity, make("p", "pling-surface__label", copy.scope));
      const scopes = make("ul", "pling-surface__scope");
      const exposed = Array.isArray(agent.scope) ? agent.scope : [copy.functionAllowlist];
      for (const scope of exposed) {
        const item = make("li");
        item.append(make("code", undefined, scope));
        scopes.append(item);
      }
      const revoke = button(snapshot.busy === "revoke" ? copy.revoking : copy.revoke, "pling-surface__danger", () => void gateway.revoke());
      revoke.disabled = Boolean(snapshot.busy);
      block.append(scopes, revoke);
      nodes.push(block);
    } else if (gateway.mode === "public-demo") {
      const block = make("section", "pling-surface__block");
      if (access) {
        block.append(make("p", "pling-surface__label", copy.access));
        const token = make("div", "pling-surface__copyRow");
        token.append(make("code", undefined, access.token), button(copied === "token" ? copy.copied : copy.copy, undefined, () => copyText(access.token, "token")));
        block.append(
          token,
          make("p", "pling-surface__hint", copy.claimHint),
        );
        const details = make("details", "pling-surface__details");
        details.append(make("summary", undefined, copy.command));
        const code = make("div", "pling-surface__code");
        code.append(make("pre", undefined, command()), button(copied === "command" ? copy.copied : copy.copy, undefined, () => copyText(command(), "command")));
        details.append(code);
        block.append(details);
      } else {
        const claim = button(snapshot.busy === "claim" ? copy.claiming : copy.claim, "pling-surface__primary", () => void gateway.claim());
        claim.disabled = snapshot.state !== "connected" || Boolean(snapshot.busy);
        block.append(
          make("p", "pling-surface__hint", copy.claimHint),
          claim,
        );
      }
      nodes.push(block);
    } else {
      const block = make("section", "pling-surface__block");
      if (pairing && !pairingExpired) {
        block.append(make("p", "pling-surface__label", copy.pairingCode));
        const code = make("div", "pling-surface__codeRow");
        code.append(make("code", "pling-surface__pair", pairing.code), button(copied === "pairing" ? copy.copied : copy.copy, undefined, () => copyText(pairing.code, "pairing")));
        block.append(code, make("p", "pling-surface__hint", copy.pairingHint));
      } else {
        const pair = button(snapshot.busy === "pair" ? copy.claiming : copy.pairing, "pling-surface__primary", () => void gateway.pair());
        pair.disabled = snapshot.state !== "connected" || Boolean(snapshot.busy);
        block.append(
          make("p", "pling-surface__hint", pairingExpired ? copy.pairExpired : copy.pairingHint),
          pair,
        );
      }
      nodes.push(block);
    }

    const actions = make("div", "pling-surface__actions");
    if (snapshot.state === "idle" || snapshot.state === "closed" || snapshot.state === "disconnected") {
      const connect = button(snapshot.state === "disconnected" ? copy.reconnect : copy.connect, "pling-surface__primary", () => void gateway.connect());
      connect.disabled = Boolean(snapshot.busy);
      actions.append(connect);
    } else {
      const disconnect = button(copy.cancel, undefined, () => gateway.disconnect());
      disconnect.disabled = Boolean(snapshot.busy);
      actions.append(disconnect);
    }
    nodes.push(actions);
    element.replaceChildren(...nodes);
  }

  if (options.mount) options.mount.append(element);
  render();

  return {
    element,
    destroy() {
      clearInterval(clock);
      unsubscribe();
      unsubscribeUi();
      element.remove();
      ownUi?.destroy();
    },
  };
}
