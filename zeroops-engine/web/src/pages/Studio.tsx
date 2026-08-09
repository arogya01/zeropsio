import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deploySocketUrl,
  getMe,
  listTemplates,
  logout,
  saveZeropsToken,
  synthesize,
} from '../api/client';
import type { AuthUser, Template } from '../api/client';

type NodeStatus = 'idle' | 'building' | 'deploying' | 'healthy' | 'failed';
type StepState = 'waiting' | 'running' | 'done';

const NODES = [
  { id: 'web-frontend', host: 'webapp', db: false },
  { id: 'api-gateway', host: 'apigateway', db: false },
  { id: 'ai-worker', host: 'aiworker', db: false },
  { id: 'db-postgres', host: 'dbpostgres', db: true },
  { id: 'cache-valkey', host: 'cachevalkey', db: true },
] as const;

const ALIAS: Record<string, string> = {
  webapp: 'web-frontend',
  'web-frontend': 'web-frontend',
  apigateway: 'api-gateway',
  'api-gateway': 'api-gateway',
  aiworker: 'ai-worker',
  'ai-worker': 'ai-worker',
  postgres: 'db-postgres',
  'db-postgres': 'db-postgres',
  valkey: 'cache-valkey',
  'cache-valkey': 'cache-valkey',
};

const STEPS = [
  { key: 'synth', label: 'Synthesize', detail: 'Code + zerops import YAML' },
  { key: 'net', label: 'Import', detail: 'zcli project project-import' },
  { key: 'lxd', label: 'Provision', detail: 'Service stacks on Zerops' },
  { key: 'health', label: 'Audit', detail: 'HTTP + reachable service checks' },
] as const;

