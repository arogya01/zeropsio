let meta = #{
    name: "implement-vibe-build",
    description: "Implement hybrid Lovable-style Build (local React preview) + explicit Ship to Zerops",
    when_to_use: "Wire vibe coding Build/Ship using Dyad scaffold patterns in zeroops-engine",
    phases: [
        #{ title: "Scaffold", detail: "Vendor slim React+Vite starter into src/vibe-scaffold" },
        #{ title: "Generate", detail: "LLM multi-file vibe scaffold + job store + disk apply" },
        #{ title: "Preview", detail: "Vite process manager + reverse proxy + HTTP APIs" },
        #{ title: "Ship", detail: "Static SPA packager + deploy handoff" },
        #{ title: "UI", detail: "Studio + demo Build/Ship split and preview iframe" },
        #{ title: "Verify", detail: "Tests and smoke checks" },
    ],
};

let apply_schema = #{
    "type": "object",
    "required": ["ok", "files_changed", "summary"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "files_changed": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 40 },
        "summary": #{ "type": "string" },
        "blocked": #{ "type": "string" },
    },
};

let verify_schema = #{
    "type": "object",
    "required": ["pass", "summary", "issues"],
    "properties": #{
        "pass": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "issues": #{
            "type": "array",
            "maxItems": 16,
            "items": #{
                "type": "object",
                "required": ["file", "issue", "severity"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                    "severity": #{ "type": "string", "enum": ["high", "medium", "low"] },
                },
            },
        },
    },
};

// Workspace root is the git repo (zerops-hack). Engine lives under zeroops-engine/.
let engine = "zeroops-engine";
let dyad = "/Users/arogyabichpuria/Documents/side-quests/dyad";
let spec = engine + "/docs/superpowers/specs/2026-08-09-vibe-build-hybrid-design.md";

let product = "";
product += "PRODUCT CONTRACT (must follow exactly):\n";
product += "- Hybrid: Build = generate React+Vite SPA + local preview. Ship = explicit separate deploy.\n";
product += "- Single-shot regenerate: new Build replaces workspace (no multi-turn chat).\n";
product += "- Ship target: static SPA only (vite dist + tiny Node static server). No Postgres in v1.\n";
product += "- LLM writes via <zeroops-write> and/or <dyad-write> tags; reuse write-protocol.js.\n";
product += "- Never invent live URLs. Never silent-success without real preview/deploy evidence.\n";
product += "- Without OpenAI key: Build returns clear error (503), do not fake a full app as success.\n";
product += "- Design spec path: " + spec + "\n";
product += "- Reference Dyad (read-only inspiration): " + dyad + " scaffold/ and prompts/system_prompt.ts BUILD_SYSTEM_PREFIX.\n";
product += "- Do NOT copy Electron/IPC. Do NOT add multi-turn agent loop.\n";
product += "- Prefer CommonJS for new server modules to match src/server/*.js.\n";
product += "- Keep changes inside " + engine + "/ unless a root doc is essential.\n";

// ────────────────────────────────────────────────────────────────────────────
phase("Scaffold");
log("Phase Scaffold: create slim React+Vite vibe-scaffold");

let p1 = "";
p1 += product;
p1 += "\nTASK: Create " + engine + "/src/vibe-scaffold/ — a slim React+Vite+TS SPA starter suitable for LLM editing.\n";
p1 += "Steps:\n";
p1 += "1. Read " + spec + " and skim " + dyad + "/scaffold/package.json and Index page for inspiration.\n";
p1 += "2. Create a WORKING minimal scaffold WITHOUT @dyad-sh packages and WITHOUT the dyad component tagger plugin.\n";
p1 += "Required files at minimum:\n";
p1 += "  - package.json (name zeroops-vibe-app, type module, scripts dev/build/preview, deps: react, react-dom, react-router-dom, tailwindcss v4 or v3+postcss+autoprefixer, @vitejs/plugin-react, vite, typescript, lucide-react optional)\n";
p1 += "  - vite.config.ts with react plugin, @ alias to src, server host 127.0.0.1 port 5173 base './' or '/' \n";
p1 += "  - tsconfig.json, tsconfig.app.json, index.html, src/main.tsx, src/App.tsx, src/pages/Index.tsx (blank welcome), src/index.css\n";
p1 += "  - src/components/ui/button.tsx + card.tsx minimal (or simple plain Tailwind components)\n";
p1 += "  - src/lib/utils.ts if using cn helper\n";
p1 += "3. Keep it SMALL: avoid copying all 40 radix packages.  A clean Tailwind app with 2-3 UI primitives is enough.\n";
p1 += "4. Ensure path alias @ works. Index should say Welcome so LLM has a clear file to replace.\n";
p1 += "5. Do not run long npm install in the scaffold folder if avoidable; package.json must be installable.\n";
p1 += "Use write/search_replace tools. Report files_changed.\n";

