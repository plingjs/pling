import { useEffect, useRef, type CSSProperties } from "react";
import { createGuideActions, type GuideActionItem, type GuideActions } from "@plingjs/dom";
import { usePlingUi } from "./context";

export interface AgentGuideActionsProps {
  items: readonly GuideActionItem[];
  hint?: string;
  ariaLabel?: string;
  onCommand(command: string): void;
}

/**
 * React wrapper around the shared compact guide action row.
 *
 * The renderer lives in `@plingjs/dom` so Vue, React and plain DOM mounts share
 * one visual contract without an adapter depending on another adapter. Keeping the command callback in a ref avoids
 * remounting the row on every render of the host page.
 */
export function AgentGuideActions({ items, hint = "", ariaLabel, onCommand }: AgentGuideActionsProps) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<GuideActions | null>(null);
  const command = useRef(onCommand);
  command.current = onCommand;
  const ui = usePlingUi();

  useEffect(() => {
    if (!host.current) return;
    const instance = createGuideActions({
      items,
      hint,
      ...(ariaLabel ? { ariaLabel } : {}),
      locale: ui.locale,
      onCommand: (value) => command.current(value),
    });
    actions.current = instance;
    host.current.replaceChildren(instance.element);
    return () => {
      instance.destroy();
      if (actions.current === instance) actions.current = null;
    };
    // The renderer is created once; later changes go through update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    actions.current?.update({
      items,
      hint,
      ...(ariaLabel ? { ariaLabel } : {}),
      locale: ui.locale,
      onCommand: (value) => command.current(value),
    });
  }, [items, hint, ariaLabel, ui.locale]);

  return <div ref={host} style={ui.cssVars as CSSProperties} />;
}
