export const Vue: any;
export function computed<T>(getter: () => T): { readonly value: T };
export function ref<T>(value: T): { value: T };
export function onMounted(callback: () => void): void;
export function onBeforeUnmount(callback: () => void): void;
export const createPling: any;