let r1 = agent(p1, #{
    label: "scaffold-pack",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r1 == () || !r1.success || r1.output.ok != true) {
    pause("verification", "Scaffold phase failed — fix vibe-scaffold then resume");
}

// ────────────────────────────────────────────────────────────────────────────
phase("Generate");
log("Phase Generate: LLM multi-file generator + workspace job store");

let p2 = "";
p2 += product;
p2 += "\nTASK: Implement vibe generation backend.\n";
p2 += "Create/modify:\n";
p2 += "  - " + engine + "/src/server/llm/vibe-scaffold.js  (new)\n";
p2 += "  - " + engine + "/src/server/vibe/job-store.js (new) — in-memory jobs map with id, status, events, workspaceId, plan, codeFiles, previewUrl, error\n";
p2 += "  - Reuse " + engine + "/src/server/llm/write-protocol.js and callOpenAI pattern from scaffold.js (export callOpenAI from scaffold or duplicate thin helper in vibe-scaffold)\n";
p2 += "\nBehavior of generateVibeApp({ prompt, apiKey, workspaceRoot }):\n";
p2 += "1. Create workspace dir under os.tmpdir()/zeroops-vibe/<randomId>/\n";
p2 += "2. Copy tree from " + engine + "/src/vibe-scaffold/ into workspace (skip node_modules)\n";
p2 += "3. System prompt: adapt Dyad BUILD rules — plan in plain prose, then multiple <zeroops-write path=\"...\"> blocks for src files. Prefer editing src/pages/Index.tsx, App.tsx, index.css, add components as needed. Do not rewrite package.json unless adding deps via <zeroops-add-dependency>. Cap ~25 files.\n";
p2 += "4. max_tokens high enough (e.g. 8000). Parse writes, path-sanitize, apply to disk.\n";
p2 += "5. If zero writes applied → throw.\n";
p2 += "6. Return { workspaceId, workspacePath, plan, codeFiles (map of relpath→content for src/ and key config), dependencies[] }\n";
p2 += "7. Export listCodeFiles(workspacePath) helper.\n";
p2 += "Also export startBuildJob({ prompt, apiKey }) that creates job status=queued and runs async pipeline stages later wired by Preview phase — for now implement generate sync helper + job-store CRUD.\n";
p2 += "Read existing scaffold.js write-protocol and demo-deploy-jobs.js for patterns.\n";
p2 += "Use tools. Report files_changed.\n";

let r2 = agent(p2, #{
    label: "vibe-generate",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r2 == () || !r2.success || r2.output.ok != true) {
    pause("verification", "Generate phase failed — fix vibe-scaffold/job-store then resume");
}

// ────────────────────────────────────────────────────────────────────────────
phase("Preview");
log("Phase Preview: vite manager, proxy, HTTP APIs");

