export interface DemoAuthOptions {
  password: string;
  secureCookie: boolean;
  publicOrigin: string;
  sessionTtlMs?: number;
}

export interface DemoAuth {
  login(password: string): { user: { id: string }; cookie: string } | null;
  authorize(input: { headers: Headers }):
    | { ok: true; user: { id: string } }
    | { ok: false; status: number; message: string };
  logout(headers: Headers): string;
  isSignedIn(headers: Headers): boolean;
}

export function createDemoAuth(options: DemoAuthOptions): DemoAuth;
