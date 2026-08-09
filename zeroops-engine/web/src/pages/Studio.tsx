import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getMe,
  logout,
  pollVibeBuild,
  pollVibeShip,
  saveOpenAIKey,
  saveZeropsToken,
  startVibeBuild,
  startVibeShip,
} from '../api/client';
import type {
  AuthUser,
  VibeBuildJob,
  VibeBuildStatus,
  VibeJobEvent,
  VibeShipJob,
} from '../api/client';

type StepState = 'waiting' | 'running' | 'done' | 'failed';
type WorkTab = 'preview' | 'terminal' | 'code' | 'plan';

const BUILD_STEPS = [
  { key: 'generate', label: 'Generate', detail: 'LLM writes React + Vite files' },
  { key: 'install', label: 'Install', detail: 'npm install dependencies' },
  { key: 'preview', label: 'Preview', detail: 'Local Vite dev server' },
] as const;

const EXAMPLE_PROMPTS = [
  {
    id: 'bakery',
    name: 'Bakery task board',
    description: 'Task board for a bakery daily prep with checklists and shift notes',
  },
  {
    id: 'reading',
    name: 'Reading list',
    description: 'Reading list where I save books, notes, and star ratings',
  },
  {
    id: 'bugs',
    name: 'Bug tracker',
    description: 'Lightweight bug tracker for a small engineering team',
  },
];

function stageToStep(status: VibeBuildStatus | string | undefined): string | null {
  switch (status) {
    case 'queued':
    case 'generating':
      return 'generate';
    case 'installing':
      return 'install';
    case 'preview':
    case 'ready':
      return 'preview';
    default:
      return null;
  }
}

function stepsFromBuildStatus(
  status: VibeBuildStatus | string | undefined,
  failed: boolean,
): Record<string, StepState> {
  const order = ['generate', 'install', 'preview'] as const;
  const active = stageToStep(status);
  const next: Record<string, StepState> = {
    generate: 'waiting',
    install: 'waiting',
    preview: 'waiting',
  };
  if (!active && !failed) return next;
  const idx = active ? order.indexOf(active as (typeof order)[number]) : order.length - 1;
  order.forEach((key, i) => {
    if (failed && i === idx) next[key] = 'failed';
    else if (status === 'ready' || i < idx) next[key] = 'done';
    else if (i === idx) next[key] = failed ? 'failed' : 'running';
    else next[key] = 'waiting';
  });
  if (status === 'ready') {
    next.generate = 'done';
    next.install = 'done';
    next.preview = 'done';
  }
  if (failed && status === 'failed') {
    const runningKey = order.find((k) => next[k] === 'running') || active || 'generate';
    next[runningKey] = 'failed';
  }
  return next;
}

