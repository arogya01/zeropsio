# Handoff Report: Explorer M1 2 — Auth & Template Library Investigation

## 1. Observation

### Codebase Locations & Exact Route Definitions
- **Auth Endpoints & Session Management**:
  - Source File: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/server/index.js`
  - Routes:
    - `POST /api/auth/signup` (lines 45–53): Validates `email` and `password`, returns 400 if missing, 409 if user exists in `users` object, stores user `{ email, password, name, zeropsToken: null }`, initializes `req.session.user`.
    - `POST /api/auth/login` (lines 55–66): Validates credentials, returns 400 if missing, 401 if invalid/not found, sets `req.session.user`, returns `{ success: true, user, hasToken: !!zeropsToken }`.
    - `POST /api/auth/logout` (lines 68–71): Calls `req.session.destroy()`, returns `{ success: true }`.
    - `GET /api/auth/me` (lines 73–80): Unauthenticated returns 401; authenticated returns `{ user, hasToken: !!zeropsToken }`.
    - `POST /api/auth/token` (lines 83–94): Protected by `requireAuth` middleware (lines 39–42). Requires `{ token }`, returns 400 if missing token, stores `user.zeropsToken = token`, returns `{ success: true }`.
    - `POST /api/ws-token` (lines 163–171): Protected by `requireAuth`. If `user.zeropsToken` exists, sets `wsTokenMap.set(req.sessionID, user.zeropsToken)` and returns `{ success: true }`.

- **PAT Token Passing & ZCP Client Wrappers**:
  - CommonJS ZCP Client: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/server/zcp-client.js`
    - Constructor `new ZCPClient(apiToken = process.env.ZEROPS_TOKEN)` stores `apiToken`. Passed down from WS deploy message `const zcpClient = new ZCPClient(token)`.
  - TypeScript ZCP Client: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/zcp/zcp-client.ts`
    - Constructor `new ZcpClient({ apiToken, mode })`. Auto-falls back to `mock` mode if `mode: 'real'` is specified without an `apiToken`.

- **Template Catalog & Synthesis**:
  - Source File: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/server/index.js`
  - Routes:
    - `GET /api/templates` (lines 97–117): Reads `/src/templates`, iterates directories (`ai-video-clipper`, `ecommerce-platform`, `rag-search-engine`), reads `template.json`, returns `{ templates: [...] }`.
    - `GET /api/templates/:id` (lines 119–132): Validates folder existence (returns 404 if missing), reads `template.json` and `zerops-import.yml`, returns JSON with metadata and `importYaml`.
  - Template Directories (`/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/templates/`):
    1. `ai-video-clipper`: `template.json` (name: "AI Video Clipper", icon: "🎬"), `zerops-import.yml` (`project.name: aivideoclipper`), `webapp/server.js`, `apigateway/main.go`, `aiworker/main.py`.
    2. `ecommerce-platform`: `template.json` (name: "E-Commerce Platform", icon: "🛒"), `zerops-import.yml` (`project.name: ecommerceplatform`), `webapp/server.js`, `apigateway/main.go`, `aiworker/main.py`.
    3. `rag-search-engine`: `template.json` (name: "RAG Search Engine", icon: "🔍"), `zerops-import.yml` (`project.name: ragsearchengine`), `webapp/server.js`, `apigateway/main.go`, `aiworker/main.py`.

- **AST Zero-Stub Validator**:
  - Source File: `/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine/src/code-gen/stub-validator.ts`
  - Primary function: `validateZeroStubs(files: Record<string, string>): StubValidationResult`.
  - Features: TypeScript AST scanner (`validateTsAst`), Go syntax & unescaped physical newline string validator (`validateGoSyntax`), Polyglot text scanner (`validateNonTsFile` checking Python `pass`, `NotImplementedError`, Go `panic`, SQL empty migrations, UI placeholders).

- **Existing Test Runner Execution Status**:
  - Command `npx vitest run`: 9 test files passed, 72 tests passed.
  - Command `npx tsx --test tests/tier*.test.ts`: 38 test suites passed, 197 tests passed.
  - Current total: 269 tests. Neither `/api/auth/*` nor `/api/templates/*` currently have dedicated test suites in `tests/`.

---

## 2. Logic Chain

1. **Server Export Refactoring Requirement**:
   - Observation: `src/server/index.js` creates Express `app` and HTTP `server`, but directly calls `server.listen(PORT)` at top level without `if (require.main === module)` guard, and does not export `app` or `server`.
   - Inference: To test `src/server/index.js` routes in `tests/auth-onboarding.test.ts` and `tests/template-library.test.ts`, the Worker must add `module.exports = { app, server, wss, users };` (and guard `server.listen` with `if (require.main === module)`). This allows test suites to import the server, bind to ephemeral port `0`, get `http://127.0.0.1:${port}`, and close the server in `afterAll`.

