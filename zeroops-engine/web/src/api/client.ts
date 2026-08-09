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

/** Vibe build job status from GET /api/vibe/build/:jobId */
export type VibeBuildStatus =
  | 'queued'
  | 'generating'
  | 'installing'
  | 'preview'
  | 'ready'
  | 'failed';

export type VibeShipStatus =
  | 'queued'
  | 'packaging'
  | 'import'
  | 'push'
  | 'url'
  | 'verify'
  | 'ready'
  | 'failed';

export type VibeJobEvent = {
  type: string;
  stage?: string;
  message?: string;
  text?: string;
  plan?: string;
  error?: string;
  level?: string;
  [k: string]: unknown;
};

export type VibeBuildJob = {
  id: string;
  status: VibeBuildStatus;
  events?: VibeJobEvent[];
  next?: number;
  done: boolean;
  workspaceId: string | null;
  plan: string | null;
  codeFiles: Record<string, string> | null;
  dependencies?: string[];
  previewUrl: string | null;
  previewPath?: string | null;
  error: string | null;
  prompt?: string;
  startedAt?: number;
  finishedAt?: number | null;
};

export type VibeShipJob = {
  id: string;
  status: VibeShipStatus;
  events?: VibeJobEvent[];
  next?: number;
  done: boolean;
  workspaceId: string | null;
  projectName: string | null;
  projectId: string | null;
  liveUrl: string | null;
  verified: boolean | null;
  httpStatus: number | null;
  error: string | null;
  startedAt?: number;
  finishedAt?: number | null;
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function getMe(): Promise<{
  user: AuthUser | null;
  hasToken?: boolean;
  hasOpenAIKey?: boolean;
}> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return { user: null };
  const data = await parseJson<{
    user?: AuthUser;
    hasToken?: boolean;
    hasOpenAIKey?: boolean;
  }>(res);
  return {
    user: data.user ?? null,
    hasToken: data.hasToken,
    hasOpenAIKey: data.hasOpenAIKey,
  };
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

export async function saveOpenAIKey(apiKey: string) {
  const res = await fetch('/api/auth/openai-key', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  return parseJson<{ success?: boolean; error?: string; hasOpenAIKey?: boolean }>(res);
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

/** Start vibe Build (generate → install → local preview). Does not deploy. */
export async function startVibeBuild(prompt: string): Promise<{
  ok: boolean;
  status: number;
  jobId?: string;
  poll?: string;
  error?: string;
  message?: string;
  code?: string;
}> {
  const res = await fetch('/api/vibe/build', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await parseJson<{
    jobId?: string;
    poll?: string;
    error?: string;
    message?: string;
    code?: string;
  }>(res);
  return {
    ok: res.ok && !!data.jobId,
    status: res.status,
    jobId: data.jobId,
    poll: data.poll,
    error: data.error,
    message: data.message,
    code: data.code,
  };
}

export async function getVibeBuild(
  jobId: string,
  from?: number,
): Promise<VibeBuildJob | null> {
  const q = from != null ? `?from=${from}` : '';
  const res = await fetch(`/api/vibe/build/${encodeURIComponent(jobId)}${q}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Build poll failed — HTTP ${res.status}`);
  return parseJson<VibeBuildJob>(res);
}

/** Poll build until done. Calls onUpdate with each snapshot. */
export async function pollVibeBuild(
  jobId: string,
  onUpdate: (snap: VibeBuildJob) => void,
  opts?: { intervalMs?: number; maxMisses?: number; signal?: AbortSignal },
): Promise<VibeBuildJob> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const maxMisses = opts?.maxMisses ?? 8;
  let from = 0;
  let misses = 0;
  for (;;) {
    if (opts?.signal?.aborted) throw new Error('Build poll aborted');
    try {
      const snap = await getVibeBuild(jobId, from);
      if (!snap) throw Object.assign(new Error('Build job expired on the server'), { fatal: true });
      misses = 0;
      onUpdate(snap);
      if (typeof snap.next === 'number') from = snap.next;
      if (snap.done || snap.status === 'ready' || snap.status === 'failed') return snap;
    } catch (err) {
      const e = err as Error & { fatal?: boolean };
      if (e.fatal) throw e;
      misses += 1;
      if (misses >= maxMisses) throw e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Ship a ready workspace to Zerops (static SPA). */
export async function startVibeShip(body: {
  workspaceId?: string;
  jobId?: string;
  buildJobId?: string;
  projectName?: string;
}): Promise<{
  ok: boolean;
  status: number;
  jobId?: string;
  poll?: string;
  workspaceId?: string;
  projectName?: string;
  error?: string;
  message?: string;
  code?: string;
}> {
  const res = await fetch('/api/vibe/ship', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{
    jobId?: string;
    poll?: string;
    workspaceId?: string;
    projectName?: string;
    error?: string;
    message?: string;
    code?: string;
  }>(res);
  return {
    ok: res.ok && !!data.jobId,
    status: res.status,
    jobId: data.jobId,
    poll: data.poll,
    workspaceId: data.workspaceId,
    projectName: data.projectName,
    error: data.error,
    message: data.message,
    code: data.code,
  };
}

export async function getVibeShip(
  jobId: string,
  from?: number,
): Promise<VibeShipJob | null> {
  const q = from != null ? `?from=${from}` : '';
  const res = await fetch(`/api/vibe/ship/${encodeURIComponent(jobId)}${q}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Ship poll failed — HTTP ${res.status}`);
  return parseJson<VibeShipJob>(res);
}

export async function pollVibeShip(
  jobId: string,
  onUpdate: (snap: VibeShipJob) => void,
  opts?: { intervalMs?: number; maxMisses?: number; signal?: AbortSignal },
): Promise<VibeShipJob> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const maxMisses = opts?.maxMisses ?? 8;
  let from = 0;
  let misses = 0;
  for (;;) {
    if (opts?.signal?.aborted) throw new Error('Ship poll aborted');
    try {
      const snap = await getVibeShip(jobId, from);
      if (!snap) throw Object.assign(new Error('Ship job expired on the server'), { fatal: true });
      misses = 0;
      onUpdate(snap);
      if (typeof snap.next === 'number') from = snap.next;
      if (snap.done || snap.status === 'ready' || snap.status === 'failed') return snap;
    } catch (err) {
      const e = err as Error & { fatal?: boolean };
      if (e.fatal) throw e;
      misses += 1;
      if (misses >= maxMisses) throw e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export function deploySocketUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws/logs`;
}
