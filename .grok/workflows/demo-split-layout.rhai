let meta = #{
    name: "demo-split-layout",
    description: "Lovable-style left/right demo layout + Inter/Geist Mono fonts",
    when_to_use: "Restructure /demo into composer left + preview/deploy right with proper fonts",
    phases: [
        #{ title: "Typography", detail: "Inter body + Geist Mono for code/logs" },
        #{ title: "Layout", detail: "Split shell: left prompt, right preview/ship" },
        #{ title: "Wire", detail: "demo.js still works; no scroll-to-workbench needed" },
        #{ title: "Verify", detail: "Read-back structure + font tokens" },
    ],
};

let apply_schema = #{
    "type": "object",
    "required": ["ok", "summary"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "files_changed": #{ "type": "array", "items": #{ "type": "string" }, "maxItems": 20 },
        "error": #{ "type": "string" },
    },
};

let engine = "zeroops-engine";

// ── Typography ──────────────────────────────────────────────────────────────
phase("Typography");
log("Phase Typography: Inter + Geist Mono tokens");

let p_type = "";
p_type += "You are polishing typography in " + engine + " for the public demo and design system.\n";
p_type += "Use tools (read_file, search_replace, write). Work only under " + engine + "/public.\n\n";
p_type += "GOAL: Normal UI text uses Inter. All code/log/mono text uses Geist Mono.\n\n";
p_type += "REQUIREMENTS:\n";
p_type += "1. public/design/tokens.css: set --font-display and --font-body to Inter stack;\n";
p_type += "   set --font-mono to \"Geist Mono\", ui-monospace, \"SF Mono\", Menlo, Consolas, monospace.\n";
p_type += "2. public/design/system.css: --font Inter; --mono Geist Mono (same stack). Update the file header comment.\n";
p_type += "3. public/design/voltage.css: already has Inter + Geist Mono — confirm and leave correct; fix if wrong.\n";
p_type += "4. public/demo.html: keep Google Fonts Inter link; ensure Geist Mono is loaded via @fontsource CDN\n";
p_type += "   (cdn.jsdelivr.net/npm/@fontsource/geist-mono) weights 400 and 500. Do not remove Inter.\n";
p_type += "5. public/demo.css: body uses var(--font); .mono and any log/code areas use var(--mono).\n";
p_type += "   Prefer design tokens from voltage.css if already linked.\n";
p_type += "Do not touch React web/ app unless needed for tokens shared with demo.\n";
p_type += "Return ok=true only after reading files back and confirming Inter + Geist Mono are the declared stacks.\n";

let r_type = agent(p_type, #{
    label: "typography",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r_type == () || !r_type.success || r_type.output.ok != true) {
    log("Typography agent incomplete — layout agent will re-assert fonts");
}

// ── Layout: Lovable-style split ─────────────────────────────────────────────
phase("Layout");
log("Phase Layout: left composer + right preview panel");

