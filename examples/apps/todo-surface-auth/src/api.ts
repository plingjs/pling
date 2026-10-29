export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt?: number;
}

export interface PageSession {
  pageSessionId: string;
  pageToken: string;
  expiresAt: number;
  tenantId: string;
  surfaceUrl: string;
  pairingUrl: string;
  agentSessionsUrl: string;
  mcpUrl: string;
  scope: string[];
}

export interface Pairing {
  code: string;
  tenantId: string;
  tenantName: string;
  mcpUrl: string;
  expiresAt: number;
  scope: string[];
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  session() {
    return request<{ user: User; todos: Todo[] }>("/api/auth/session");
  },
  register(input: { email: string; password: string; name?: string }) {
    return request<{ user: User; todos: Todo[]; expiresAt: number }>("/api/auth/register", {
      method: "POST",
      body: input,
    });
  },
  login(input: { email: string; password: string }) {
    return request<{ user: User; todos: Todo[]; expiresAt: number }>("/api/auth/login", {
      method: "POST",
      body: input,
    });
  },
  logout() {
    return request<{ ok: true }>("/api/auth/logout", { method: "POST", body: {} });
  },
  listTodos() {
    return request<{ todos: Todo[] }>("/api/todos");
  },
  createTodo(text: string) {
    return request<{ todo: Todo }>("/api/todos", { method: "POST", body: { text } });
  },
  toggleTodo(id: string) {
    return request<{ todo: Todo }>(`/api/todos/${encodeURIComponent(id)}/toggle`, { method: "POST", body: {} });
  },
  deleteTodo(id: string) {
    return request<{ todo: Todo }>(`/api/todos/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  clearCompleted() {
    return request<{ removed: number; remaining: number }>("/api/todos/clear-completed", { method: "POST", body: {} });
  },
  pageSession() {
    return request<PageSession>("/api/surface/page-session", { method: "POST", body: {} });
  },
};

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }
  return payload as T;
}
