import { Link } from 'react-router-dom';

const LIVE = 'https://studio-2cbd-3000.prg1.zerops.app';

export function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-zo-bg font-sans text-zo-text">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-black/[0.08] bg-zo-surface/80 px-7 backdrop-blur-[12px]">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[16px] font-medium leading-6 text-zo-text no-underline"
        >
          <span className="zo-mark">Z</span>
          ZeroOps
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="/demo"
            className="px-3 text-[16px] font-medium leading-6 text-zo-muted no-underline transition-colors hover:text-zo-text"
          >
            Demo
          </a>
          <Link
            to="/login"
            className="px-3 text-[16px] font-medium leading-6 text-zo-muted no-underline transition-colors hover:text-zo-text"
          >
            Log in
          </Link>
          <Link to="/login" className="zo-btn zo-btn-primary ml-1">
            Open Studio
          </Link>
        </div>
      </header>

      {/* Marketing hero — dark navy band */}
      <section className="bg-hero-dark-navy px-7 py-16 text-zo-ink sm:py-20">
        <div className="mx-auto w-full max-w-[880px]">
          <h1 className="m-0 mb-5 max-w-[18ch] text-[clamp(2.5rem,6vw,3.375rem)] font-bold leading-[1.05] tracking-[-1.875px] text-white">
            Prompt → multi-service stack on Zerops
          </h1>
          <p className="mb-8 max-w-[52ch] text-[20px] leading-[30px] font-normal text-white/80">
            ZeroOps synthesizes polyglot services and <code className="font-mono text-[0.9em] text-white/90">zerops.yml</code>, then provisions with{' '}
            <code className="font-mono text-[0.9em] text-white/90">zcli</code> using{' '}
            <strong className="font-semibold text-white">your</strong> Zerops PAT. Build logs stream
            live. Health is audited. You get a real URL.
          </p>

          <div className="flex flex-wrap gap-3">
            <a href="/demo" className="zo-btn zo-btn-primary h-10 rounded-card px-5 text-[14px] font-medium">
              Try demo
            </a>
            <Link
              to="/login"
              className="zo-btn h-10 rounded-card border-white/20 bg-transparent px-5 text-[14px] font-medium text-white hover:border-white/40 hover:bg-white/10"
            >
              Enter Studio
            </Link>
            <a
              className="zo-btn h-10 rounded-card border-white/20 bg-transparent px-5 text-[14px] font-medium text-white hover:border-white/40 hover:bg-white/10"
              href={LIVE}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open live host
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[880px] flex-1 px-7 py-12 pb-16">
        <div className="zo-panel">
          <div className="zo-panel-h">
            <span className="text-[14px] font-medium leading-5 text-zo-muted">this deployment</span>
            <span className="flex items-center gap-1.5 font-mono text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-zo-ok" />
              ACTIVE
            </span>
          </div>
          <div className="zo-panel-b">
            <ul className="m-0 grid list-none gap-0 p-0">
              {[
                ['project', 'zeroops-studio · Rqpl1t8sSfWadFknP4nOig'],
                ['service', 'studio · nodejs@22 · port 3000'],
                ['public url', null],
                ['mechanism', 'zcli project project-import · zcli push'],
                ['ui', 'React + Vite + Tailwind · Express API'],
              ].map(([k, v]) => (
                <li
                  key={k as string}
                  className="grid grid-cols-[120px_1fr] gap-3 border-b border-black/[0.08] py-2.5 text-[16px] leading-6 last:border-0"
                >
                  <span className="pt-0.5 font-mono text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim">
                    {k}
                  </span>
                  {v === null ? (
                    <a
                      href={LIVE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-[13px] text-zo-ok no-underline hover:underline"
                    >
                      {LIVE}
                    </a>
                  ) : (
                    <span className="font-mono text-[14px] leading-5 text-zo-text">{v}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="zo-panel">
            <div className="zo-panel-h">
              <span className="text-[14px] font-medium leading-5 text-zo-muted">template topology</span>
            </div>
            <div className="zo-panel-b">
              <pre className="m-0 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-zo-muted">
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
            <div className="zo-panel-h">
              <span className="text-[14px] font-medium leading-5 text-zo-muted">import shape</span>
            </div>
            <div className="zo-panel-b">
              <pre className="m-0 overflow-x-auto font-mono text-[12px] leading-relaxed whitespace-pre text-zo-muted">
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

        <ol className="mt-10 list-none space-y-3 p-0">
          {[
            ['01', 'Synthesize', 'template or prompt → multi-service code + import YAML'],
            ['02', 'Provision', 'zcli project project-import with session PAT'],
            ['03', 'Audit', 'HTTP probe + reachable service checks'],
            ['04', 'Open', 'live *.zerops.app URL when the platform returns one'],
          ].map(([n, title, body]) => (
            <li
              key={n}
              className="grid grid-cols-[40px_1fr] gap-4 rounded-card border border-black/[0.08] bg-zo-surface px-4 py-4 text-[16px] leading-6 text-zo-muted"
            >
              <span className="pt-0.5 font-mono text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim">
                {n}
              </span>
              <span>
                <b className="font-semibold text-zo-text">{title}</b> — {body}
              </span>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-black/[0.08] bg-zo-surface">
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center justify-between gap-3 px-7 py-5 pb-8 text-[12px] font-medium leading-4 tracking-[0.125px] text-zo-dim">
          <span className="font-mono">ZeroOps · Zerops Challenge</span>
          <span className="space-x-3 font-sans">
            <Link
              to="/studio"
              className="text-[14px] font-medium leading-5 text-zo-muted no-underline transition-colors hover:text-zo-text"
            >
              Studio
            </Link>
            <span className="text-zo-dim">·</span>
            <Link
              to="/login"
              className="text-[14px] font-medium leading-5 text-zo-muted no-underline transition-colors hover:text-zo-text"
            >
              Login
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
