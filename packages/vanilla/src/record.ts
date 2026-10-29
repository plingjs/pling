import { normalizeRecordValue, type RecordValue } from "@plingjs/core";
import {
  getRegistryNamespace,
  markRecordElement,
  nearestScope,
  queryAllComposed,
  unmarkRecordElement,
} from "@plingjs/dom";
import type { VanillaHost } from "./types";

function domOrderOf(element: Element, attribute: string): number | undefined {
  const index = queryAllComposed(element.ownerDocument, `[${attribute}]`).indexOf(element);
  return index >= 0 ? index : undefined;
}

/** 把一行 DOM 声明为记录；字段每次读快照时重新从同一个对象取。 */
export function bindRecord(
  host: VanillaHost,
  element: Element,
  value: RecordValue | null | undefined,
): () => void {
  const normalized = normalizeRecordValue(value);
  if (!normalized.record) {
    host.warn(normalized.problem ?? "pling.record 的声明无效");
    return () => {};
  }

  const record = normalized.record;
  const ids = getRegistryNamespace(host.registry);
  const recordId = ids.record(record.id);
  element.setAttribute("data-pling-record", recordId);
  markRecordElement(element, recordId);

  const scope = nearestScope(element);
  const untrack = scope ? host.track(element, scope) : null;
  const unbind = host.registry.declareRecord({
    id: recordId,
    ...(record.label === undefined ? {} : { label: record.label }),
    // 同一个对象原地修改（勾选、改名）时，下一轮快照直接看到新值。
    fields: () => normalizeRecordValue(value).record?.fields ?? {},
    resolveScope: () => nearestScope(element),
    order: () => domOrderOf(element, "data-pling-record"),
  });

  return () => {
    unbind();
    untrack?.();
    unmarkRecordElement(element);
    if (element.getAttribute("data-pling-record") === recordId) element.removeAttribute("data-pling-record");
  };
}
