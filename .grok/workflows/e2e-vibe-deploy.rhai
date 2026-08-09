let meta = #{
    name: "e2e-vibe-deploy",
    description: "UX polish for vibe Build/Ship, then full E2E Build→preview→Ship and capture live URL",
    when_to_use: "End-to-end test a normal app and get the deployed Zerops URL",
    phases: [
        #{ title: "UX", detail: "Preview basename, loading states, clearer errors" },
        #{ title: "Server", detail: "Ensure local server has OpenAI + DEMO_PAT" },
        #{ title: "E2E", detail: "Build + Ship a normal app via scripts/e2e-vibe-ship.mjs" },
        #{ title: "Verify", detail: "Confirm live URL HTTP 200 and write report" },
    ],
};

let apply_schema = #{
    "type": "object",
    "required": ["ok", "summary"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "files_changed": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 30 },
        "live_url": #{ "type": "string" },
        "workspace_id": #{ "type": "string" },
        "error": #{ "type": "string" },
    },
};

let engine = "zeroops-engine";
let prompt = if args == () || args.prompt == () {
    "A clean personal habit tracker with daily checkboxes, streaks, and a calm minimal UI"
} else {
    args.prompt
};

// ── UX polish (idempotent) ──────────────────────────────────────────────────
phase("UX");
log("Phase UX: ensure preview basename + demo UX polish");

let p_ux = "";
p_ux += "You are implementing critical UX fixes in " + engine + " for the vibe hybrid Build/Ship flow.\n";
p_ux += "Repo root is the workspace. Work inside " + engine + ".\n\n";
p_ux += "REQUIREMENTS (do all, use tools, keep changes minimal):\n";
p_ux += "1. src/vibe-scaffold/src/App.tsx MUST use BrowserRouter with basename from import.meta.env.BASE_URL (trailing slash stripped). This fixes blank iframe previews.\n";
p_ux += "2. src/server/llm/vibe-scaffold.js MUST call ensureRouterBasename(workspacePath) after applying LLM writes, and export it. ensureRouterBasename should rewrite App.tsx to a known-good basename shell if missing.\n";
p_ux += "3. public/demo.js + demo.html + demo.css: preview loading overlay, Open preview link, clean iframe path (no ?query), clearer openai/pat quota messages. Do not break Ship/Build APIs.\n";
p_ux += "4. If scripts/e2e-vibe-ship.mjs is missing, create it to POST /api/vibe/build, poll ready, smoke preview, POST /api/vibe/ship, poll liveUrl, curl the live URL, write /tmp/zeroops-e2e-result.json.\n";
p_ux += "5. Run a quick unit check if tests/vibe-build.test.ts exists: npm run test:unit -- tests/vibe-build.test.ts\n";
p_ux += "Return ok=true only if the basename fix and demo loading UX are present in the files (read them back).\n";

let r_ux = agent(p_ux, #{
    label: "ux-polish",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r_ux == () || !r_ux.success || r_ux.output.ok != true) {
    log("UX agent failed or incomplete — continuing if core files already fixed");
}

// ── Server readiness ────────────────────────────────────────────────────────
phase("Server");
log("Phase Server: restart/check local engine with .env keys");

let p_srv = "";
p_srv += "Ensure ZeroOps engine on localhost:3000 is running with vibe routes and env keys.\n";
p_srv += "Working directory: " + engine + "\n";
p_srv += "Steps:\n";
p_srv += "1. Confirm " + engine + "/.env has OPENAI_API_KEY and DEMO_PAT (names only — never print secret values).\n";
p_srv += "2. Confirm dotenv is loaded at top of src/server/index.js from ../../.env.\n";
p_srv += "3. curl http://127.0.0.1:3000/api/demo/status — need hasDemoOpenAI true AND hasDemoPat true AND vibeRoutes true.\n";
p_srv += "4. If not, kill listener on port 3000 and start: node src/server/index.js (background, log to /tmp/zeroops-server.log).\n";
p_srv += "5. Re-check status until both keys true.\n";
p_srv += "Return ok=true only when status shows both keys. summary must include the status JSON fields (booleans only).\n";

let r_srv = agent(p_srv, #{
    label: "server-ready",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r_srv == () || !r_srv.success || r_srv.output.ok != true) {
    pause("infra", "Server not ready with OPENAI + DEMO_PAT — fix .env / restart then resume");
}

