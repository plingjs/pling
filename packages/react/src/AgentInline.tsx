import { forwardRef } from "react";
import { AgentDock, type AgentDockHandle, type AgentDockProps } from "./AgentDock";

export interface AgentInlineProps extends Omit<
  AgentDockProps,
  "layout" | "side" | "launcherPlacement" | "launcherLabel" | "defaultOpen" | "onOpenChange"
> {}

/**
 * A conversation surface that belongs to the page grid.
 *
 * It has no fixed positioning, no launcher, and no overlay. Use it when a
 * workbench should reserve a column for the assistant. The normal one-line
 * setup remains `<AgentDock />`.
 */
export const AgentInline = forwardRef<AgentDockHandle, AgentInlineProps>(function AgentInline(
  props,
  ref,
) {
  return (
    <AgentDock
      {...props}
      ref={ref}
      layout="inline"
      defaultOpen
      surfaceId={props.surfaceId ?? "inline"}
    />
  );
});