export function Studio() {
  const nav = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [pat, setPat] = useState(() => sessionStorage.getItem('zerops_pat') || '');
  const [showPatOnboarding, setShowPatOnboarding] = useState(false);
  const [showOpenAIOnboarding, setShowOpenAIOnboarding] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [openaiInput, setOpenaiInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [openaiError, setOpenaiError] = useState('');

  const [prompt, setPrompt] = useState('');
  const [building, setBuilding] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [feedPrompt, setFeedPrompt] = useState('');
  const [logs, setLogs] = useState('waiting for build — generate → install → preview');
  const [plan, setPlan] = useState('');
  const [codeFiles, setCodeFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkTab>('preview');
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [statusLabel, setStatusLabel] = useState('ready');
  const [statusMode, setStatusMode] = useState<'idle' | 'run' | 'ok' | 'fail'>('idle');
  const [errorBanner, setErrorBanner] = useState('');

  const [buildJobId, setBuildJobId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  const [stepState, setStepState] = useState<Record<string, StepState>>({
    generate: 'waiting',
    install: 'waiting',
    preview: 'waiting',
  });

  const termRef = useRef<HTMLPreElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seenEventsRef = useRef(0);

  const fileEntries = useMemo(() => Object.entries(codeFiles), [codeFiles]);
  const canShip = previewReady && !!workspaceId && !building && !shipping;

  useEffect(() => {
    getMe().then((d) => {
      if (!d.user) {
        nav('/login', { replace: true });
        return;
      }
      setUser(d.user);
      setHasToken(!!d.hasToken);
      setHasOpenAIKey(!!d.hasOpenAIKey || sessionStorage.getItem('has_openai') === '1');
    });
  }, [nav]);

  const appendLog = useCallback((text: string) => {
    const plain = String(text || '').replace(/\x1b\[[0-9;]*m/g, '');
    if (!plain) return;
    setLogs((prev) => {
      const base = prev.startsWith('waiting for build') || prev.startsWith('waiting for deploy')
        ? ''
        : prev;
      return base + plain + (plain.endsWith('\n') ? '' : '\n');
    });
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logs]);

  function applyBuildEvents(events: VibeJobEvent[] | undefined, cursorStart: number) {
    if (!events?.length) return cursorStart;
    let i = 0;
    for (const ev of events) {
      i += 1;
      if (cursorStart + i <= seenEventsRef.current) continue;
      if (ev.type === 'log' && (ev.text || ev.message)) {
        appendLog(String(ev.text || ev.message));
      } else if (ev.type === 'stage') {
        const msg = ev.message || ev.stage || '';
        appendLog(`[build] ${ev.stage || 'stage'}: ${msg}`);
      } else if (ev.type === 'plan' && ev.plan) {
        setPlan(String(ev.plan));
      } else if (ev.type === 'error') {
        appendLog(`[error] ${ev.error || 'build failed'}`);
      }
    }
    seenEventsRef.current = cursorStart + events.length;
    return seenEventsRef.current;
  }

  function applyBuildSnapshot(snap: VibeBuildJob) {
    if (snap.plan) setPlan(snap.plan);
    if (snap.codeFiles && Object.keys(snap.codeFiles).length) {
      setCodeFiles(snap.codeFiles);
      setActiveFile((prev) => prev || Object.keys(snap.codeFiles!)[0] || null);
    }
    if (snap.workspaceId) setWorkspaceId(snap.workspaceId);
    const path = snap.previewPath || snap.previewUrl;
    if (path) setPreviewUrl(path);

    setStepState(stepsFromBuildStatus(snap.status, snap.status === 'failed'));

    if (snap.status === 'ready') {
      setPreviewReady(true);
      setStatusLabel('preview ready');
      setStatusMode('ok');
      if (path) setTab('preview');
    } else if (snap.status === 'failed') {
      setPreviewReady(false);
      setStatusLabel('build failed');
      setStatusMode('fail');
      setErrorBanner(
        snap.error || 'Generation failed — try a clearer prompt or check OpenAI key.',
      );
    } else {
      setPreviewReady(false);
      setStatusLabel(snap.status || 'building');
      setStatusMode('run');
    }

    if (typeof snap.next === 'number') {
      // events already sliced when using cursor; full snapshot has all events
      const start =
        snap.events && snap.events.length && snap.next >= snap.events.length
          ? snap.next - snap.events.length
          : 0;
      applyBuildEvents(snap.events, start);
    } else {
      applyBuildEvents(snap.events, 0);
    }
  }

  async function onSaveToken(e: FormEvent) {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setTokenError('Token cannot be empty');
      return;
    }
    const res = await saveZeropsToken(token);
    if (res.success) {
      sessionStorage.setItem('zerops_pat', token);
      setPat(token);
      setHasToken(true);
      setShowPatOnboarding(false);
      setTokenError('');
    } else {
      setTokenError(res.error || 'Failed to save token');
    }
  }

  async function onSaveOpenAI(e: FormEvent) {
    e.preventDefault();
    const key = openaiInput.trim();
    if (!key) {
      setOpenaiError('API key cannot be empty');
      return;
    }
    const res = await saveOpenAIKey(key);
    if (res.success) {
      sessionStorage.setItem('has_openai', '1');
      setHasOpenAIKey(true);
      setShowOpenAIOnboarding(false);
      setOpenaiError('');
    } else {
      setOpenaiError(res.error || 'Failed to save OpenAI key');
    }
  }

  async function onBuild(e: FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || building || shipping) return;

    // Cancel any in-flight poll
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // New Build clears old preview and disables Ship
    setPipelineOpen(true);
    setFeedPrompt(text);
    setShowSuccess(false);
    setLiveUrl(null);
    setBuilding(true);
    setShipping(false);
    setPreviewReady(false);
    setPreviewUrl(null);
    setWorkspaceId(null);
    setBuildJobId(null);
    setPlan('');
    setCodeFiles({});
    setActiveFile(null);
    setLogs('');
    setErrorBanner('');
    setStatusLabel('building');
    setStatusMode('run');
    setTab('terminal');
    setStepState({ generate: 'running', install: 'waiting', preview: 'waiting' });
    seenEventsRef.current = 0;

    try {
      const started = await startVibeBuild(text);
      if (!started.ok || !started.jobId) {
        const msg =
          started.message ||
          started.error ||
          (started.status === 503
            ? 'Add OpenAI API key (or set server OPENAI_API_KEY) to Build.'
            : 'Build failed to start');
        if (started.code === 'OPENAI_API_KEY_REQUIRED' || started.status === 503) {
          setShowOpenAIOnboarding(true);
        }
        setErrorBanner(msg);
        appendLog(`[error] ${msg}`);
        setBuilding(false);
        setStatusLabel('error');
        setStatusMode('fail');
        setStepState({ generate: 'failed', install: 'waiting', preview: 'waiting' });
        return;
      }

      setBuildJobId(started.jobId);
      appendLog(`[build] job ${started.jobId} started`);

      const finalSnap = await pollVibeBuild(
        started.jobId,
        (snap) => {
          if (ac.signal.aborted) return;
          applyBuildSnapshot(snap);
        },
        { signal: ac.signal },
      );

      if (ac.signal.aborted) return;
      applyBuildSnapshot(finalSnap);

      if (finalSnap.status === 'ready') {
        appendLog('[build] preview ready — Ship when you want it live on Zerops');
      } else {
        setErrorBanner(finalSnap.error || 'Build failed');
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBanner(msg);
      appendLog(`[error] ${msg}`);
      setStatusLabel('error');
      setStatusMode('fail');
      setPreviewReady(false);
      setStepState((s) => {
        const next = { ...s };
        const running = (['generate', 'install', 'preview'] as const).find(
          (k) => next[k] === 'running',
        );
        if (running) next[running] = 'failed';
        else next.generate = 'failed';
        return next;
      });
    } finally {
      if (!ac.signal.aborted) setBuilding(false);
    }

    setPrompt('');
  }

  async function onShip() {
    if (!canShip || !workspaceId) return;

    const activeToken = pat || sessionStorage.getItem('zerops_pat') || '';
    if (!activeToken && !hasToken) {
      setShowPatOnboarding(true);
      setTokenError('Connect your Zerops PAT before shipping');
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setShipping(true);
    setShowSuccess(false);
    setLiveUrl(null);
    setErrorBanner('');
    setStatusLabel('shipping');
    setStatusMode('run');
    setTab('terminal');
    appendLog('[ship] packaging static SPA and deploying to Zerops…');

    try {
      const started = await startVibeShip({
        workspaceId,
        buildJobId: buildJobId || undefined,
      });
      if (!started.ok || !started.jobId) {
        const msg =
          started.message ||
          started.error ||
          (started.status === 503
            ? 'Add a Zerops PAT (or set DEMO_PAT on the server) to Ship.'
            : 'Ship failed to start');
        if (started.code === 'ZEROPS_TOKEN_REQUIRED' || started.status === 503) {
          setShowPatOnboarding(true);
        }
        setErrorBanner(msg);
        appendLog(`[error] ${msg}`);
        setShipping(false);
        setStatusLabel('ship blocked');
        setStatusMode('fail');
        return;
      }

      appendLog(`[ship] job ${started.jobId} started`);

      const finalSnap = await pollVibeShip(
        started.jobId,
        (snap: VibeShipJob) => {
          if (ac.signal.aborted) return;
          for (const ev of snap.events || []) {
            if (ev.type === 'log' && (ev.text || ev.message)) {
              appendLog(String(ev.text || ev.message));
            } else if (ev.type === 'stage') {
              appendLog(`[ship] ${ev.stage || 'stage'}: ${ev.message || ''}`);
            } else if (ev.type === 'error') {
              appendLog(`[error] ${ev.error || 'ship failed'}`);
            }
          }
          if (snap.status && snap.status !== 'ready' && snap.status !== 'failed') {
            setStatusLabel(snap.status);
            setStatusMode('run');
          }
        },
        { signal: ac.signal },
      );

      if (ac.signal.aborted) return;

      if (finalSnap.status === 'ready' && finalSnap.liveUrl) {
        setLiveUrl(finalSnap.liveUrl);
        setShowSuccess(true);
        setStatusLabel(finalSnap.verified ? 'live' : 'deployed');
        setStatusMode('ok');
        appendLog(
          `[live] ${finalSnap.liveUrl}${
            finalSnap.httpStatus != null ? ` → HTTP ${finalSnap.httpStatus}` : ''
          }`,
        );
      } else if (finalSnap.liveUrl) {
        setLiveUrl(finalSnap.liveUrl);
        setShowSuccess(true);
        setStatusLabel('deployed');
        setStatusMode('ok');
        appendLog(`[ship] URL: ${finalSnap.liveUrl}`);
      } else {
        const msg = finalSnap.error || 'Ship finished without a live URL';
        setErrorBanner(msg);
        appendLog(`[error] ${msg}`);
        setStatusLabel('ship failed');
        setStatusMode('fail');
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBanner(msg);
      appendLog(`[error] ${msg}`);
      setStatusLabel('error');
      setStatusMode('fail');
    } finally {
      if (!ac.signal.aborted) setShipping(false);
    }
  }

  async function onLogout() {
    abortRef.current?.abort();
    await logout();
    sessionStorage.removeItem('zerops_pat');
    sessionStorage.removeItem('has_openai');
    nav('/login');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zo-bg text-zo-text">
      {showOpenAIOnboarding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-hero-dark-navy/55 p-5 backdrop-blur-[12px]">
          <div className="zo-panel w-full max-w-[400px] p-6">
            <h2 className="m-0 mb-2 text-[20px] font-semibold leading-7 tracking-[-0.125px]">
              OpenAI key for Build
            </h2>
            <p className="mb-5 text-[16px] leading-6 text-zo-muted">
              Build generates a React app with the LLM. You can also set{' '}
              <code>OPENAI_API_KEY</code> on the server.{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zo-mark no-underline hover:underline"
              >
                Get a key
              </a>
            </p>
            {openaiError ? (
              <div className="mb-3 rounded-card border border-zo-fail/30 bg-zo-fail/10 px-3 py-2 text-[12px] font-medium leading-4 text-zo-fail">
                {openaiError}
              </div>
            ) : null}
            <form onSubmit={onSaveOpenAI}>
              <label className="zo-label" htmlFor="openai-key">
                OpenAI API key
              </label>
              <input
                id="openai-key"
                type="password"
                className="zo-input"
                value={openaiInput}
                onChange={(e) => setOpenaiInput(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="zo-ghost-btn flex-1"
                  onClick={() => setShowOpenAIOnboarding(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="zo-btn zo-btn-primary flex-1">
                  Save key
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showPatOnboarding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-hero-dark-navy/55 p-5 backdrop-blur-[12px]">
          <div className="zo-panel w-full max-w-[400px] p-6">
            <h2 className="m-0 mb-2 text-[20px] font-semibold leading-7 tracking-[-0.125px]">
              Zerops PAT for Ship
            </h2>
            <p className="mb-5 text-[16px] leading-6 text-zo-muted">
              Ship deploys the static SPA with <code>zcli</code>. Build only needs OpenAI.
              Token stays in this session.{' '}
              <a
                href="https://app.zerops.io/settings/token-management"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zo-mark no-underline hover:underline"
              >
                Create token
              </a>
            </p>
            {tokenError ? (
              <div className="mb-3 rounded-card border border-zo-fail/30 bg-zo-fail/10 px-3 py-2 text-[12px] font-medium leading-4 text-zo-fail">
                {tokenError}
              </div>
            ) : null}
            <form onSubmit={onSaveToken}>
              <label className="zo-label" htmlFor="pat">
                Personal access token
              </label>
              <input
                id="pat"
                type="password"
                className="zo-input"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste token"
                autoComplete="off"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="zo-ghost-btn flex-1"
                  onClick={() => setShowPatOnboarding(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="zo-btn zo-btn-primary flex-1">
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zo-line-2 bg-zo-surface px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2.5 text-zo-text no-underline">
            <span className="zo-mark">Z</span>
            <span className="text-[16px] font-medium leading-6">ZeroOps</span>
          </Link>
          <span className="text-zo-dim">/</span>
          <span className="text-[14px] font-medium leading-5 text-zo-muted">studio</span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              statusMode === 'ok'
                ? 'bg-zo-ok'
                : statusMode === 'run'
                  ? 'bg-zo-run'
                  : statusMode === 'fail'
                    ? 'bg-zo-fail'
                    : 'bg-zo-idle'
            }`}
          />
          <span className="text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-muted lowercase">
            {statusLabel}
          </span>
          <span className="text-zo-dim">·</span>
          <span className="text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim">
            {hasOpenAIKey ? 'openai✓' : 'openai·'} · {hasToken || pat ? 'pat✓' : 'pat·'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[14px] font-medium leading-5 text-zo-muted md:inline">
            {user?.name || user?.email}
          </span>
          <button type="button" className="zo-ghost-btn" onClick={() => setShowOpenAIOnboarding(true)}>
            OpenAI
          </button>
          <button type="button" className="zo-ghost-btn" onClick={() => setShowPatOnboarding(true)}>
            Token
          </button>
          <button type="button" className="zo-ghost-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[46vh] w-full shrink-0 flex-col border-b border-zo-line-2 bg-zo-bg md:max-h-none md:w-[380px] md:border-r md:border-b-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {!pipelineOpen ? (
              <div>
                <p className="m-0 mb-2 text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim uppercase">
                  vibe build
                </p>
                <h2 className="m-0 mb-2 text-[22px] font-bold leading-7 tracking-[-0.25px]">
                  Describe an app
                </h2>
                <p className="mb-5 text-[16px] leading-6 text-zo-muted">
                  Build generates a React + Vite SPA and opens a local preview. Ship deploys it
                  to Zerops when you are ready.
                </p>
                <div className="flex flex-col gap-2">
                  {EXAMPLE_PROMPTS.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-card border border-zo-line bg-zo-surface p-3.5 text-left transition-colors hover:border-zo-dim hover:bg-zo-surface-2"
                      onClick={() => setPrompt(t.description)}
                    >
                      <span className="pt-0.5 text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium leading-5">{t.name}</span>
                        <span className="mt-1 block text-[12px] font-medium leading-4 text-zo-dim">
                          {t.description.slice(0, 64)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 rounded-card border border-zo-line bg-zo-surface px-3.5 py-3 text-[14px] leading-5">
                  {feedPrompt}
                </div>
                {BUILD_STEPS.map((s) => {
                  const st = stepState[s.key];
                  const n = BUILD_STEPS.findIndex((x) => x.key === s.key) + 1;
                  return (
                    <div
                      key={s.key}
                      className="grid grid-cols-[28px_1fr_auto] gap-2.5 border-b border-zo-line-2 py-3.5"
                    >
                      <span
                        className={`pt-0.5 text-[12px] font-medium leading-4 tracking-[0.125px] ${
                          st === 'done'
                            ? 'text-zo-ok'
                            : st === 'running'
                              ? 'text-zo-run'
                              : st === 'failed'
                                ? 'text-zo-fail'
                                : 'text-zo-dim'
                        }`}
                      >
                        {n < 10 ? `0${n}` : n}
                      </span>
                      <div>
                        <div className="text-[14px] font-medium leading-5">{s.label}</div>
                        <div className="mt-0.5 text-[12px] font-medium leading-4 text-zo-dim">
                          {s.detail}
                        </div>
                      </div>
                      <span
                        className={`pt-0.5 text-[12px] font-medium leading-4 lowercase ${
                          st === 'done'
                            ? 'text-zo-ok'
                            : st === 'running'
                              ? 'text-zo-run'
                              : st === 'failed'
                                ? 'text-zo-fail'
                                : 'text-zo-dim'
                        }`}
                      >
                        {st === 'waiting'
                          ? 'wait'
                          : st === 'running'
                            ? 'running'
                            : st === 'failed'
                              ? 'failed'
                              : 'done'}
                      </span>
                    </div>
                  );
                })}
                {errorBanner ? (
                  <div className="mt-4 rounded-card border border-zo-fail/35 bg-zo-fail/10 p-3.5 text-[12px] font-medium leading-4 text-zo-fail">
                    {errorBanner}
                  </div>
                ) : null}
                {showSuccess && liveUrl ? (
                  <div className="mt-4 flex gap-3 rounded-card border border-zo-ok/35 bg-zo-ok/10 p-3.5">
                    <span className="h-fit rounded-card bg-zo-ok px-2 py-1 text-[12px] font-semibold leading-4 tracking-[0.125px] text-zo-ink">
                      OK
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium leading-5">Shipped</div>
                      <p className="m-0 mt-0.5 text-[12px] font-medium leading-4 text-zo-muted">
                        Live URL from Zerops (not invented).
                      </p>
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 block break-all font-mono text-[12px] text-zo-ok no-underline hover:underline"
                      >
                        {liveUrl}
                      </a>
                    </div>
                  </div>
                ) : null}
                {previewReady && !showSuccess ? (
                  <div className="mt-4 rounded-card border border-zo-line bg-zo-surface p-3.5">
                    <div className="text-[14px] font-medium leading-5">Local preview ready</div>
                    <p className="m-0 mt-0.5 text-[12px] font-medium leading-4 text-zo-muted">
                      Ship when you want this SPA live on Zerops.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form
            onSubmit={onBuild}
            className="shrink-0 space-y-2.5 border-t border-zo-line-2 bg-zo-surface p-4"
          >
            <textarea
              className="zo-input min-h-[64px] resize-none py-2.5 leading-6"
              rows={2}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the app to build…"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={!canShip}
                onClick={onShip}
                className="zo-btn h-9 px-4 text-[14px] disabled:opacity-40"
                title={
                  canShip
                    ? 'Deploy static SPA to Zerops'
                    : 'Ship is enabled after a successful Build preview'
                }
              >
                {shipping ? 'Shipping…' : 'Ship'}
              </button>
              <button
                type="submit"
                disabled={building || shipping}
                className="zo-btn zo-btn-primary h-9 px-4 text-[14px]"
              >
                {building ? 'Building…' : 'Build'}
              </button>
            </div>
          </form>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-zo-surface">
          <div className="flex h-10 shrink-0 items-stretch border-b border-zo-line-2 bg-zo-bg pl-1">
            {(
              [
                ['preview', 'preview'],
                ['terminal', 'terminal'],
                ['plan', 'plan'],
                ['code', 'code'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 border-0 border-b-2 bg-transparent px-3.5 text-[14px] font-medium leading-5 ${
                  tab === id
                    ? 'border-zo-mark bg-zo-surface text-zo-text'
                    : 'border-transparent text-zo-dim hover:text-zo-muted'
                }`}
              >
                {id === 'preview' ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      previewReady ? 'bg-zo-ok' : tab === id ? 'bg-zo-run' : 'bg-zo-idle'
                    }`}
                  />
                ) : null}
                {id === 'terminal' ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${tab === id ? 'bg-zo-ok' : 'bg-zo-idle'}`}
                  />
                ) : null}
                {label}
              </button>
            ))}
          </div>

          {tab === 'preview' ? (
            <div className="relative m-0 min-h-0 flex-1 bg-zo-bg">
              {previewUrl && previewReady ? (
                <iframe
                  title="App preview"
                  src={previewUrl}
                  className="h-full w-full border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                  <p className="m-0 text-[14px] font-medium leading-5 text-zo-muted">
                    {building
                      ? 'Generating preview…'
                      : 'Build an app to see the live preview here'}
                  </p>
                  <p className="m-0 text-[12px] font-medium leading-4 text-zo-dim">
                    Same-origin proxy: /api/vibe/preview/&lt;workspaceId&gt;/
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'terminal' ? (
            <pre
              ref={termRef}
              className="m-0 min-h-0 flex-1 overflow-y-auto bg-zo-surface px-4 py-3.5 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-zo-muted"
            >
              {logs}
            </pre>
          ) : null}

          {tab === 'plan' ? (
            <pre className="m-0 min-h-0 flex-1 overflow-y-auto bg-zo-surface px-4 py-3.5 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-zo-muted">
              {plan || '# plan appears after generate'}
            </pre>
          ) : null}

          {tab === 'code' ? (
            <div className="flex min-h-0 flex-1">
              <aside className="w-[180px] shrink-0 overflow-y-auto border-r border-zo-line-2 bg-zo-bg">
                <div className="px-3 pt-2.5 pb-1.5 text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim uppercase">
                  files
                </div>
                <ul className="m-0 list-none p-0 pb-3">
                  {fileEntries.length === 0 ? (
                    <li className="px-3 py-1.5 text-[12px] font-medium leading-4 text-zo-dim">
                      no files yet
                    </li>
                  ) : (
                    fileEntries.map(([name]) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => setActiveFile(name)}
                          className={`w-full truncate border-0 bg-transparent px-3 py-1.5 text-left font-mono text-[12px] ${
                            activeFile === name
                              ? 'rounded-card bg-zo-surface text-zo-text'
                              : 'text-zo-muted hover:bg-zo-surface-2 hover:text-zo-text'
                          }`}
                        >
                          {name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </aside>
              <div className="flex min-w-0 flex-1 flex-col bg-zo-surface">
                <div className="border-b border-zo-line-2 px-3.5 py-2 font-mono text-[12px] text-zo-dim">
                  {activeFile || '—'}
                </div>
                <pre className="m-0 min-h-0 flex-1 overflow-auto p-3.5 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-zo-muted">
                  {activeFile && codeFiles[activeFile]
                    ? codeFiles[activeFile]
                    : 'select a file'}
                </pre>
              </div>
            </div>
          ) : null}

          <div className="flex min-h-12 shrink-0 items-center gap-2.5 overflow-x-auto border-t border-zo-line-2 bg-zo-bg px-3.5">
            <span className="shrink-0 text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim uppercase">
              stack
            </span>
            <div className="flex min-w-max items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-card border border-zo-line bg-zo-surface px-2.5 py-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    previewReady
                      ? 'bg-zo-ok'
                      : building
                        ? 'bg-zo-run animate-pulse-dot'
                        : 'bg-zo-idle'
                  }`}
                />
                <span className="font-mono text-[12px] text-zo-text whitespace-nowrap">webapp</span>
                <span className="font-mono text-[11px] text-zo-dim whitespace-nowrap">
                  react+vite · static SPA
                </span>
              </div>
              {workspaceId ? (
                <span className="ml-2 font-mono text-[11px] text-zo-dim">
                  {workspaceId.slice(0, 12)}…
                </span>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
