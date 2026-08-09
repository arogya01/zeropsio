let meta = #{
    name: "notion-design-system",
    description: "Apply Notion Marketing 2024 design system across the ZeroOps web app",
    when_to_use: "Restyle product UI (React + shared design CSS) to Notion Marketing tokens",
    phases: [
        #{ title: "Foundation", detail: "Rewrite shared tokens and component primitives" },
        #{ title: "Pages", detail: "Restyle Landing, Login, Studio, and public product HTML" },
        #{ title: "Verify", detail: "Check token coverage and visual consistency" },
    ],
};

let apply_schema = #{
    "type": "object",
    "required": ["files_changed", "summary", "ok"],
    "properties": #{
        "files_changed": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 20 },
        "summary": #{ "type": "string" },
        "ok": #{ "type": "boolean" },
        "notes": #{ "type": "string" },
    },
};

let verify_schema = #{
    "type": "object",
    "required": ["pass", "issues", "summary"],
    "properties": #{
        "pass": #{ "type": "boolean" },
        "issues": #{
            "type": "array",
            "maxItems": 12,
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
        "summary": #{ "type": "string" },
    },
};

// Optional scope: "all" | "react" | "public"
let scope = if args == () { "all" } else if args.scope == () { "all" } else { args.scope };
if scope != "all" && scope != "react" && scope != "public" {
    pause("verification", "Pass args.scope as one of: all, react, public");
}

// ── Design system contract (embedded so cold agents need no parent context) ──
let ds = "";
ds += "NOTION MARKETING 2024 design system (version alpha).\n";
ds += "Font: Inter (stand-in for NotionInter) + system sans fallback. Weights 400/500/600/700.\n";
ds += "Mono for code/logs only: ui-monospace, SF Mono, Menlo, monospace.\n\n";
ds += "COLORS (use these exact hex values):\n";
ds += "  surface-white #ffffff | hero-dark-navy #02093a | surface-base #f6f5f4\n";
ds += "  accent-blue #097fe8 | accent-red #f64932 | brand-blue #2537b1\n";
ds += "  text-medium #615d59 | text-muted #a39e98 | text-primary #000000\n";
ds += "  border-subtle: rgba(0,0,0,0.08) hairlines (border token is black at 8% opacity)\n";
ds += "  Keep semantic state for deploy: ok #3ecf8e | run/warn #d4a017 | fail maps to accent-red #f64932 | info/accent-blue #097fe8\n\n";
ds += "TYPOGRAPHY roles:\n";
ds += "  display-hero 64/64 w700 ls -1.875px | display-large 54/56 w700 ls -1.875px\n";
ds += "  heading-xl 48/72 w400 | heading-l 40/60 w400 | heading-m 22/28 w700 ls -0.25px\n";
ds += "  heading-s 20/28 w600 ls -0.125px | body-regular 16/24 w400 | body-large 20/30 w400\n";
ds += "  label-medium 14/20 w500 | label-small 12/16 w500 ls 0.125px | nav-link 16/24 w500\n\n";
ds += "RADIUS: none 0 | xs 2 | sm 4 | md 5 | base 6 | card 8 | lg 12 | xl 16 | 2xl 20 | pill 9999\n";
ds += "  Cards/panels use radius-card (8px). Buttons primary may use radius-card or radius-pill for CTA.\n";
ds += "  Prefer soft rounded geometry; do not mix sharp 2px product chrome with new cards.\n\n";
ds += "SPACING scale (px): 2,3,4,5,6,8,10,12,14,15,16,20,24,28,32,40,48,60,64,80. Gutter 28px.\n\n";
ds += "VISUAL LANGUAGE:\n";
ds += "  - Light product body on surface-base (#f6f5f4); white cards/panels.\n";
ds += "  - Hero/marketing bands may use hero-dark-navy with white text.\n";
ds += "  - Brand blue (#2537b1) for primary CTA fill + key links only (one primary action per view).\n";
ds += "  - Text hierarchy: primary black, medium #615d59, muted #a39e98.\n";
ds += "  - Borders: subtle black @ 8% opacity, not heavy dark lines.\n";
ds += "  - Flat elevation (no invented multi-layer shadows unless already present).\n";
ds += "  - Backdrop blur 12px ok for sticky headers/dropdowns if used.\n";
ds += "  - Preserve all behavior, routes, IDs, API calls, and copy meaning. Visual only + token renames if needed.\n";

let root = "zeroops-engine";

// ═══════════════════════════════════════════════════════════════════════════
phase("Foundation");
// ═══════════════════════════════════════════════════════════════════════════

