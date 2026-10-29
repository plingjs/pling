import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefCallback,
} from "react";
import { normalizeRecordValue, type RecordValue } from "@plingjs/core";
import { getRegistryNamespace, markRecordElement, unmarkRecordElement } from "@plingjs/dom";
import { usePling } from "./context";
import { closestScopeOf, domOrderOf } from "./scope";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * 把列表的一行声明成「记录」：模型因此读得到字段，而不只是照 id 点动作。
 *
 * ```tsx
 * const row = usePlingRecord(todo);            // 主键取 todo.id（其次 todo.key）
 * return <li ref={row}>…</li>;
 *
 * const row = usePlingRecord({ data: todo, id: todo.code, fields: { 标题: todo.text } });
 * ```
 *
 * 字段是**实时读**的：勾选、改名之后不需要重新注册。卸载时自动注销。
 */
export function usePlingRecord<T extends Element = HTMLElement>(
  value: RecordValue | null | undefined,
): RefCallback<T> {
  const pling = usePling();
  const valueRef = useRef(value);
  valueRef.current = value;
  const [element, setElement] = useState<T | null>(null);
  const normalized = normalizeRecordValue(value);
  const signature = normalized.record
    ? JSON.stringify([normalized.record.id, normalized.record.label, Object.keys(normalized.record.fields)])
    : `invalid:${normalized.problem ?? "unknown"}`;

  useIsomorphicLayoutEffect(() => {
    if (!element) return;
    const current = normalizeRecordValue(valueRef.current);
    if (!current.record) {
      pling.warn(current.problem ?? "usePlingRecord 的声明无效");
      return;
    }

    const ids = getRegistryNamespace(pling.registry);
    const recordId = ids.record(current.record.id);
    element.setAttribute("data-pling-record", recordId);
    markRecordElement(element, recordId);
    const unbind = pling.registry.declareRecord({
      id: recordId,
      ...(current.record.label === undefined ? {} : { label: current.record.label }),
      fields: () => normalizeRecordValue(valueRef.current).record?.fields ?? {},
      resolveScope: () => closestScopeOf(element),
      order: () => domOrderOf(element, "data-pling-record"),
    });

    return () => {
      unbind();
      unmarkRecordElement(element);
      if (element.getAttribute("data-pling-record") === recordId) element.removeAttribute("data-pling-record");
    };
  }, [pling, element, signature]);

  return useCallback<RefCallback<T>>((node) => setElement(node), []);
}
