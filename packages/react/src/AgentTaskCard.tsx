import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type {
  TaskBinding,
  TaskController,
  TaskRunSnapshot,
  TaskValues,
} from "@plingjs/agent";
import { createTaskCard, type GuidedTaskPanel } from "@plingjs/vanilla";
import { usePling, usePlingUi } from "./context";

export interface AgentTaskCardHandle {
  open(taskId: string, values?: TaskValues, binding?: TaskBinding): void;
  close(): void;
  refresh(): void;
  setCatalog(visible: boolean): void;
}

export interface AgentTaskCardProps {
  controller: TaskController;
  /** Optional heading override. Task titles still come from their definitions. */
  title?: string;
  /** Show registered tasks while no run is active. Defaults to true. */
  catalog?: boolean;
  onPrompt?: (prompt: string, snapshot: TaskRunSnapshot) => void;
  onComplete?: (snapshot: TaskRunSnapshot) => void;
}

/**
 * Conversation-sized guided-task card.
 *
 * React owns only the mount lifecycle. The task state machine, fields, lookup,
 * confirmation and handoff remain in `@plingjs/agent`; the DOM view is shared
 * with Vue and the vanilla adapter.
 */
export const AgentTaskCard = forwardRef<AgentTaskCardHandle, AgentTaskCardProps>(function AgentTaskCard(
  { controller, title, catalog = true, onPrompt, onComplete },
  ref,
) {
  const pling = usePling();
  const ui = usePlingUi();
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<GuidedTaskPanel | null>(null);
  const promptRef = useRef(onPrompt);
  const completeRef = useRef(onComplete);

  promptRef.current = onPrompt;
  completeRef.current = onComplete;

  useEffect(() => {
    if (!host.current) return;
    const next = createTaskCard(controller, {
      locale: ui.locale,
      t: pling.ui.t,
      ...(title ? { title } : {}),
      catalog,
      onPrompt: (prompt, snapshot) => promptRef.current?.(prompt, snapshot),
      onComplete: (snapshot) => completeRef.current?.(snapshot),
    });
    panel.current = next;
    host.current.replaceChildren(next.element);
    return () => {
      next.destroy();
      if (panel.current === next) panel.current = null;
    };
  }, [controller, pling, title, ui.locale]);

  useEffect(() => {
    panel.current?.setCatalog(catalog);
  }, [catalog]);

  useImperativeHandle(ref, () => ({
    open(taskId, values, binding) {
      panel.current?.open(taskId, values, binding);
    },
    close() {
      panel.current?.close();
    },
    refresh() {
      panel.current?.refresh();
    },
    setCatalog(visible) {
      panel.current?.setCatalog(visible);
    },
  }), []);

  return <div ref={host} className="pling-task-card-host" style={pling.ui.cssVars} />;
});