let p_layout = "";
p_layout += "You are redesigning the ZeroOps public demo page into a Lovable/Cursor-style split workspace.\n";
p_layout += "Engine root: " + engine + ". Primary files: public/demo.html, public/demo.css, public/demo.js.\n";
p_layout += "Use tools. Preserve ALL existing element IDs that demo.js uses — do not rename IDs.\n\n";
p_layout += "PRODUCT GOAL:\n";
p_layout += "When the user types and builds, preview + deploy status appear on the RIGHT side of the screen.\n";
p_layout += "LEFT is the composer (prompt, templates, Build/Ship, plan, files, logs summary).\n";
p_layout += "No more single-column scroll where workbench is below the fold and forces scrollIntoView.\n";
p_layout += "Match the feel of Lovable / v0 / Dyad: fixed top bar, split main, tall preview iframe.\n\n";
p_layout += "HTML STRUCTURE (demo.html) — restructure main as:\n";
p_layout += "```\n";
p_layout += "<header class=\"demo-bar\">…existing…</header>\n";
p_layout += "<div class=\"demo-shell\">\n";
p_layout += "  <aside class=\"demo-composer\" id=\"demo-composer\">\n";
p_layout += "    <!-- compact title + sub (shorten hero; drop or collapse 4-step grid on desktop) -->\n";
p_layout += "    <!-- promptbox, templates, Build/Ship, quota, openai box, error -->\n";
p_layout += "    <!-- workbench LEFT content: stages, plan, files, yaml, meta pills, log (scrollable) -->\n";
p_layout += "  </aside>\n";
p_layout += "  <section class=\"demo-panel\" id=\"demo-panel\" aria-label=\"Preview and deploy\">\n";
p_layout += "    <!-- Always visible right panel (not hidden until build) -->\n";
p_layout += "    <!-- Empty state when idle: 'Your live preview will appear here' -->\n";
p_layout += "    <!-- preview-card (iframe + loading + open link) — full height -->\n";
p_layout += "    <!-- success-box with live URL after Ship -->\n";
p_layout += "    <!-- optional compact canvas-mode / stage strip at top of panel -->\n";
p_layout += "  </section>\n";
p_layout += "</div>\n";
p_layout += "```\n";
p_layout += "Keep workbench id if useful, or fold its children into composer/panel without breaking JS.\n";
p_layout += "CRITICAL: preserve these IDs (demo.js depends on them):\n";
p_layout += "demo-prompt, promptbox, template-grid, btn-build, btn-ship, quota-line, openai-box,\n";
p_layout += "demo-openai-key, btn-save-openai, error-box, workbench (can stay, always visible or unhidden early),\n";
p_layout += "canvas-mode, node-webapp, build-stages, stage-generate, stage-install, stage-preview,\n";
p_layout += "preview-card, preview-open, preview-status, preview-frame, preview-placeholder, preview-loading,\n";
p_layout += "plan-card, plan-box, files-box, files-list, files-count, yaml-box, yaml-code, btn-copy-yaml,\n";
p_layout += "template-pill, understood-pill, llm-pill, log-box, success-box, success-title, live-link, live-hosts.\n\n";
p_layout += "CSS (demo.css):\n";
p_layout += "1. body: height 100vh; overflow hidden on desktop; Inter via var(--font).\n";
p_layout += "2. .demo-shell: display grid; grid-template-columns: minmax(340px, 420px) 1fr;\n";
p_layout += "   height: calc(100vh - demo-bar height); or flex 1.\n";
p_layout += "3. .demo-composer: overflow-y auto; padding; border-right 1px solid var(--line).\n";
p_layout += "4. .demo-panel: display flex; flex-direction column; min-width 0; background surface-2;\n";
p_layout += "   preview area flex 1; iframe height fills remaining space (min-height ~60vh).\n";
p_layout += "5. preview-card always shown in panel (not only after build) — empty placeholder idle state.\n";
p_layout += "6. Mobile (<900px): stack columns; panel min-height 50vh; restore scroll.\n";
p_layout += "7. Remove or neutralize max-width hero centering that fights the split.\n";
p_layout += "8. Compact hero title in composer (smaller type, no 58px full-width).\n";
p_layout += "9. Fonts: --font Inter, --mono Geist Mono for .mono, .demo-log, code chips.\n";
p_layout += "10. Polish empty state and success URL panel for right side.\n\n";
p_layout += "JS (demo.js) minimal changes:\n";
p_layout += "1. revealWorkbench(): show workbench/panel content but DO NOT scrollIntoView — panel is already visible.\n";
p_layout += "2. On build start, ensure preview-card visible and loading state on right.\n";
p_layout += "3. Keep all API polling / Build / Ship logic unchanged.\n";
p_layout += "4. Optionally set body.dataset.stage = 'working' and a class on demo-shell when building.\n\n";
p_layout += "Do not break Build/Ship API contracts. Do not change server code.\n";
p_layout += "Return ok=true only after reading demo.html/css/js and confirming split grid + IDs present.\n";

let r_layout = agent(p_layout, #{
    label: "split-layout",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r_layout == () || !r_layout.success || r_layout.output.ok != true) {
    log("Layout agent incomplete — wire phase will repair structure");
}

// ── Wire + fix gaps ─────────────────────────────────────────────────────────
phase("Wire");
log("Phase Wire: fix any broken selectors / scroll behavior");

