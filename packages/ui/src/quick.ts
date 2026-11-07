/**
 * A recommended task shown by the built-in assistant surfaces.
 *
 * Strings remain valid: `quick: ["Show open orders"]` is the one-line form.
 * The structured form lets a business show a short human label while sending
 * a fuller prompt to the agent.
 */
export interface QuickTask {
  /** Short label shown on the button. */
  label: string;
  /** Prompt sent when the button is pressed. */
  prompt: string;
  /** Optional explanation shown on hover or by assistive technology. */
  description?: string;
  /** Keep the task visible but temporarily unavailable. */
  disabled?: boolean;
}

export type QuickTaskItem = string | QuickTask;

/** Normalize the public shorthand without changing its meaning. */
export function quickTaskOf(item: QuickTaskItem): QuickTask {
  return typeof item === "string" ? { label: item, prompt: item } : item;
}