let foundation_prompt = "";
foundation_prompt += "You are implementing a shared design-system foundation for ZeroOps.\n";
foundation_prompt += "Workspace root contains zeroops-engine/. Use read_file, search_replace/write, list_dir, grep.\n";
foundation_prompt += "DO NOT change backend TypeScript, tests, or package.json deps unless a font import path requires HTML only.\n\n";
foundation_prompt += ds;
foundation_prompt += "\n## Your job (Foundation only)\n";
foundation_prompt += "1. Rewrite " + root + "/web/src/index.css:\n";
foundation_prompt += "   - Keep Tailwind v4 @import and @theme structure.\n";
foundation_prompt += "   - Map existing zo-* token NAMES to Notion values so React classes keep working:\n";
foundation_prompt += "     zo-bg → surface-base #f6f5f4\n";
foundation_prompt += "     zo-surface → #ffffff\n";
foundation_prompt += "     zo-surface-2 → slightly warm off-white or #f6f5f4\n";
foundation_prompt += "     zo-line / zo-line-2 → rgba black borders (use hex approximations if needed, e.g. #e8e6e3 / #ebe9e6)\n";
foundation_prompt += "     zo-text → #000000 | zo-muted → #615d59 | zo-dim → #a39e98\n";
foundation_prompt += "     zo-mark → brand-blue #2537b1 | zo-ink → #ffffff (mark on brand)\n";
foundation_prompt += "     zo-idle → text-muted | zo-run keep amber | zo-ok keep green | zo-fail → #f64932 | zo-info → #097fe8\n";
foundation_prompt += "   - Also add explicit Notion tokens in @theme where useful: brand-blue, surface-base, hero-navy, etc.\n";
foundation_prompt += "   - font-sans → Inter stack; font-mono stays mono for code.\n";
foundation_prompt += "   - Restyle .zo-btn, .zo-btn-primary, .zo-input, .zo-label, .zo-panel*, .zo-mark, .zo-ghost-btn:\n";
foundation_prompt += "     rounded-card 8px, primary CTA brand-blue fill + white text, pill ok for primary if it fits,\n";
foundation_prompt += "     labels not forced uppercase mono — use label-medium Inter style (14/20 w500),\n";
foundation_prompt += "     inputs white surface, subtle border, focus outline brand or solid dark outline 2-3px if needed.\n";
foundation_prompt += "   - body: bg surface-base, text primary, body-regular 16px.\n\n";
foundation_prompt += "2. Rewrite " + root + "/public/design/system.css with the SAME semantic CSS variables and component classes\n";
foundation_prompt += "   (--bg, --surface, --text, --mark, .zo-btn, etc.) so public HTML pages match the React app.\n";
foundation_prompt += "   Prefer Inter via CSS variable; pages load fonts separately.\n\n";
foundation_prompt += "3. Update " + root + "/web/index.html font links: Inter (400,500,600,700) instead of IBM Plex Sans/Mono.\n";
foundation_prompt += "   Keep a mono font optional (IBM Plex Mono OR system mono only is fine).\n\n";
foundation_prompt += "4. Lightly update " + root + "/public/design/tokens.css fallbacks to the Notion palette if it is still referenced.\n\n";
foundation_prompt += "5. Do NOT rewrite page TSX/HTML in this phase. Do NOT touch voltage.css demo theme (demo exception stays).\n\n";
foundation_prompt += "After edits, re-read the files you changed and confirm tokens match the hex list.\n";
foundation_prompt += "Return JSON: files_changed, summary, ok (true if foundation is coherent), notes.\n";

let foundation = agent(foundation_prompt, #{
    label: "foundation-tokens",
    capability_mode: "read-write",
    output_schema: apply_schema,
});

