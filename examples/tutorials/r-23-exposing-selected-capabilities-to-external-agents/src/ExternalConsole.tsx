import { useCallback, useEffect, useRef, useState } from "react";
import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import type { copyFor } from "./copy";

function outcomeOf(response: SurfaceResponse): string {
  if (!response.ok) return response.error.code;
  if ("error" in response.result) return response.result.error.code;
  return "ok";
}

export function ExternalConsole({ surface, copy }: {
  surface: AgentSurface;
  copy: ReturnType<typeof copyFor>;
}) {
  const [lastResponse, setLastResponse] = useState<SurfaceResponse | null>(null);
  const [notice, setNotice] = useState("");
  const requestSequence = useRef(0);

  const nextRequest = useCallback((method: "describe" | "invoke", extra: Record<string, unknown> = {}) => ({
    protocol: SURFACE_PROTOCOL,
    id: `demo-${++requestSequence.current}`,
    method,
    ...extra,
  }), []);

  const send = useCallback(async (request: ReturnType<typeof nextRequest>) => {
    const response = await surface.handle(request);
    setLastResponse(response);
    return response;
  }, [surface]);

  const describeSurface = useCallback(async () => {
    setNotice("");
    await send(nextRequest("describe", { input: { limit: 2 } }));
  }, [nextRequest, send]);

  useEffect(() => {
    void describeSurface();
  }, [describeSurface]);

  async function addThroughProtocol(): Promise<void> {
    setNotice("");
    const response = await send(
      nextRequest("invoke", { capability: "todo.add", input: { text: copy.externalTask } }),
    );
    setNotice(`todo.add → ${outcomeOf(response)}`);
  }

  async function tryHiddenDelete(): Promise<void> {
    setNotice("");
    const description = await surface.handle(nextRequest("describe", { input: { limit: 2 } }));
    if (!description.ok || !("context" in description.result)) {
      setLastResponse(description);
      setNotice(description.ok ? "describe → unexpected result" : `describe → ${description.error.code}`);
      return;
    }

    const target = description.result.context.recordIds[0];
    if (!target) return;
    const response = await send(nextRequest("invoke", { capability: `todo.remove@task:${target}` }));
    setNotice(`todo.remove → ${outcomeOf(response)}`);
  }

  async function requestClear(): Promise<void> {
    setNotice("");
    const response = await send(nextRequest("invoke", { capability: "todo.clear_completed" }));
    setNotice(outcomeOf(response) === "ok" ? copy.approved : `clear_completed → ${outcomeOf(response)}`);
  }

  return (
    <aside className="external" aria-labelledby="external-title">
      <div className="external__head">
        <div>
          <p className="eyebrow">{copy.panelEyebrow}</p>
          <h2 id="external-title">{copy.panelTitle}</h2>
        </div>
        <code>0.1</code>
      </div>
      <p className="external__lead">{copy.panelLead}</p>
      <div className="external__actions">
        <button data-testid="surface-describe" type="button" onClick={() => void describeSurface()}>{copy.describe}</button>
        <button data-testid="surface-add" type="button" onClick={() => void addThroughProtocol()}>{copy.addExternal}</button>
        <button data-testid="surface-hidden" type="button" onClick={() => void tryHiddenDelete()}>{copy.tryHidden}</button>
        <button data-testid="surface-clear" type="button" onClick={() => void requestClear()}>{copy.requestClear}</button>
      </div>
      {notice ? <p className="notice">{notice}</p> : null}
      <p className="response-label">{copy.response}</p>
      <pre data-testid="surface-response">{lastResponse ? JSON.stringify(lastResponse, null, 2) : "—"}</pre>
    </aside>
  );
}
