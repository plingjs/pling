/**
 * A host-side handler that may answer the user's message before the model runs.
 *
 * Guided business flows often receive a complete instruction in one sentence
 * ("pregnancy yoga, Chen, two stars, write the intro") and can update the page
 * deterministically. Returning `{ handled: true }` keeps that exchange in the
 * transcript and history without spending a model turn.
 */
export interface AgentBeforeSendResult {
  /** When true, the model is not called for this message. */
  handled: boolean;
  /** Optional local assistant reply. It is appended after the user's message. */
  reply?: string;
}

export type AgentBeforeSendHandler = (
  text: string,
) => AgentBeforeSendResult | void | Promise<AgentBeforeSendResult | void>;
