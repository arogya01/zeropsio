import { Link } from 'react-router-dom';

const LIVE = 'https://studio-2cbd-3000.prg1.zerops.app';

export function Landing() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-12 items-center justify-between gap-4 border-b border-zo-line-2 px-5">
        <Link to="/" className="flex items-center gap-2.5 text-[13px] font-semibold no-underline">
          <span className="zo-mark">Z</span>
          ZeroOps
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="px-2 text-[13px] text-zo-muted no-underline hover:text-zo-text">
            Log in
          </Link>
          <Link to="/login" className="zo-btn zo-btn-primary">
            Open Studio
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[880px] flex-1 px-5 py-12 pb-16">
        <h1 className="m-0 mb-3 text-[clamp(1.5rem,3vw,1.85rem)] font-semibold tracking-tight">
          Prompt → multi-service stack on Zerops
        </h1>
        <p className="mb-7 max-w-[52ch] text-[15px] leading-relaxed text-zo-muted">
          ZeroOps synthesizes polyglot services and <code>zerops.yml</code>, then provisions with{' '}
          <code>zcli</code> using <strong className="font-medium text-zo-text">your</strong> Zerops
          PAT. Build logs stream live. Health is audited. You get a real URL.
        </p>

        <div className="mb-10 flex flex-wrap gap-2.5">
          <Link to="/login" className="zo-btn zo-btn-primary">
            Enter Studio
          </Link>
          <a className="zo-btn" href={LIVE} target="_blank" rel="noopener noreferrer">
            Open live host
          </a>
        </div>

        <div className="zo-panel">
          <div className="zo-panel-h">
            <span>this deployment</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-zo-dim">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-zo-ok" />
              ACTIVE
            </span>
          </div>
          <div className="zo-panel-b">
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {[
                ['project', 'zeroops-studio · Rqpl1t8sSfWadFknP4nOig'],
                ['service', 'studio · nodejs@22 · port 3000'],
                ['public url', null],
                ['mechanism', 'zcli project project-import · zcli push'],
                ['ui', 'React + Vite + Tailwind · Express API'],
              ].map(([k, v]) => (
                <li
                  key={k as string}
                  className="grid grid-cols-[120px_1fr] gap-3 border-b border-zo-line-2 py-1.5 text-[13px] last:border-0"
                >
                  <span className="pt-0.5 font-mono text-[11px] text-zo-dim">{k}</span>
                  {v === null ? (
                    <a
                      href={LIVE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-xs text-zo-ok"
                    >
                      {LIVE}
                    </a>
                  ) : (
                    <span className="font-mono text-[13px]">{v}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="zo-panel">
            <div className="zo-panel-h">template topology</div>
            <div className="zo-panel-b">
              <pre className="m-0 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zo-muted">
                {`webapp        nodejs
apigateway    go
aiworker      python
dbpostgres    postgresql@16
cachevalkey   valkey@7.2

addressed by hostname on the private network`}
              </pre>
            </div>
          </div>
          <div className="zo-panel">
            <div className="zo-panel-h">import shape</div>
            <div className="zo-panel-b">
              <pre className="m-0 overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre text-zo-muted">
                {`project:
  name: <generated>
services:
  - hostname: webapp
    type: nodejs@22
  - hostname: apigateway
    type: go@1.22
  - hostname: aiworker
    type: python@3.12
  - hostname: dbpostgres
    type: postgresql@16
  - hostname: cachevalkey
    type: valkey@7.2`}
              </pre>
            </div>
          </div>
        </div>

        <ol className="mt-7 list-none border-t border-zo-line-2 p-0">
          {[
            ['01', 'Synthesize', 'template or prompt → multi-service code + import YAML'],
            ['02', 'Provision', 'zcli project project-import with session PAT'],
            ['03', 'Audit', 'HTTP probe + reachable service checks'],
            ['04', 'Open', 'live *.zerops.app URL when the platform returns one'],
          ].map(([n, title, body]) => (
            <li
              key={n}
              className="grid grid-cols-[28px_1fr] gap-3 border-b border-zo-line-2 py-3.5 text-[13px] text-zo-muted"
            >
              <span className="pt-0.5 font-mono text-[11px] text-zo-dim">{n}</span>
              <span>
                <b className="font-medium text-zo-text">{title}</b> — {body}
              </span>
            </li>
          ))}
        </ol>
      </main>

      <footer className="mx-auto flex w-full max-w-[880px] flex-wrap justify-between gap-3 border-t border-zo-line-2 px-5 py-4 pb-8 font-mono text-[11px] text-zo-dim">
        <span>ZeroOps · Zerops Challenge</span>
        <span className="space-x-2">
          <Link to="/studio" className="text-zo-muted no-underline hover:text-zo-text">
            Studio
          </Link>
          <span>·</span>
          <Link to="/login" className="text-zo-muted no-underline hover:text-zo-text">
            Login
          </Link>
        </span>
      </footer>
    </div>
  );
}
