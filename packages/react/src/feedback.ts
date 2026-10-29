import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefCallback,
} from "react";
import type { FeedbackSeverity } from "@plingjs/core";
import {
  normalizeFeedbackValue,
  type FeedbackValue,
  type NormalizedFeedback,
} from "@plingjs/dom";
import { usePling } from "./context";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
let autoFeedbackId = 0;

export interface PlingFeedbackOptions {
  /** Stable fallback id when the value does not carry one. */
  id?: string;
  /** Region id used when neither the value nor the surrounding page provides one. */
  scope?: string;
}

export type PlingFeedbackInput = FeedbackValue | readonly FeedbackValue[];

function itemAt(value: unknown, index: number): NormalizedFeedback | undefined {
  return normalizeFeedbackValue(value).items[index];
}

function readMessage(item: NormalizedFeedback | undefined): string {
  if (!item) return "";
  return typeof item.message === "function" ? item.message() : item.message;
}

function readField(item: NormalizedFeedback | undefined): string | undefined {
  if (!item?.field) return undefined;
  return typeof item.field === "function" ? item.field() : item.field;
}

function readSeverity(item: NormalizedFeedback | undefined): FeedbackSeverity {
  if (!item?.severity) return "error";
  return typeof item.severity === "function" ? (item.severity() ?? "error") : item.severity;
}

/**
 * Declare page feedback that users can already see.
 *
 * ```tsx
 * usePlingFeedback(error, { id: "release_feedback", scope: "release_check" });
 * ```
 *
 * Feedback is read-only page data. It never becomes an action. Changing the
 * message, field, or severity updates the next snapshot without re-registering.
 */
export function usePlingFeedback(value: PlingFeedbackInput, options: PlingFeedbackOptions = {}): void {
  const pling = usePling();
  const valueRef = useRef(value);
  const optionsRef = useRef(options);
  valueRef.current = value;
  optionsRef.current = options;

  const fallbackId = useRef<string | null>(null);
  if (fallbackId.current === null) fallbackId.current = `feedback_${++autoFeedbackId}`;

  const preview = normalizeFeedbackValue(value);
  const ids = preview.items.map((item, index) => {
    if (item.id) return item.id;
    if (preview.items.length === 1 && options.id) return options.id;
    return `${fallbackId.current}:${index}`;
  });
  const structure = JSON.stringify([
    ids,
    preview.items.map((item) => item.scope ?? options.scope ?? ""),
    preview.problem ?? "",
  ]);

  useEffect(() => {
    if (preview.problem) {
      pling.warn(preview.problem);
      return;
    }
    const unbinds = ids.map((id, index) => pling.registry.declareFeedback({
      id,
      message: () => readMessage(itemAt(valueRef.current, index)),
      field: () => readField(itemAt(valueRef.current, index)),
      severity: () => readSeverity(itemAt(valueRef.current, index)),
      resolveScope: () => {
        const item = itemAt(valueRef.current, index);
        return item?.scope ?? optionsRef.current.scope;
      },
      source: "declared",
    }));
    return () => {
      for (const unbind of unbinds) unbind();
    };
  }, [pling, structure]);
}

/**
 * Mark an element as a highlight target for human handoff steps.
 *
 * The element is not registered as an action. The returned ref only supplies a
 * visual target for `highlight` in a handoff step.
 */
export function usePlingGuideTarget<T extends Element = HTMLElement>(id: string): RefCallback<T> {
  const pling = usePling();
  const [element, setElement] = useState<T | null>(null);

  useIsomorphicLayoutEffect(() => {
    const targetId = id.trim();
    if (!element || !targetId) return;
    return pling.registry.declareGuideTarget(targetId, {
      presence: (state) => pling.presence?.mark(element, state),
    });
  }, [element, id, pling]);

  return useCallback<RefCallback<T>>((node) => setElement(node), []);
}