2. **Auth & Onboarding Test Architecture (`tests/auth-onboarding.test.ts`)**:
   - Will test full HTTP session lifecycle using `fetch` with `Cookie` header propagation.
   - Scenario Coverage (~20 test cases):
     - `POST /api/auth/signup`: Valid registration returns 200 + user object + session cookie. Default name generation when `name` is omitted. Error cases: 400 for missing credentials, 409 for duplicate email.
     - `POST /api/auth/login`: Valid login returns 200 + `hasToken: false`. Error cases: 400 for missing credentials, 401 for invalid password or unknown user.
     - `GET /api/auth/me`: 401 for unauthenticated request; 200 + user profile for authenticated session.
     - `POST /api/auth/token`: 401 for unauthenticated request; 400 for missing token; 200 for valid PAT storage. Subsequent `/api/auth/me` returns `hasToken: true`.
     - `POST /api/ws-token`: 401 for unauthenticated request; 400 if user has no token; 200 if token stored.
     - `POST /api/auth/logout`: 200 success, destroys session; subsequent `/api/auth/me` returns 401.
     - ZCP Client PAT Token Passing: Unit tests verifying `new ZCPClient('pat-token')` and `new ZcpClient({ apiToken: 'pat-token', mode: 'real' })` retain token and handle auto-fallback mode correctly.

3. **Template Library & Validation Test Architecture (`tests/template-library.test.ts`)**:
   - Will test catalog endpoints, synthesis of `zerops-import.yml` for all 3 stacks, and AST zero-stub validation.
   - Scenario Coverage (~15-20 test cases):
     - `GET /api/templates`: 200 status, returns catalog array containing all 3 pre-built stacks (`ai-video-clipper`, `ecommerce-platform`, `rag-search-engine`). Verifies required fields (`id`, `name`, `description`, `icon`, `services`).
     - `GET /api/templates/:id`: 200 status for valid IDs, returns template metadata + full `importYaml`. 404 status for non-existent template ID.
     - `zerops-import.yml` Synthesis Verification: Parse YAML for all 3 stacks using `js-yaml`. Verify `project.name` (`aivideoclipper`, `ecommerce-platform`, `ragsearchengine`) and presence of all 5 service specs (`webapp` nodejs@22, `apigateway` go@1.22, `aiworker` python@3.12, `dbpostgres` postgresql@16, `cachevalkey` valkey@7.2).
     - AST Zero-Stub Validator Integration: Load all template code files (`webapp/server.js`, `apigateway/main.go`, `aiworker/main.py`) across all 3 stacks, run `validateZeroStubs(files)`. Assert `isClean: true`, `astValid: true`, `stubsFound: []`, `violations: []`.

---

## 3. Caveats

1. **Read-Only Explorer Constraint**:
   - No files inside `zeroops-engine/src/` or `zeroops-engine/tests/` were modified during this investigation.
2. **Server Export Prerequisite**:
   - In order for `tests/auth-onboarding.test.ts` and `tests/template-library.test.ts` to execute cleanly in `vitest`, `src/server/index.js` must be slightly updated by Worker to export `{ app, server, wss, users }` and avoid auto-listening when imported as a module.
3. **Session Cookie Propagation**:
   - When running HTTP tests against Express `express-session`, test helpers must store and pass the `set-cookie` header across sequential HTTP `fetch` requests to simulate realistic user browser behavior.

---

## 4. Conclusion

The Auth & Template Library backend implementation in `zeroops-engine/` is fully functional and ready for unit/integration test coverage.
- **`tests/auth-onboarding.test.ts`** will provide ~20 test cases covering signup, login, session auth, PAT token overlay storage, logout, ws-token authorization, and ZCP token wrapper passing.
- **`tests/template-library.test.ts`** will provide ~15-20 test cases covering template catalog listing, individual template retrieval, `zerops-import.yml` synthesis for all 3 pre-built stacks, and zero-stub AST validation on template code files.
- Adding these two test suites will bring Vitest test files count to 11 and push total test count from 269 to ~307+ tests.

---

## 5. Verification Method

To verify the planned implementation once implemented by Worker:

```bash
# 1. Run new Auth & Onboarding test suite
npx vitest run tests/auth-onboarding.test.ts

# 2. Run new Template Library test suite
npx vitest run tests/template-library.test.ts

# 3. Run full Vitest suite
npx vitest run

# 4. Run full Node native tier suite
npx tsx --test tests/tier*.test.ts

# 5. Run unified test script
npm test
```

Verification is successful when all tests pass with 0 failures and 100% clean status.
