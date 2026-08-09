export type AuthUser = {
  email: string;
  name?: string;
  hasToken?: boolean;
};

export type Template = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  services?: Array<{ name: string; type: string }>;
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function getMe(): Promise<{ user: AuthUser | null; hasToken?: boolean }> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return { user: null };
  const data = await parseJson<{ user?: AuthUser; hasToken?: boolean }>(res);
  return { user: data.user ?? null, hasToken: data.hasToken };
}

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseJson<{ success?: boolean; error?: string; user?: AuthUser }>(res);
}

export async function signup(email: string, password: string, name: string) {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  return parseJson<{ success?: boolean; error?: string; user?: AuthUser }>(res);
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function saveZeropsToken(token: string) {
  const res = await fetch('/api/auth/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseJson<{ success?: boolean; error?: string }>(res);
}

export async function listTemplates(): Promise<Template[]> {
  const res = await fetch('/api/templates', { credentials: 'include' });
  if (!res.ok) return [];
  const data = await parseJson<{ templates?: Template[] }>(res);
  return data.templates ?? [];
}

export async function synthesize(prompt: string) {
  const res = await fetch('/api/synthesize', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return parseJson<{
    success?: boolean;
    projectName?: string;
    zeropsYml?: string;
    codeFiles?: Record<string, string>;
    error?: string;
  }>(res);
}

export function deploySocketUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws/logs`;
}
