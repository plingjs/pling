/**
 * Task routing shared by framework adapters.
 *
 * A task entrance is the inverse of a declared action:
 *
 *   action → the agent may operate this element
 *   task   → a person may ask the agent to do something
 *
 * Task entrances are deliberately not registered as actions. If they were, the
 * model would see a control whose only effect is to send another prompt to
 * itself. One mounted agent surface owns the conversation; task entrances only
 * deliver a prompt to that surface.
 */

export interface PlingAskOptions {
  /**
   * Optional surface id. Omit it for the normal single-surface case; the most
   * recently mounted surface receives the task. Custom hosts can register a
   * named surface and route to it explicitly.
   */
  surface?: string;
  /** Element that triggered the task. Used by custom surfaces and diagnostics. */
  source?: Element;
}

export interface PlingTaskTarget {
  id: string;
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
}

export interface PlingTaskController {
  /** Public imperative entrance used by the adapter's ask API and task controls. */
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
  /** @internal Used by built-in surfaces. */
  register(target: PlingTaskTarget): () => void;
}

export class PlingTaskError extends Error {
  constructor(
    readonly code: "PLING_TASK_EMPTY" | "PLING_TASK_SURFACE_MISSING" | "PLING_TASK_SURFACE_UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "PlingTaskError";
  }
}

export function createTaskController(warn: (message: string) => void): PlingTaskController {
  const targets = new Set<PlingTaskTarget>();

  return {
    register(target) {
      targets.add(target);
      return () => targets.delete(target);
    },

    ask(prompt, options = {}) {
      const text = String(prompt ?? "").trim();
      if (!text) {
        return Promise.reject(
          new PlingTaskError("PLING_TASK_EMPTY", "ask(): prompt must be a non-empty string."),
        );
      }

      const mounted = [...targets];
      const target = options.surface
        ? mounted.find((candidate) => candidate.id === options.surface)
        : mounted[mounted.length - 1];

      if (!target) {
        const message = options.surface
          ? `ask(): no mounted agent surface has id "${options.surface}".`
          : "ask(): no agent surface is mounted. Add an agent surface or a custom host to the page.";
        warn(message);
        return Promise.reject(
          new PlingTaskError(
            options.surface ? "PLING_TASK_SURFACE_UNKNOWN" : "PLING_TASK_SURFACE_MISSING",
            message,
          ),
        );
      }

      return target.ask(text, options);
    },
  };
}
