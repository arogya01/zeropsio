# Handoff Report: Zerops PAT Onboarding Modal Overlay & Frontend Session Storage Audit

## 1. Observation

### File & Code Line Evidence
1. **`zeroops-engine/public/studio.html` (Lines 14–41, 57–66, 81–85)**:
   - Onboarding modal structure:
     ```html
     <div class="onboarding-overlay hidden" id="onboarding">
       <div class="onboarding-card">
         <h2>Connect your Zerops account</h2>
         <p>Paste your Personal Access Token... <a href="...">Get token →</a></p>
         <div class="onboarding-error" id="token-error">Invalid token</div>
         <input type="password" id="zerops-token-input" placeholder="Paste your Zerops token here…">
         <button onclick="saveToken()">Connect &amp; Continue</button>
       </div>
     </div>
     ```
   - Input and button are NOT enclosed in a `<form>` element.
   - Topbar (`.topbar__user`) contains user name and Logout button, but lacks any button/control to re-open or update the Zerops PAT token.

2. **`zeroops-engine/public/studio.js` (Lines 42, 46–64, 167–222, 251–276)**:
   - Module variable declaration (Line 42): `let zeropsToken = null;`
   - `checkAuth()` (Lines 46–64):
     ```javascript
     const res = await fetch('/api/auth/me');
     const data = await res.json();
     if (!data.user) { window.location.href = '/'; return; }
     currentUser = data.user;
     userNameEl.textContent = currentUser.name;
     if (!data.hasToken) {
       onboarding.classList.remove('hidden');
     }
     ```
     `checkAuth()` hides the modal when `data.hasToken` is true, but **never** sets `zeropsToken` variable or restores token from `sessionStorage`.
   - `saveToken()` (Lines 251–276):
     ```javascript
     const token = tokenInput.value.trim();
     if (!token) return; // Silent return with no UI error message
     const res = await fetch('/api/auth/token', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ token })
     });
     const data = await res.json();
     if (data.success) {
       zeropsToken = token;
       onboarding.classList.add('hidden');
     }
     ```
   - Form Submit deployment handler (Lines 211–218):
     ```javascript
     socket.send(JSON.stringify({
       action: 'deploy',
       prompt,
       templateId: selectedTemplateId,
       zeropsToken: zeropsToken
     }));
     ```
     If the user reloads the page, `zeropsToken` is `null`. `socket.send` transmits `zeropsToken: null` to the server.

3. **`zeroops-engine/src/server/index.js` (Lines 160–171, 180–186)**:
   - Endpoint `/api/ws-token` exists in backend (Lines 160–171) to map session IDs to tokens, but `studio.js` **never** calls `/api/ws-token`.
   - WS message handler (Lines 180–186):
     ```javascript
     const { prompt, templateId, zeropsToken } = data;
     const token = zeropsToken || null;
     const zcpClient = new ZCPClient(token);
     ```
     If `zeropsToken` is `null`, `ZCPClient` falls back to `process.env.ZEROPS_TOKEN` instead of retrieving the session user's stored `zeropsToken` from `users[email]`.

4. **Test Suite Baseline (`npx vitest run tests/auth-onboarding.test.ts`)**:
   - `tests/auth-onboarding.test.ts` passes (18/18 tests pass).
   - `npm test` passes (197/197 tests pass).

---

## 2. Logic Chain

1. **Observation 2 & 3** show that `studio.js` manages `zeropsToken` as an in-memory JS variable (`let zeropsToken = null;`).
2. When an authenticated user with a saved PAT token reloads the browser, `GET /api/auth/me` returns `{ user: {...}, hasToken: true }`.
3. In `checkAuth()`, `data.hasToken` is `true`, so `#onboarding` overlay remains hidden. However, because `GET /api/auth/me` does not return the PAT secret (for security), `zeropsToken` in `studio.js` remains `null`.
4. When the user submits a prompt, `studio.js` sends `zeropsToken: null` in the WebSocket `deploy` payload.
5. In `src/server/index.js`, the server extracts `zeropsToken` from the WS payload (`const token = zeropsToken || null;`). Since `zeropsToken` is `null`, `ZCPClient` falls back to `process.env.ZEROPS_TOKEN`.
6. Therefore, returning users lose their personal PAT token association during deployments unless they manually re-enter their token every page session.
7. Furthermore, **Observation 1** demonstrates UX/UI defects:
   - No `<form>` tag around `#zerops-token-input` means pressing `Enter` fails to submit the token.
   - Empty input on `saveToken()` returns silently without user feedback.
   - No UI element exists in the topbar to edit/update PAT after initial onboarding.
   - Attempting deployment when PAT is missing (`hasToken: false` and `zeropsToken: null`) does not trigger the onboarding modal or block deployment.