if foundation == () || !foundation.success || foundation.output.ok != true {
    let why = "Foundation agent failed or reported ok=false";
    if foundation != () && foundation.output != () && foundation.output.summary != () {
        why = foundation.output.summary;
    }
    let p = write_scratch_file("report.md", "# Notion design system — failed at Foundation\n\n" + why);
    complete(#{ path: p, summary: why, pass: false });
}

log("Foundation complete: " + foundation.output.summary);

// ═══════════════════════════════════════════════════════════════════════════
phase("Pages");
// ═══════════════════════════════════════════════════════════════════════════

let jobs = [];

if scope == "all" || scope == "react" {
    // Landing
    let p_landing = "";
    p_landing += "Restyle ONLY " + root + "/web/src/pages/Landing.tsx for Notion Marketing 2024.\n";
    p_landing += "Use read_file then search_replace. Keep all routes/links/copy content meaning.\n\n";
    p_landing += ds;
    p_landing += "\nFoundation tokens already map zo-* to Notion colors — prefer zo-* classes + Tailwind utilities.\n";
    p_landing += "Landing should feel marketing-ready:\n";
    p_landing += "- Optional hero band: dark navy (#02093a) with white text for headline + subhead, OR clean light hero with large display type.\n";
    p_landing += "- Prefer display/heading scale for h1 (larger, tighter tracking).\n";
    p_landing += "- Primary CTA uses zo-btn-primary (brand blue). Secondary buttons quieter.\n";
    p_landing += "- Cards/panels: white on surface-base, radius 8 (rounded-lg if token maps), subtle borders.\n";
    p_landing += "- Nav: nav-link weight (medium), clean header maybe white/blur on base.\n";
    p_landing += "- Do not leave dark-theme-only hard-coded colors (e.g. #0b0c0e) in className strings.\n";
    p_landing += "Return JSON files_changed, summary, ok, notes.\n";
    jobs.push(#{
        prompt: p_landing,
        label: "page:landing",
        capability_mode: "read-write",
        output_schema: apply_schema,
    });

    // Login
    let p_login = "";
    p_login += "Restyle ONLY " + root + "/web/src/pages/Login.tsx for Notion Marketing 2024.\n";
    p_login += "Use read_file then search_replace. Keep auth logic, form fields, API calls, error handling.\n\n";
    p_login += ds;
    p_login += "\nFoundation tokens map zo-* already. Goals:\n";
    p_login += "- Centered white card on surface-base, radius-card 8px, subtle border.\n";
    p_login += "- Clean labels (not harsh mono uppercase if possible — zo-label was restyled).\n";
    p_login += "- Primary submit brand blue; muted secondary text.\n";
    p_login += "- Comfortable spacing (spacing-12/13 scale).\n";
    p_login += "Return JSON files_changed, summary, ok, notes.\n";
    jobs.push(#{
        prompt: p_login,
        label: "page:login",
        capability_mode: "read-write",
        output_schema: apply_schema,
    });

    // Studio (large file — layout chrome only)
    let p_studio = "";
    p_studio += "Restyle " + root + "/web/src/pages/Studio.tsx for Notion Marketing 2024 WITHOUT breaking behavior.\n";
    p_studio += "Studio is ~640 lines — use read_file in chunks and targeted search_replace.\n";
    p_studio += "Keep ALL state, API calls, websocket/log streaming, deploy flow, IDs, and handlers intact.\n\n";
    p_studio += ds;
    p_studio += "\nGoals:\n";
    p_studio += "- Product workbench on light surface-base; panels white with 8px radius.\n";
    p_studio += "- Header/nav clean; primary actions brand-blue.\n";
    p_studio += "- Status colors stay semantic (ok/run/fail).\n";
    p_studio += "- Replace hard-coded dark colors / harsh mono chrome only where purely presentational.\n";
    p_studio += "- Logs/code can stay mono; UI labels use Inter-like classes.\n";
    p_studio += "- Prefer zo-* utilities; do not invent a second design system.\n";
    p_studio += "Return JSON files_changed, summary, ok, notes.\n";
    jobs.push(#{
        prompt: p_studio,
        label: "page:studio",
        capability_mode: "read-write",
        output_schema: apply_schema,
    });
}

if scope == "all" || scope == "public" {
    let p_public = "";
    p_public += "Restyle public product HTML to match Notion tokens already in " + root + "/public/design/system.css.\n";
    p_public += "Files (only these product pages, not preview variants, not demo voltage exception):\n";
    p_public += "  - " + root + "/public/landing.html\n";
    p_public += "  - " + root + "/public/login.html\n";
    p_public += "  - " + root + "/public/studio.html\n";
    p_public += "Read each file. Update font <link> tags to Inter. Adjust inline classes/structure for light Notion marketing feel\n";
    p_public += "if they hardcode dark theme. Prefer CSS variables from system.css (.zo-*).\n";
    p_public += "Do NOT edit demo.html voltage theme or public/preview/** or variant*.html.\n";
    p_public += "Do NOT break script tags or element IDs that JS binds to.\n\n";
    p_public += ds;
    p_public += "\nReturn JSON files_changed, summary, ok, notes.\n";
    jobs.push(#{
        prompt: p_public,
        label: "page:public-html",
        capability_mode: "read-write",
        output_schema: apply_schema,
    });
}

if jobs.len() == 0 {
    pause("verification", "No page jobs selected — check args.scope");
}

let page_results = parallel(jobs);

let page_ok = true;
let page_summaries = [];
let i = 0;
for r in page_results {
    if r == () || !r.success {
        page_ok = false;
        page_summaries.push("job " + i.to_string() + " failed");
    } else if r.output.ok != true {
        page_ok = false;
        page_summaries.push(r.output.summary);
    } else {
        page_summaries.push(r.output.summary);
    }
    i += 1;
}