let p3 = "";
p3 += product;
p3 += "\nTASK: Preview manager + Express APIs for Build.\n";
p3 += "Create/modify:\n";
p3 += "  - " + engine + "/src/server/vibe/preview-manager.js\n";
p3 += "  - " + engine + "/src/server/vibe/build-pipeline.js  (orchestrates: generate → npm install → start vite → update job)\n";
p3 += "  - " + engine + "/src/server/index.js  — mount routes\n";
p3 += "\npreview-manager:\n";
p3 += "- startPreview(workspaceId, workspacePath) allocates free port 5100-5199, runs npm install if needed then npx vite --host 127.0.0.1 --port PORT --strictPort\n";
p3 += "- stopPreview(workspaceId) kills process tree\n";
p3 += "- getPreview(workspaceId) → { port, status }\n";
p3 += "\nbuild-pipeline:\n";
p3 += "- createBuildJob({ prompt, apiKey }) → jobId\n";
p3 += "- stages: generate, install, preview; append events like demo-deploy-jobs\n";
p3 += "- status: queued|running|ready|failed\n";
p3 += "- on regenerate (new build), stop previous preview for that session if tracked\n";
p3 += "\nHTTP routes (public or session — match demo openness for /api/vibe/* or require auth for studio):\n";
p3 += "  POST /api/vibe/build  body { prompt } → 202 { jobId, poll }\n";
p3 += "  GET  /api/vibe/build/:jobId → job snapshot (status, plan, codeFiles, previewPath, error, events)\n";
p3 += "  GET  /api/vibe/files/:workspaceId → codeFiles map\n";
p3 += "  ALL  /api/vibe/preview/:workspaceId/* → http proxy to 127.0.0.1:port (use http/https request pipe; handle websocket upgrade optional skip for v1)\n";
p3 += "API key: same as synthesize — user openai key or demoQuota.getDemoOpenAIKey(); if missing return 503.\n";
p3 += "Wire carefully so require() paths work from index.js.\n";
p3 += "Use tools. Report files_changed.\n";

let r3 = agent(p3, #{
    label: "preview-apis",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r3 == () || !r3.success || r3.output.ok != true) {
    pause("verification", "Preview/API phase failed — fix routes then resume");
}

// ────────────────────────────────────────────────────────────────────────────
phase("Ship");
log("Phase Ship: static packager + deploy handoff");

let p4 = "";
p4 += product;
p4 += "\nTASK: Ship path for static SPA.\n";
p4 += "Create/modify:\n";
p4 += "  - " + engine + "/src/server/vibe/ship-packager.js\n";
p4 += "  - " + engine + "/src/server/vibe/ship-pipeline.js (or extend build-pipeline)\n";
p4 += "  - " + engine + "/src/server/index.js routes POST /api/vibe/ship + GET poll\n";
p4 += "  - Adapt " + engine + "/src/server/deploy-pipeline.js if needed to accept prebuilt materialize dir with hostname webapp\n";
p4 += "\nship-packager.packageForZerops(workspacePath, projectName):\n";
p4 += "1. Run npm run build in workspace (capture logs)\n";
p4 += "2. Create temp deploy root with:\n";
p4 += "   webapp/package.json dependencies express only; scripts start node server.js\n";
p4 += "   webapp/server.js serves dist with express.static, listens PORT||3000\n";
p4 += "   webapp/dist/ copied from vite build\n";
p4 += "   webapp/zerops.yml nodejs@22 build npm ci --omit=dev, deployFiles, run start, httpSupport 3000\n";
p4 += "   zerops-import.yml project name + single service hostname webapp type nodejs@22 enableSubdomainAccess true\n";
p4 += "3. Return { deployRoot, importYaml, codeFiles map for UI }\n";
p4 += "\nship-pipeline: job stages package → import → push → url → verify using existing deploy helpers where possible.\n";
p4 += "Require workspaceId from a ready build job. Require Zerops token (demo operator or user).\n";
p4 += "Never fabricate URL.\n";
p4 += "Use tools. Report files_changed.\n";

let r4 = agent(p4, #{
    label: "ship-path",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r4 == () || !r4.success || r4.output.ok != true) {
    pause("verification", "Ship phase failed — fix packager/pipeline then resume");
}

// ────────────────────────────────────────────────────────────────────────────
phase("UI");
log("Phase UI: Studio + demo Build/Ship and preview");

let p5 = "";
p5 += product;
p5 += "\nTASK: Wire frontend to vibe Build + Ship.\n";
p5 += "Modify as needed:\n";
p5 += "  - " + engine + "/web/src/pages/Studio.tsx\n";
p5 += "  - " + engine + "/web/src/api/client.ts\n";
p5 += "  - " + engine + "/public/demo.js and demo.html if demo is the judge path\n";
p5 += "  - " + engine + "/public/studio.js if still used\n";
p5 += "\nUX:\n";
p5 += "1. Primary button **Build** calls POST /api/vibe/build, polls job, shows plan + codeFiles, stages generate/install/preview.\n";
p5 += "2. When status=ready, show Preview iframe src=/api/vibe/preview/<workspaceId>/ (same origin).\n";
p5 += "3. **Ship** button enabled only when ready; calls POST /api/vibe/ship; shows deploy logs; live URL on success.\n";
p5 += "4. New Build clears old preview and disables Ship until ready again.\n";
p5 += "5. Do not auto-deploy on Build.\n";
p5 += "6. Preserve auth/PAT onboarding for Ship if required; Build only needs OpenAI key (show clear error from API).\n";
p5 += "7. Prefer React Studio as source of truth; update public demo if that is what judges use — check package.json start and index routes.\n";
p5 += "Read server static routes in index.js to know which UI is default.\n";
p5 += "Use tools. Report files_changed.\n";