---

## 3. Caveats

- `GET /api/auth/me` deliberately omits returning raw PAT tokens for security reasons. Client-side persistence via `sessionStorage` or server-side WS session token resolution is required.
- WebSocket connections in Express do not automatically parse session cookies unless `express-session` middleware is attached to the WS HTTP upgrade request or `/api/ws-token` is invoked prior to WS communication.
- No other unexplored state exists; all static assets and server auth/WS handlers have been inspected.

---

## 4. Conclusion

The PAT onboarding modal and session storage mechanism has **3 major critical flaws** and **4 UX/UI defects**:

### Critical Flaws:
1. **Token State Loss on Page Reload**: In-memory `zeropsToken` resets to `null`, forcing WS deploy payloads to transmit `zeropsToken: null` and fallback to `process.env.ZEROPS_TOKEN`.
2. **Unused `/api/ws-token` Endpoint**: Frontend `studio.js` never invokes `/api/ws-token` to store server-side session mapping.
3. **Server WS Session Token Fallback Missing**: `src/server/index.js` WS handler does not fall back to checking `users[email].zeropsToken` when `data.zeropsToken` is missing.

### UX/UI Defects:
1. **Missing Form & Keyboard Handler**: `#zerops-token-input` lacks a `<form>` element and `Enter` key handling.
2. **Silent Validation Failure**: Empty token submit in `saveToken()` fails silently without displaying error text.
3. **Missing Topbar Edit PAT Control**: Topbar has no button to view/re-open PAT onboarding modal.
4. **Missing Deployment Pre-check**: Prompt submission does not check for PAT presence before launching synthesis/deployment.

### Fix Specifications for Worker:
1. **Frontend (`studio.js`)**:
   - Store PAT token in `sessionStorage` (`sessionStorage.setItem('zerops_pat', token)`).
   - In `saveToken()`, call `POST /api/ws-token` to register session PAT with server.
   - In prompt form submit, check if `!zeropsToken` and `!sessionStorage.getItem('zerops_pat')` and `!currentUser.hasToken`; if so, show `#onboarding` modal and cancel deploy.
   - Add error display when `token.trim()` is empty.
2. **Frontend (`studio.html`)**:
   - Wrap onboarding controls in `<form id="onboarding-form" onsubmit="event.preventDefault(); saveToken();">`.
   - Add `<button class="topbar__logout" onclick="openTokenModal()">Change Token</button>` in `.topbar__user`.
   - Add input listener to clear error message when typing in `#zerops-token-input`.
3. **Backend (`src/server/index.js`)**:
   - In WS `deploy` event, if `!zeropsToken`, fallback to checking `wsTokenMap.get(req.sessionID)` or user session record before calling `ZCPClient`.

---

## 5. Verification Method

To verify these findings and any future fixes:

1. **Run Unit & Integration Tests**:
   ```bash
   npx vitest run tests/auth-onboarding.test.ts
   npm test
   ```
2. **Inspect Files**:
   - Check `zeroops-engine/public/studio.html` for `<form>` tag and "Change Token" button.
   - Check `zeroops-engine/public/studio.js` for `sessionStorage` handling, `POST /api/ws-token` invocation, and empty token error messaging.
   - Check `zeroops-engine/src/server/index.js` for WS session token fallback.
3. **Invalidation Conditions**:
   - If `zeropsToken` remains `null` after browser refresh on an authenticated account with saved token.
   - If submitting an empty token input inside onboarding overlay displays no error message.
   - If pressing `Enter` inside `#zerops-token-input` fails to trigger token save.
