import { createExecutor, createPolicy } from "@plingjs/core";
import type { Registry } from "@plingjs/core";

export function allowAll(registry: Registry) {
  return createExecutor({ registry, policy: createPolicy(async () => true) });
}

export function click(element: Element | null): void {
  if (!element) throw new Error("Expected element to exist");
  (element as HTMLElement).click();
}

export function setInput(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function say(text: string): void {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    ".pling-chat__composer textarea, .pling-chat__composer input",
  );
  const form = document.querySelector<HTMLFormElement>(".pling-chat__composer");
  if (!input || !form) throw new Error("Chat composer is not mounted");
  setInput(input, text);
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

export async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