export function Studio() {
  const nav = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [pat, setPat] = useState(() => sessionStorage.getItem('zerops_pat') || '');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [feedPrompt, setFeedPrompt] = useState('');
  const [logs, setLogs] = useState('waiting for deploy — zcli output streams here');
  const [yaml, setYaml] = useState('# appears after synthesize');
  const [codeFiles, setCodeFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [tab, setTab] = useState<'terminal' | 'yaml' | 'code'>('terminal');
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [statusLabel, setStatusLabel] = useState('ready');
  const [statusMode, setStatusMode] = useState<'idle' | 'run' | 'ok'>('idle');

  const [stepState, setStepState] = useState<Record<string, StepState>>({
    synth: 'waiting',
    net: 'waiting',
    lxd: 'waiting',
    health: 'waiting',
  });
  const [nodeStatus, setNodeStatus] = useState<Record<string, NodeStatus>>(() =>
    Object.fromEntries(NODES.map((n) => [n.id, 'idle' as NodeStatus])),
  );
  const [nodeHost, setNodeHost] = useState<Record<string, string>>(() =>
    Object.fromEntries(NODES.map((n) => [n.id, n.host])),
  );

  const socketRef = useRef<WebSocket | null>(null);
  const termRef = useRef<HTMLPreElement | null>(null);

  const fileEntries = useMemo(() => Object.entries(codeFiles), [codeFiles]);

  useEffect(() => {
    getMe().then((d) => {
      if (!d.user) {
        nav('/login', { replace: true });
        return;
      }
      setUser(d.user);
      setHasToken(!!d.hasToken);
      const localPat = sessionStorage.getItem('zerops_pat');
      if (!d.hasToken && !localPat) setShowOnboarding(true);
    });
    listTemplates().then(setTemplates);
  }, [nav]);

  const appendLog = useCallback((text: string) => {
    const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
    setLogs((prev) => {
      const base = prev.startsWith('waiting for deploy') ? '' : prev;
      return base + plain + '\n';
    });
    const t = plain.toLowerCase();
    setStepState((s) => {
      const next = { ...s };
      if (t.includes('synthesiz') || t.includes('spec')) next.synth = 'running';
      if (t.includes('yaml file was checked') || t.includes('network') || t.includes('import')) {
        next.synth = 'done';
        next.net = 'running';
      }
      if (t.includes('stack.create') || t.includes('provision') || t.includes('services to be added')) {
        next.net = 'done';
        next.lxd = 'running';
      }
      if (t.includes('project imported') || t.includes('health') || t.includes('audit')) {
        next.lxd = 'done';
        next.health = 'running';
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(deploySocketUrl());
      socketRef.current = ws;
      ws.onmessage = (event) => {
        let data: {
          type?: string;
          text?: string;
          message?: string;
          logs?: Array<{ text?: string; message?: string }>;
          serviceId?: string;
          status?: string;
          privateHost?: string;
          privateIp?: string;
          liveUrl?: string;
        };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === 'history' && Array.isArray(data.logs)) {
          data.logs.forEach((l) => appendLog(l.text || l.message || ''));
        } else if (data.type === 'log') {
          appendLog(data.text || data.message || '');
        } else if (data.type === 'topology-update' && data.serviceId) {
          const id = ALIAS[data.serviceId] || ALIAS[data.serviceId.toLowerCase()] || data.serviceId;
          const st = (data.status || 'idle').toLowerCase() as NodeStatus;
          setNodeStatus((n) => ({ ...n, [id]: st }));
          const host = data.privateHost || data.privateIp;
          if (host) setNodeHost((h) => ({ ...h, [id]: host }));
        } else if (data.type === 'complete') {
          setDeploying(false);
          setStatusLabel('ready');
          setStatusMode('ok');
          setStepState((s) => ({ ...s, health: 'done' }));
          if (data.liveUrl) {
            setLiveUrl(data.liveUrl);
            setShowSuccess(true);
          }
        } else if (data.type === 'error') {
          setDeploying(false);
          setStatusLabel('error');
          setStatusMode('idle');
          appendLog(`[error] ${(data as { error?: string }).error || 'deploy failed'}`);
        }
      };
      ws.onclose = () => setTimeout(connect, 3000);
    }
    connect();
    return () => {
      socketRef.current?.close();
    };
  }, [appendLog]);

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
      setShowOnboarding(false);
      setTokenError('');
    } else {
      setTokenError(res.error || 'Failed to save token');
    }
  }

  async function onDeploy(e: FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    const activeToken = pat || sessionStorage.getItem('zerops_pat') || '';
    if (!activeToken && !hasToken) {
      setShowOnboarding(true);
      setTokenError('Connect your Zerops PAT before deploying');
      return;
    }

    setPipelineOpen(true);
    setFeedPrompt(text);
    setShowSuccess(false);
    setLiveUrl(null);
    setDeploying(true);
    setStatusLabel('deploying');
    setStatusMode('run');
    setLogs('');
    setStepState({ synth: 'waiting', net: 'waiting', lxd: 'waiting', health: 'waiting' });
    setNodeStatus(Object.fromEntries(NODES.map((n) => [n.id, 'building' as NodeStatus])));

    try {
      const result = await synthesize(text);
      if (result.success) {
        if (result.zeropsYml) setYaml(result.zeropsYml);
        if (result.codeFiles) {
          setCodeFiles(result.codeFiles);
          const first = Object.keys(result.codeFiles)[0];
          if (first) setActiveFile(first);
        }
      }
    } catch {
      /* synthesize optional; deploy still proceeds */
    }

    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          action: 'deploy',
          prompt: text,
          templateId: selectedTemplateId,
          zeropsToken: activeToken || undefined,
        }),
      );
    }

    setPrompt('');
    setSelectedTemplateId(null);
  }

  async function onLogout() {
    await logout();
    sessionStorage.removeItem('zerops_pat');
    nav('/login');
  }

  function setStep(key: string, state: StepState) {
    setStepState((s) => ({ ...s, [key]: state }));
  }

  // silence unused if needed
  void setStep;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showOnboarding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5">
          <div className="w-full max-w-[400px] rounded-sm border border-zo-line bg-zo-surface p-5">
            <h2 className="m-0 mb-2 text-lg font-semibold">Zerops PAT required</h2>
            <p className="mb-4 text-[13px] leading-relaxed text-zo-muted">
              Deploys run <code>zcli</code> as your account. Token stays in this session only.{' '}
              <a
                href="https://app.zerops.io/settings/token-management"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zo-text"
              >
                Create token
              </a>
            </p>
            {tokenError ? (
              <div className="mb-2 font-mono text-xs text-zo-fail">{tokenError}</div>
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
              <button type="submit" className="zo-btn zo-btn-primary mt-3 w-full">
                Connect
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-zo-line-2 px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="zo-mark">Z</span>
            <span className="text-[13px] font-semibold">ZeroOps</span>
          </Link>
          <span className="text-zo-dim">/</span>
          <span className="font-mono text-xs text-zo-muted">studio</span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              statusMode === 'ok'
                ? 'bg-zo-ok'
                : statusMode === 'run'
                  ? 'bg-zo-run'
                  : 'bg-zo-idle'
            }`}
          />
          <span className="font-mono text-[11px] text-zo-muted lowercase">{statusLabel}</span>
          <span className="text-zo-dim">·</span>
          <span className="font-mono text-[11px] text-zo-dim">BYO PAT · zcli</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-zo-muted md:inline">
            {user?.name || user?.email}
          </span>
          <button type="button" className="zo-ghost-btn" onClick={() => setShowOnboarding(true)}>
            Token
          </button>
          <button type="button" className="zo-ghost-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left */}
        <aside className="flex max-h-[46vh] w-full shrink-0 flex-col border-b border-zo-line-2 md:max-h-none md:w-[380px] md:border-r md:border-b-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {!pipelineOpen ? (
              <div>
                <p className="m-0 mb-2 font-mono text-[10px] tracking-wider text-zo-dim uppercase">
                  deploy
                </p>
                <h2 className="m-0 mb-2 text-lg font-semibold tracking-tight">
                  Choose a stack or describe one
                </h2>
                <p className="mb-5 text-[13px] leading-relaxed text-zo-muted">
                  Synthesize services + YAML, import with your PAT, stream <code>zcli</code>, audit
                  health.
                </p>
                <div className="flex flex-col gap-1.5">
                  {(templates.length
                    ? templates
                    : [
                        {
                          id: 'ai-video-clipper',
                          name: 'AI Video Clipper',
                          description:
                            'AI Video Clipper SaaS with Next.js, Go API, Python Whisper worker, PostgreSQL, and Valkey',
                        },
                        {
                          id: 'ecommerce-platform',
                          name: 'E-Commerce',
                          description:
                            'E-Commerce platform with Bun frontend, Go backend, PostgreSQL HA, Valkey cache',
                        },
                        {
                          id: 'rag-search-engine',
                          name: 'RAG Search',
                          description:
                            'Enterprise RAG Search with React, FastAPI, PostgreSQL pgvector, and Valkey',
                        },
                      ]
                  ).map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-sm border border-zo-line bg-zo-surface p-3 text-left transition-colors hover:border-zo-dim hover:bg-zo-surface-2"
                      onClick={() => {
                        setSelectedTemplateId(t.id);
                        setPrompt(t.description || t.name);
                      }}
                    >
                      <span className="pt-0.5 font-mono text-[11px] text-zo-dim">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium">{t.name}</span>
                        <span className="mt-0.5 block font-mono text-[10px] leading-snug text-zo-dim">
                          {(t.services || [])
                            .map((s) => s.name)
                            .join(' · ') || t.description?.slice(0, 48)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 rounded-sm border border-zo-line bg-zo-surface px-3 py-2.5 text-[13px] leading-snug">
                  {feedPrompt}
                </div>
                {STEPS.map((s) => {
                  const st = stepState[s.key];
                  return (
                    <div
                      key={s.key}
                      className="grid grid-cols-[28px_1fr_auto] gap-2.5 border-b border-zo-line-2 py-3"
                    >
                      <span
                        className={`pt-0.5 font-mono text-[11px] ${
                          st === 'done'
                            ? 'text-zo-ok'
                            : st === 'running'
                              ? 'text-zo-run'
                              : 'text-zo-dim'
                        }`}
                      >
                        {STEPS.findIndex((x) => x.key === s.key) + 1 < 10
                          ? `0${STEPS.findIndex((x) => x.key === s.key) + 1}`
                          : STEPS.findIndex((x) => x.key === s.key) + 1}
                      </span>
                      <div>
                        <div className="text-[13px] font-medium">{s.label}</div>
                        <div className="font-mono text-[11px] text-zo-dim">{s.detail}</div>
                      </div>
                      <span
                        className={`pt-0.5 font-mono text-[10px] lowercase ${
                          st === 'done'
                            ? 'text-zo-ok'
                            : st === 'running'
                              ? 'text-zo-run'
                              : 'text-zo-dim'
                        }`}
                      >
                        {st === 'waiting' ? 'wait' : st === 'running' ? 'running' : 'done'}
                      </span>
                    </div>
                  );
                })}
                {showSuccess ? (
                  <div className="mt-3.5 flex gap-3 rounded-sm border border-zo-ok/35 bg-zo-ok/10 p-3">
                    <span className="h-fit rounded-sm bg-zo-ok px-1.5 py-1 font-mono text-[10px] font-semibold tracking-wide text-zo-ink">
                      OK
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">Deploy finished</div>
                      <p className="m-0 text-xs text-zo-muted">
                        Open the URL only if the audit reported a live host.
                      </p>
                      {liveUrl ? (
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all font-mono text-xs text-zo-ok"
                        >
                          {liveUrl}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form
            onSubmit={onDeploy}
            className="shrink-0 space-y-2 border-t border-zo-line-2 bg-zo-surface p-3"
          >
            <textarea
              className="zo-input min-h-[64px] resize-none py-2.5 leading-snug"
              rows={2}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the stack to deploy…"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
            />
            <div className="flex justify-end">
              <button type="submit" disabled={deploying} className="zo-btn zo-btn-primary h-8 px-3.5 text-xs">
                {deploying ? 'Deploying…' : 'Deploy'}
              </button>
            </div>
          </form>
        </aside>

        {/* Right workbench */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-zo-surface">
          <div className="flex h-9 shrink-0 items-stretch border-b border-zo-line-2 bg-zo-bg pl-1">
            {(
              [
                ['terminal', 'terminal'],
                ['yaml', 'zerops.yml'],
                ['code', 'code'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 border-0 border-b-2 bg-transparent px-3.5 font-mono text-[11px] ${
                  tab === id
                    ? 'border-zo-text bg-zo-surface text-zo-text'
                    : 'border-transparent text-zo-dim hover:text-zo-muted'
                }`}
              >
                {id === 'terminal' ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${tab === id ? 'bg-zo-ok' : 'bg-zo-idle'}`}
                  />
                ) : null}
                {label}
              </button>
            ))}
          </div>

          {tab === 'terminal' ? (
            <pre
              ref={termRef}
              className="m-0 min-h-0 flex-1 overflow-y-auto bg-[#08090b] px-4 py-3.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-zo-muted"
            >
              {logs}
            </pre>
          ) : null}

          {tab === 'yaml' ? (
            <pre className="m-0 min-h-0 flex-1 overflow-y-auto bg-[#08090b] px-4 py-3.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-zo-muted">
              {yaml}
            </pre>
          ) : null}

          {tab === 'code' ? (
            <div className="flex min-h-0 flex-1">
              <aside className="w-[180px] shrink-0 overflow-y-auto border-r border-zo-line-2 bg-zo-bg">
                <div className="px-3 pt-2.5 pb-1.5 font-mono text-[10px] tracking-wider text-zo-dim uppercase">
                  files
                </div>
                <ul className="m-0 list-none p-0 pb-3">
                  {fileEntries.length === 0 ? (
                    <li className="px-3 py-1.5 font-mono text-[11px] text-zo-dim">no files yet</li>
                  ) : (
                    fileEntries.map(([name]) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => setActiveFile(name)}
                          className={`w-full truncate border-0 bg-transparent px-3 py-1.5 text-left font-mono text-[11px] ${
                            activeFile === name
                              ? 'bg-zo-surface-2 text-zo-text'
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
              <div className="flex min-w-0 flex-1 flex-col bg-[#08090b]">
                <div className="border-b border-zo-line-2 px-3 py-2 font-mono text-[11px] text-zo-dim">
                  {activeFile || '—'}
                </div>
                <pre className="m-0 min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-zo-muted">
                  {activeFile && codeFiles[activeFile]
                    ? codeFiles[activeFile]
                    : 'select a file'}
                </pre>
              </div>
            </div>
          ) : null}

          <div className="flex min-h-11 shrink-0 items-center gap-2 overflow-x-auto border-t border-zo-line-2 bg-zo-bg px-2.5">
            <span className="shrink-0 font-mono text-[10px] tracking-wider text-zo-dim uppercase">
              topology
            </span>
            <div className="flex min-w-max items-center gap-1">
              {NODES.map((n, i) => {
                const st = nodeStatus[n.id] || 'idle';
                return (
                  <div key={n.id} className="flex items-center gap-1">
                    {i > 0 ? (
                      <span className="animate-packet px-0.5 text-[11px] text-zo-dim opacity-55">
                        {i >= 3 ? '⇄' : '→'}
                      </span>
                    ) : null}
                    <div
                      className={`flex items-center gap-1.5 rounded-sm px-2 py-1 ${
                        n.db ? 'border-l border-zo-line' : ''
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          st === 'healthy'
                            ? 'bg-zo-ok'
                            : st === 'failed'
                              ? 'bg-zo-fail'
                              : st === 'building' || st === 'deploying'
                                ? `bg-zo-run animate-pulse-dot`
                                : 'bg-zo-idle'
                        }`}
                      />
                      <span className="font-mono text-[11px] text-zo-text whitespace-nowrap">
                        {n.id}
                      </span>
                      <span className="font-mono text-[10px] text-zo-dim whitespace-nowrap">
                        {nodeHost[n.id]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
