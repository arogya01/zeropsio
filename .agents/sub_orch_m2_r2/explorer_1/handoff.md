# Handoff Report: Session Auth & PAT Onboarding Endpoint Investigation (Milestone M2 Scope 1 & 2)

## 1. Observation

### Codebase Scope Inspected
- `zeroops-engine/src/server/index.js` (Lines 1–269)
- `zeroops-engine/public/studio.html` (Lines 1–261)
- `zeroops-engine/public/studio.js` (Lines 1–283)
- `zeroops-engine/public/login.html` (Lines 1–276)
- `zeroops-engine/src/server/zcp-client.js` (Lines 1–102)
- `zeroops-engine/src/zcp/zcp-client.ts` (Lines 1–383)
- `zeroops-engine/tests/auth-onboarding.test.ts` (Lines 1–255)

### Direct Line-by-Line Code Evidence

#### 1. In-Memory User Store & Plaintext Password Handling (`src/server/index.js`)
- **Line 25**: `const users = {};`
- **Lines 50–51**:
  ```javascript
  users[email] = { email, password, name: name || email.split('@')[0], zeropsToken: null };
  req.session.user = { email, name: users[email].name };
  ```
- **Lines 60–62**:
  ```javascript
  const user = users[email];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  ```
- **Observation**: Passwords are saved in plain text in memory without hashing (e.g., `bcrypt` / `crypto.scryptSync` / `argon2`) or constant-time timing-safe comparison. Email addresses are not normalized (case sensitivity issue: `User@domain.com` vs `user@domain.com`).

#### 2. Session Cookie & Session Store Configuration (`src/server/index.js`)
- **Lines 28–33**:
  ```javascript
  app.use(session({
    secret: 'zeroops-studio-hackathon-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24h
  }));
  ```
- **Observation**:
  - `cookie.httpOnly` is not explicitly set to `true` (defaults to true in Express session, but `sameSite: 'lax'` or `secure: process.env.NODE_ENV === 'production'` is missing).
  - Session secret is hardcoded (`'zeroops-studio-hackathon-2026'`) rather than using `process.env.SESSION_SECRET || 'zeroops-studio-hackathon-2026'`.
  - On `/api/auth/login` (lines 55-66) and `/api/auth/signup` (lines 45-53), `req.session.regenerate()` is not called before writing `req.session.user`, creating a session fixation vulnerability.

#### 3. Logout Cookie Cleanup (`src/server/index.js`)
- **Lines 68–71**:
  ```javascript
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
  });
  ```
- **Observation**: `req.session.destroy()` destroys server-side session state but does not clear the `connect.sid` cookie from the client response (`res.clearCookie('connect.sid')`). If error handling fails during `destroy`, no callback error handling is attached.

#### 4. PAT Token Persistence & Hydration Disconnect (`src/server/index.js` & `public/studio.js`)
- **Server `/api/auth/me` (lines 73–80)**:
  ```javascript
  app.get('/api/auth/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const user = users[req.session.user.email];
    res.json({
      user: req.session.user,
      hasToken: !!(user && user.zeropsToken)
    });
  });
  ```
- **Client `checkAuth()` (`public/studio.js` lines 46–64)**:
  ```javascript
  currentUser = data.user;
  userNameEl.textContent = currentUser.name;
  if (!data.hasToken) {
    onboarding.classList.remove('hidden');
  }
  ```
- **Client Form Submit & WebSocket Deploy (`public/studio.js` lines 211–218)**:
  ```javascript
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      action: 'deploy',
      prompt,
      templateId: selectedTemplateId,
      zeropsToken: zeropsToken
    }));
  }
  ```
- **Server WebSocket Handler (`src/server/index.js` lines 181–186)**:
  ```javascript
  const { prompt, templateId, zeropsToken } = data;
  const token = zeropsToken || null;
  const zcpClient = new ZCPClient(token);
  ```
- **Observation**:
  - `studio.js` only sets `zeropsToken` when `saveToken()` is clicked in the modal. If a user logs in and already has a token stored in `users[email]` on the server, `checkAuth()` sees `data.hasToken === true` and hides the modal, but `zeropsToken` variable in `studio.js` remains `null`.
  - When the user clicks Deploy, `studio.js` sends `{ zeropsToken: null }` over WebSocket. `src/server/index.js` receives `data.zeropsToken` as `null` and instantiates `new ZCPClient(null)` instead of falling back to the authenticated session user's stored `zeropsToken`.

