import type { TaskChoice, TaskDefinition, TaskField } from "@plingjs/agent";
import type { VanillaHost } from "./types";
import { bindAction } from "./tool";

export interface TaskLookupActionOptions {
  /** Maximum candidates returned to the model; defaults to 8. */
  maxResults?: number;
  /** Override the action id derived from a field. */
  actionId?: (field: TaskField, task: TaskDefinition) => string;
  /** Override the model-facing action description. */
  description?: (field: TaskField, task: TaskDefinition) => string;
  /** Receives non-fatal binding conflicts, such as two fields sharing one action id. */
  onWarning?: (message: string) => void;
}

export interface TaskLookupResult {
  query: string;
  /** Present when the query is shorter than the field's `minChars`. */
  minChars?: number;
  choices: TaskChoice[];
}

function defaultActionId(field: TaskField): string {
  return `search_${field.name}`;
}

function normalizeChoices(choices: readonly TaskChoice[], maxResults: number): TaskChoice[] {
  return choices.slice(0, maxResults).map((choice) => ({
    value: String(choice.value),
    label: String(choice.label),
    ...(choice.description ? { description: String(choice.description) } : {}),
  }));
}

/**
 * Expose task lookups as narrow read actions.
 *
 * The UI and the model call the same `field.lookup()` implementation. This avoids
 * teaching the model internal ids: it searches by a human name first, then uses the
 * returned `value` in the next action. Search itself remains read-only and never
 * bypasses the executor, approval, or scope rules for the eventual write.
 */
export function registerTaskLookupActions(
  host: Pick<VanillaHost, "registry" | "warn">,
  definitions: readonly TaskDefinition[],
  options: TaskLookupActionOptions = {},
): () => void {
  const maxResults = Math.max(1, Math.min(50, Math.floor(options.maxResults ?? 8)));
  const seen = new Set<string>();
  const unbindings: Array<() => void> = [];
  const warn = options.onWarning ?? host.warn;

  try {
    for (const task of definitions) {
      for (const field of task.fields ?? []) {
        if (!field.lookup) continue;
        const id = (options.actionId?.(field, task) ?? field.searchAction ?? defaultActionId(field)).trim();
        if (!id) throw new Error(`Task "${task.id}" field "${field.name}" has an empty search action id`);
        if (seen.has(id)) {
          warn(`Task lookup action "${id}" is declared more than once; the first implementation is used`);
          continue;
        }
        seen.add(id);
        const minChars = Math.max(1, Math.floor(field.minChars ?? 1));
        const description =
          options.description?.(field, task) ??
          `Search ${field.label} by a human-readable name or keyword. Use the returned value as ${field.name}.`;
        unbindings.push(
          bindAction(host, {
            id,
            desc: description,
            label: `Search ${field.label}`,
            summary: `Find a ${field.label} without knowing its internal id.`,
            kind: "read",
            confirm: false,
            params: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: `Name or keyword for ${field.label}`,
                  minLength: minChars,
                },
              },
              required: ["query"],
            },
            run: async (args): Promise<TaskLookupResult> => {
              const query = String(args.query ?? "").trim();
              if (query.length < minChars) return { query, minChars, choices: [] };
              const choices = await field.lookup!(query, {});
              return { query, choices: normalizeChoices(choices, maxResults) };
            },
          }),
        );
      }
    }
  } catch (error) {
    for (const unbind of unbindings.reverse()) unbind();
    throw error;
  }

  return () => {
    for (const unbind of unbindings.reverse()) unbind();
    unbindings.length = 0;
  };
}