// ── E2E build + ship ────────────────────────────────────────────────────────
phase("E2E");
log("Phase E2E: full Build → Ship for a normal app");

let p_e2e = "";
p_e2e += "Run a real end-to-end vibe deploy from " + engine + ".\n";
p_e2e += "Prompt to use (exact):\n";
p_e2e += prompt + "\n\n";
p_e2e += "Steps:\n";
p_e2e += "1. cd " + engine + "\n";
p_e2e += "2. Run: node scripts/e2e-vibe-ship.mjs --prompt " + json_encode(prompt) + " --out /tmp/zeroops-e2e-result.json\n";
p_e2e += "   This can take 10–20+ minutes (npm install + vite + zcli import/push). Use a long timeout (at least 25 minutes).\n";
p_e2e += "3. If the script is missing, implement the same flow with curl/node inline.\n";
p_e2e += "4. Read /tmp/zeroops-e2e-result.json. Require ok=true and a non-empty liveUrl starting with https://\n";
p_e2e += "5. curl -sS -o /dev/null -w '%{http_code}' -L <liveUrl> and confirm 2xx/3xx.\n";
p_e2e += "6. Append a short note to " + engine + "/.zerops-deploy-notes.md under a heading '## E2E vibe app' with the liveUrl, prompt, and timestamp — do NOT invent URLs.\n";
p_e2e += "Return ok=true, live_url=<url>, workspace_id=<id>, summary with the URL.\n";
p_e2e += "If ship fails, return ok=false and the real error (no fake URL).\n";

let r_e2e = agent(p_e2e, #{
    label: "e2e-ship",
    capability_mode: "execute",
    output_schema: apply_schema,
});

// ── Verify ──────────────────────────────────────────────────────────────────
phase("Verify");
log("Phase Verify: independent check of live URL");

let live_from_e2e = "";
if (r_e2e != () && r_e2e.success && r_e2e.output.live_url != ()) {
    live_from_e2e = r_e2e.output.live_url;
}

let p_ver = "";
p_ver += "Independently verify the E2E deploy result.\n";
p_ver += "1. Read /tmp/zeroops-e2e-result.json if present.\n";
p_ver += "2. Candidate live URL from E2E agent: " + live_from_e2e + "\n";
p_ver += "3. curl -sS -L -o /tmp/zeroops-live.html -w '%{http_code}' the live URL. Require HTTP 200-399.\n";
p_ver += "4. head the HTML — should look like a real app (DOCTYPE/html/root or app content), not an error page.\n";
p_ver += "5. Return ok=true only with evidence. Set live_url to the verified URL.\n";
p_ver += "Never invent a URL.\n";

let r_ver = agent(p_ver, #{
    label: "verify-live",
    capability_mode: "execute",
    output_schema: apply_schema,
});

let final_url = "";
if (r_ver != () && r_ver.success && r_ver.output.live_url != ()) {
    final_url = r_ver.output.live_url;
} else if (live_from_e2e != "") {
    final_url = live_from_e2e;
}

let report = "";
report += "# E2E Vibe Deploy Result\n\n";
report += "**Prompt:** " + prompt + "\n\n";
if (r_ux != () && r_ux.success) { report += "## UX\n" + r_ux.output.summary + "\n\n"; }
if (r_srv != () && r_srv.success) { report += "## Server\n" + r_srv.output.summary + "\n\n"; }
if (r_e2e != () && r_e2e.success) { report += "## E2E\n" + r_e2e.output.summary + "\n\n"; }
if (r_ver != () && r_ver.success) { report += "## Verify\n" + r_ver.output.summary + "\n\n"; }
report += "## Live URL\n";
if (final_url != "") {
    report += final_url + "\n";
} else {
    report += "(none — deploy did not produce a URL)\n";
}
if (r_e2e != () && r_e2e.success && r_e2e.output.workspace_id != ()) {
    report += "\nworkspaceId: " + r_e2e.output.workspace_id + "\n";
}

let report_path = write_scratch_file("e2e-vibe-deploy-result.md", report);

let passed = r_e2e != () && r_e2e.success && r_e2e.output.ok == true && final_url != "";
if (r_ver != () && r_ver.success && r_ver.output.ok == false) {
    passed = false;
}

complete(#{
    summary: report,
    report: report_path,
    live_url: final_url,
    passed: passed,
});