let r5 = agent(p5, #{
    label: "ui-wire",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r5 == () || !r5.success || r5.output.ok != true) {
    pause("verification", "UI phase failed — fix Studio/demo wiring then resume");
}

// ────────────────────────────────────────────────────────────────────────────
phase("Verify");
log("Phase Verify: tests and adversarial check");

let p6 = "";
p6 += product;
p6 += "\nTASK: Add tests and run them.\n";
p6 += "1. Add " + engine + "/tests/vibe-build.test.ts (or .js) covering:\n";
p6 += "   - write path sandbox rejects ..\n";
p6 += "   - job-store create/get\n";
p6 += "   - ship-packager layout (mock vite build by writing fake dist) if feasible without network\n";
p6 += "   - parseWriteBlocks multi-file apply\n";
p6 += "2. Run: cd " + engine + " && npm run test:unit -- tests/vibe-build  (or full unit if needed)\n";
p6 += "3. Fix failures you introduced.\n";
p6 += "4. Grep that Studio/demo no longer treats Build as immediate deploy-only without preview path.\n";
p6 += "Report ok=true only if tests pass or only pre-existing unrelated failures remain (document).\n";

let r6 = agent(p6, #{
    label: "tests",
    capability_mode: "execute",
    output_schema: apply_schema,
});

let p7 = "";
p7 += product;
p7 += "\nTASK: Read-only verification of the implementation against the design spec.\n";
p7 += "Use grep/read_file/git diff. Check:\n";
p7 += "1. Build does not auto-call deploy/ship.\n";
p7 += "2. Ship is separate endpoint/button.\n";
p7 += "3. vibe-scaffold exists and has no @dyad-sh dependency.\n";
p7 += "4. Preview proxy or preview URL path exists.\n";
p7 += "5. LLM path allows multi-file writes (not only app.config.json).\n";
p7 += "6. No fabricated live URLs in new code.\n";
p7 += "List concrete issues with file paths. pass=true only if no high severity gaps.\n";

let r7 = agent(p7, #{
    label: "adversarial-verify",
    capability_mode: "read-only",
    output_schema: verify_schema,
});

let summary = "";
summary += "# Vibe Build Hybrid — workflow result\n\n";
if (r1 != () && r1.success) { summary += "## Scaffold\n" + r1.output.summary + "\n\n"; }
if (r2 != () && r2.success) { summary += "## Generate\n" + r2.output.summary + "\n\n"; }
if (r3 != () && r3.success) { summary += "## Preview\n" + r3.output.summary + "\n\n"; }
if (r4 != () && r4.success) { summary += "## Ship\n" + r4.output.summary + "\n\n"; }
if (r5 != () && r5.success) { summary += "## UI\n" + r5.output.summary + "\n\n"; }
if (r6 != () && r6.success) { summary += "## Tests\n" + r6.output.summary + "\n\n"; }
if (r7 != () && r7.success) {
    summary += "## Verification\npass=" + r7.output.pass + " — " + r7.output.summary + "\n";
    if (r7.output.issues != ()) {
        for iss in r7.output.issues {
            summary += "- [" + iss.severity + "] " + iss.file + ": " + iss.issue + "\n";
        }
    }
} else {
    summary += "## Verification\nVerifier did not return a usable result.\n";
}

let report_path = write_scratch_file("vibe-build-result.md", summary);

let pass = r7 != () && r7.success && r7.output.pass == true;
let tests_ok = r6 != () && r6.success && r6.output.ok == true;
complete(#{
    summary: summary,
    report: report_path,
    verified: pass,
    tests_ok: tests_ok,
});
