import {
  recordSignature,
  normalizeRecordValue,
  type RegionRole,
  type RecordValue,
} from "@plingjs/core";
import { getRegistryNamespace } from "@plingjs/dom";
import type { ToolOptions } from "@plingjs/vanilla";
import type { DirectiveOptions } from "vue";
import type { Vue2Pling } from "./pling";

type ToolValue = string | ToolOptions | readonly ToolOptions[];
type ScopeValue = string | {
  id: string;
  label?: string;
  description?: string;
  role?: RegionRole;
  parent?: string;
};

interface BindingState {
  signature: string;
  value?: unknown;
  unbind: () => void;
}

function toolOptionsOf(value: ToolValue): ToolOptions[] {
  if (typeof value === "string") return [{ desc: value }];
  return Array.isArray(value) ? [...value] : [value as ToolOptions];
}

function paramSignature(params: ToolOptions["params"]): unknown {
  if (!params || !Array.isArray(params)) return params ?? null;
  return params.map((param) => ({
    ...param,
    pattern: param.pattern instanceof RegExp ? param.pattern.source : param.pattern,
    options: param.options ? "[options]" : undefined,
    min: typeof param.min === "function" ? "[fn]" : param.min,
    max: typeof param.max === "function" ? "[fn]" : param.max,
  }));
}

function toolSignature(values: ToolOptions[]): string {
  return JSON.stringify(values.map((value) => [
    value.id,
    value.desc,
    value.kind,
    value.action,
    value.key,
    value.scope,
    value.fidelity,
    paramSignature(value.params),
  ]));
}

function scopeSignature(value: ScopeValue): string {
  const normalized = typeof value === "string" ? { id: value } : value;
  return JSON.stringify([normalized.id, normalized.label, normalized.description, normalized.role, normalized.parent]);
}

function recordBinding(value: RecordValue | null | undefined): { signature: string; value: unknown } {
  const normalized = normalizeRecordValue(value);
  return {
    signature: normalized.record ? recordSignature(normalized.record) : `invalid:${normalized.problem ?? "unknown"}`,
    value,
  };
}

function scopeAttribute(pling: Vue2Pling, id: string): string {
  return getRegistryNamespace(pling.registry).scope(id);
}

export function createDirectives(pling: Vue2Pling): {
  tool: DirectiveOptions;
  scope: DirectiveOptions;
  record: DirectiveOptions;
} {
  const tools = new WeakMap<Element, BindingState>();
  const scopes = new WeakMap<Element, BindingState>();
  const records = new WeakMap<Element, BindingState>();

  const tool: DirectiveOptions = {
    inserted(el, binding) {
      const values = toolOptionsOf(binding.value as ToolValue);
      const signature = toolSignature(values);
      const unbinds = values.map((options) => pling.tool(el, options));
      tools.set(el, { signature, unbind: () => unbinds.forEach((off) => off()) });
    },
    update(el, binding) {
      const values = toolOptionsOf(binding.value as ToolValue);
      const signature = toolSignature(values);
      if (tools.get(el)?.signature === signature) return;
      tools.get(el)?.unbind();
      const unbinds = values.map((options) => pling.tool(el, options));
      tools.set(el, { signature, unbind: () => unbinds.forEach((off) => off()) });
    },
    unbind(el) {
      tools.get(el)?.unbind();
      tools.delete(el);
    },
  };

  const scope: DirectiveOptions = {
    bind(el, binding) {
      const value = binding.value as ScopeValue;
      const id = typeof value === "string" ? value : value.id;
      el.setAttribute("data-pling-scope", scopeAttribute(pling, id));
    },
    inserted(el, binding) {
      const value = binding.value as ScopeValue;
      const signature = scopeSignature(value);
      scopes.set(el, {
        signature,
        unbind: pling.scope(el, typeof value === "string" ? { id: value } : value),
      });
    },
    update(el, binding) {
      const value = binding.value as ScopeValue;
      const signature = scopeSignature(value);
      if (scopes.get(el)?.signature === signature) return;
      scopes.get(el)?.unbind();
      const id = typeof value === "string" ? value : value.id;
      el.setAttribute("data-pling-scope", scopeAttribute(pling, id));
      scopes.set(el, {
        signature,
        unbind: pling.scope(el, typeof value === "string" ? { id: value } : value),
      });
    },
    unbind(el) {
      scopes.get(el)?.unbind();
      scopes.delete(el);
      el.removeAttribute("data-pling-scope");
    },
  };

  const record: DirectiveOptions = {
    inserted(el, binding) {
      const current = recordBinding(binding.value as RecordValue | null | undefined);
      records.set(el, { ...current, unbind: pling.record(el, binding.value as RecordValue) });
    },
    update(el, binding) {
      const current = recordBinding(binding.value as RecordValue | null | undefined);
      const previous = records.get(el);
      if (previous?.signature === current.signature && previous.value === current.value) return;
      previous?.unbind();
      records.set(el, { ...current, unbind: pling.record(el, binding.value as RecordValue) });
    },
    unbind(el) {
      records.get(el)?.unbind();
      records.delete(el);
    },
  };

  return { tool, scope, record };
}
