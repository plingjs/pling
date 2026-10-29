export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (options.body instanceof Blob || options.body instanceof ArrayBuffer || typeof options.body === "string") {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`/api/recipe${path}`, {
    ...options,
    headers,
    body,
    credentials: "same-origin",
  });

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const value = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const error = value.error && typeof value.error === "object" ? (value.error as Record<string, unknown>) : {};
    throw new ApiError(
      response.status,
      String(error.code ?? "REQUEST_FAILED"),
      String(error.message ?? `Request failed with status ${response.status}`),
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