log("Pages phase done; ok=" + page_ok.to_string());

// ═══════════════════════════════════════════════════════════════════════════
phase("Verify");
// ═══════════════════════════════════════════════════════════════════════════

let verify_prompt = "";
verify_prompt += "Verify the Notion Marketing 2024 design system was applied correctly in this repo.\n";
verify_prompt += "Use ONLY read-only tools: read_file, grep, list_dir. Do not edit files.\n\n";
verify_prompt += ds;
verify_prompt += "\n## Checklist (inspect real files)\n";
verify_prompt += "1. " + root + "/web/src/index.css — Notion hex values present; body light; primary brand #2537b1; Inter stack.\n";
verify_prompt += "2. " + root + "/public/design/system.css — same semantic mapping for --bg/--mark/--text etc.\n";
verify_prompt += "3. " + root + "/web/index.html — Inter font loaded (not only IBM Plex Sans as primary UI).\n";
verify_prompt += "4. Landing/Login/Studio TSX — no obvious leftover pure-dark product chrome that fights light tokens\n";
verify_prompt += "   (hard-coded #0b0c0e backgrounds etc.). Behavior-only code is fine.\n";
verify_prompt += "5. voltage.css / demo exception may remain dark-green — do not flag as failure.\n";
verify_prompt += "6. Primary CTA color should be brand blue, not the old light-gray mark on dark bg.\n\n";
verify_prompt += "Set pass=true only if foundation + primary product surfaces are coherently Notion-light.\n";
verify_prompt += "List concrete issues with file paths. Severity high if brand tokens missing or dark/light clash broken.\n";
verify_prompt += "Return JSON: pass, issues, summary.\n";

let verification = agent(verify_prompt, #{
    label: "verify-design",
    capability_mode: "read-only",
    output_schema: verify_schema,
});

let pass = false;
let issues = [];
let vsummary = "Verification did not complete";
if verification != () && verification.success && verification.output != () {
    pass = verification.output.pass == true && page_ok;
    if verification.output.issues != () {
        issues = verification.output.issues;
    }
    vsummary = verification.output.summary;
    if !page_ok {
        pass = false;
        vsummary = "Page agents reported failure. " + vsummary;
    }
}

// Optional fix pass if verification failed with high issues
if !pass && issues.len() > 0 {
    log("Verification found issues — running one fix agent");
    let fix_prompt = "";
    fix_prompt += "Fix high/medium design-system gaps for Notion Marketing 2024. Read files first, then edit.\n";
    fix_prompt += "Do not rewrite architecture. Smallest diffs.\n\n";
    fix_prompt += ds;
    fix_prompt += "\nIssues to fix (from verifier):\n";
    fix_prompt += json_encode(issues);
    fix_prompt += "\n\nAlso ensure " + root + "/web/src/index.css and " + root + "/public/design/system.css stay aligned.\n";
    fix_prompt += "Return JSON files_changed, summary, ok, notes.\n";
    let fix = agent(fix_prompt, #{
        label: "fix-gaps",
        capability_mode: "read-write",
        output_schema: apply_schema,
    });
    if fix != () && fix.success && fix.output.ok == true {
        // Re-verify once
        let verification2 = agent(verify_prompt, #{
            label: "verify-design-2",
            capability_mode: "read-only",
            output_schema: verify_schema,
        });
        if verification2 != () && verification2.success && verification2.output != () {
            pass = verification2.output.pass == true;
            if verification2.output.issues != () {
                issues = verification2.output.issues;
            }
            vsummary = verification2.output.summary;
        }
    }
}

let report = "";
report += "# Notion Marketing 2024 — design system run\n\n";
report += "**Scope:** " + scope + "\n\n";
report += "**Pass:** " + pass.to_string() + "\n\n";
report += "## Foundation\n\n" + foundation.output.summary + "\n\n";
report += "## Pages\n\n";
for s in page_summaries {
    report += "- " + s + "\n";
}
report += "\n## Verification\n\n" + vsummary + "\n\n";
if issues.len() > 0 {
    report += "### Remaining issues\n\n";
    report += json_encode(issues);
    report += "\n";
}
report += "\n## Token reference applied\n\n";
report += "- Hero navy `#02093a`, body `#f6f5f4`, white surfaces, brand blue `#2537b1`\n";
report += "- Inter type stack; radius-card 8px; CTAs brand blue\n";

let path = write_scratch_file("report.md", report);
complete(#{
    path: path,
    summary: vsummary,
    pass: pass,
    scope: scope,
    issues: issues,
});