#### 5. Input Validation & Error Handling Gaps
- Endpoint input trimming: `email` and `password` are not trimmed or checked for empty/whitespace strings.
- In `/api/auth/token` (lines 83–94): missing check for whitespace-only token string.

---

## 2. Logic Chain

1. **Email Sensitivity & Lookup Inconsistency**:
   - `users` object uses `email` as key.
   - Without `const cleanEmail = email.toLowerCase().trim()`, registering `User@Test.com` and logging in as `user@test.com` will fail with 401 or allow duplicate signups for case variants.

2. **Session Fixation Risk**:
   - Express session reuses pre-login session ID unless `req.session.regenerate()` is executed upon successful authentication.
   - Fixing session ID before authentication prevents session hijacking attacks.

3. **PAT Token Disconnect in Live Studio Flow**:
   - Step 1: User logs in, saves PAT via `/api/auth/token`. `users[email].zeropsToken` is saved.
   - Step 2: User refreshes page or opens `/studio` in new tab.
   - Step 3: `/api/auth/me` returns `{ user: {...}, hasToken: true }`.
   - Step 4: `studio.js` hides onboarding overlay, but local JS variable `zeropsToken` remains `null`.
   - Step 5: User submits deploy prompt. Client sends `zeropsToken: null` to WebSocket.
   - Step 6: Server WebSocket receives `zeropsToken: null` and instantiates `new ZCPClient(null)`. `ZCPClient` falls back to `process.env.ZEROPS_TOKEN` or fails to authenticate with user PAT.
   - **Conclusion**: Server WebSocket must retrieve the authenticated user's `zeropsToken` from `users[sessionUser.email]` if `data.zeropsToken` is not explicitly provided or null.

4. **Security Header & Session Secret Weaknesses**:
   - Hardcoded session secret should fall back from `process.env.SESSION_SECRET`.
   - `cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }` ensures protection against XSS cookie theft and CSRF.

---

## 3. Caveats

- **Hackathon In-Memory Store (`users = {}`)**: The current architecture deliberately uses an in-memory JS object `const users = {}` as stated in `src/server/index.js:24`. Persisting to a real database (PostgreSQL/SQLite) is out of scope for Milestone M2, but helper functions for password hashing (using Node's built-in `crypto.scryptSync` or simple SHA-256 / HMAC for zero-dependency speed) can be cleanly integrated into `users`.
- **WebSocket Session Parsing**: Express HTTP session cookies are sent during the HTTP upgrade request of WebSockets (`req.headers.cookie`). Alternatively, using `/api/ws-token` or attaching session middleware to WS upgrade can verify WS auth.

---

## 4. Conclusion & Proposed Fix Specifications

### Recommended Code Changes for Worker Implementation

#### Fix 1: Email Normalization & Safe Password Hashing in `src/server/index.js`
- Create a lightweight crypto helper function using `crypto.scryptSync` (or `crypto.pbkdf2Sync`) with salt to hash passwords on signup/login.
- Normalize all incoming `email` inputs with `.toLowerCase().trim()`.

#### Fix 2: Session Security Configuration in `src/server/index.js`
- Update `express-session` options:
  ```javascript
  app.use(session({
    secret: process.env.SESSION_SECRET || 'zeroops-studio-hackathon-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  }));
  ```
- In `/api/auth/login` and `/api/auth/signup`, regenerate session upon auth.
- In `/api/auth/logout`, add `res.clearCookie('connect.sid')`.

#### Fix 3: Token Resolution in WebSocket Handler (`src/server/index.js`)
- In `wss.on('connection')` or when handling `deploy` action, resolve token:
  ```javascript
  // Get token from client msg OR session user in users store OR wsTokenMap
  let token = zeropsToken;
  if (!token && req.session && req.session.user) {
    const user = users[req.session.user.email.toLowerCase().trim()];
    if (user) token = user.zeropsToken;
  }
  ```

#### Fix 4: Frontend Hydration in `public/studio.js`
- Update `checkAuth()` to handle token state cleanly, and ensure `logout()` calls `/api/auth/logout` before redirecting.

---

## 5. Verification Method

Run the Vitest auth & onboarding test suite:
```bash
npx vitest run tests/auth-onboarding.test.ts
```

### Invalidation Conditions
- If any existing test in `tests/auth-onboarding.test.ts` fails.
- If `/api/auth/signup` fails to normalize email addresses.
- If `/api/auth/login` accepts wrong passwords or unhashed comparisons.
- If WebSocket deployment fails when client `zeropsToken` is omitted but server user has a PAT set.