let p_wire = "";
p_wire += "Review and fix the demo split layout in " + engine + "/public after the layout pass.\n";
p_wire += "Read demo.html, demo.css, demo.js end-to-end.\n\n";
p_wire += "Checklist:\n";
p_wire += "1. Every getElementById in demo.js still resolves (IDs exist in HTML).\n";
p_wire += "2. revealWorkbench does not force scroll; right panel is always in view on desktop.\n";
p_wire += "3. preview-card is in the right panel and can show iframe when ready.\n";
p_wire += "4. success-box (live URL) is on the right under or over preview.\n";
p_wire += "5. Inter + Geist Mono loaded and applied (body Inter, .mono Geist Mono).\n";
p_wire += "6. Desktop: two columns. Mobile: stacks sensibly.\n";
p_wire += "7. workbench.hidden handling: if workbench starts hidden, either unhide on load for the\n";
p_wire += "   right panel parts, or keep right panel outside hidden workbench so empty state shows immediately.\n";
p_wire += "   Prefer: right panel always visible; left build stages can appear on first build.\n";
p_wire += "8. Fix any CSS that still forces single-column max-width 920/1120 for the whole page.\n";
p_wire += "9. If preview-card has hidden attribute by default, remove it so the empty state shows on the right.\n";
p_wire += "Fix any issues found. Keep changes minimal beyond the checklist.\n";
p_wire += "Return ok=true with summary of layout structure.\n";

let r_wire = agent(p_wire, #{
    label: "wire-fix",
    capability_mode: "execute",
    output_schema: apply_schema,
});
if (r_wire == () || !r_wire.success || r_wire.output.ok != true) {
    log("Wire agent reported issues — verify will re-check");
}

// ── Verify ──────────────────────────────────────────────────────────────────
phase("Verify");
log("Phase Verify: read-back fonts + split structure");

let p_ver = "";
p_ver += "VERIFY (read-only tools only) the demo UX changes in " + engine + "/public.\n";
p_ver += "Do not edit files. Use read_file and grep.\n\n";
p_ver += "PASS criteria (all required for ok=true):\n";
p_ver += "A. demo.html has a left/right shell (demo-shell or equivalent grid with composer + panel).\n";
p_ver += "B. Preview iframe / preview-card lives in the RIGHT panel, not only below a full-width hero.\n";
p_ver += "C. Inter is linked; Geist Mono is linked; body or tokens use Inter; mono uses Geist Mono.\n";
p_ver += "D. demo.js still references existing IDs (spot-check btn-build, preview-frame, success-box, log-box).\n";
p_ver += "E. revealWorkbench does not call scrollIntoView (or only does so on mobile if needed).\n";
p_ver += "F. design/tokens.css or system.css or voltage.css declares Geist Mono for mono stack.\n\n";
p_ver += "Return ok=true only if A–F all pass. summary: short description of the layout + fonts.\n";
p_ver += "files_changed: list paths that appear to have been modified (best effort from content).\n";

let r_ver = agent(p_ver, #{
    label: "verify",
    capability_mode: "read-only",
    output_schema: apply_schema,
});

if (r_ver == () || !r_ver.success || r_ver.output.ok != true) {
    // One repair pass
    log("Verify failed — one repair agent");
    let p_fix = "";
    p_fix += "The split-layout verification failed for " + engine + "/public demo.\n";
    if (r_ver != () && r_ver.success && r_ver.output.summary != ()) {
        p_fix += "Verifier summary: " + r_ver.output.summary + "\n";
    }
    if (r_ver != () && r_ver.success && r_ver.output.error != ()) {
        p_fix += "Error: " + r_ver.output.error + "\n";
    }
    p_fix += "Fix demo.html, demo.css, demo.js so:\n";
    p_fix += "- Lovable-style left (prompt/composer) + right (preview + live URL)\n";
    p_fix += "- Inter body, Geist Mono code\n";
    p_fix += "- All demo.js element IDs still exist\n";
    p_fix += "- No scrollIntoView for workbench on desktop\n";
    p_fix += "Then re-read and confirm. Return ok=true when fixed.\n";
    let r_fix = agent(p_fix, #{
        label: "repair",
        capability_mode: "execute",
        output_schema: apply_schema,
    });
    if (r_fix == () || !r_fix.success || r_fix.output.ok != true) {
        complete(#{
            ok: false,
            summary: "Split layout incomplete after repair",
            error: "verify and repair failed",
        });
    }
    complete(#{
        ok: true,
        summary: "Split layout + fonts fixed on repair pass",
        files_changed: if r_fix.output.files_changed != () { r_fix.output.files_changed } else { [] },
    });
}

let summary = "Demo split layout (Lovable-style) + Inter/Geist Mono";
if (r_ver != () && r_ver.success && r_ver.output.summary != ()) {
    summary = r_ver.output.summary;
}

complete(#{
    ok: true,
    summary: summary,
    files_changed: if r_ver != () && r_ver.success && r_ver.output.files_changed != () {
        r_ver.output.files_changed
    } else {
        ["public/demo.html", "public/demo.css", "public/demo.js", "public/design/tokens.css", "public/design/system.css"]
    },
});
