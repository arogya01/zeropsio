# Milestone M4 Empirical Challenge Findings Report

**Challenger**: Challenger 2 (Empirical UI Layout, Topology Strip, Code Inspector & Stress Testing)
**Target Milestone**: M4 (Real-Time zcli Log Streaming & Workbench Studio UI)
**Date**: 2026-08-09T01:17:30Z
**Verdict**: **APPROVE** (with minor defensive hardening recommendation)

---

## Executive Summary

Challenger 2 conducted empirical stress testing, DOM boundary testing, and unit/UI test suite execution for Milestone M4. All primary functional requirements for split-pane UI rendering, topology strip transitions, Code Inspector file tree navigation, and WebSocket log streaming pass with 100% compliance. Both official test suites (`tests/workbench-ui.test.ts` and `tests/studio.test.ts`) passed cleanly with 39 out of 39 tests green.

Adversarial testing revealed 3 low-severity type-safety edge cases when non-string types (such as numbers or objects) are passed in WebSocket payload fields (`serviceId`, `status`, or `message`). These are documented below with suggested defensive mitigations.

---

## Stress Test Results

| # | Test Scenario | Expected Behavior | Actual Behavior | Verdict |
|---|---|---|---|---|
| 1 | **Split-Pane Layout Rendering** (`#chat-feed`, `#prompt-bar`, `#wb-terminal`, `#wb-yaml`, `#wb-code`) | All panel containers present in DOM with correct CSS split classes | All IDs present in `studio.html` with `.panel-left` and `.panel-right` | **PASS** |
| 2 | **Workbench Tab Switching** | Clicking `.wb-tab` updates `.active` class across tabs and target `.wb-pane` elements | Tab click toggles `.active` seamlessly on both tab buttons and target panes | **PASS** |
| 3 | **Topology Strip Node Status Transitions** | Node chips update classes (`building`, `deploying`, `healthy`, `failed`), preserve `topo-chip--db` on DB nodes, and update IP text | Node class updated, `topo-chip--db` preserved, IP text populated correctly | **PASS** |
| 4 | **Topology Alias Mapping** | Short service aliases (`webapp`, `apigateway`, `aiworker`, `postgres`, `valkey`) map to canonical node IDs | Correctly resolves canonical IDs and updates corresponding chip elements | **PASS** |
| 5 | **Code Inspector File Tree Navigation** | Multi-service synthesized files populate `#code-file-list`; selection updates active class, `#code-active-filename`, and `#code-active-content` | File tree renders correctly, clicking items updates viewer content dynamically | **PASS** |
| 6 | **Rapid Tab Switching Stress Test** | 100 rapid tab clicks between `#wb-terminal`, `#wb-yaml`, and `#wb-code` | Maintains exact state consistency without memory leak or detached state | **PASS** |
| 7 | **Missing DOM Elements Graceful Handling** | Missing optional DOM elements do not throw unhandled exceptions | Handled safely via null checks (`if (elem)`) | **PASS** |
| 8 | **Empty File Trees Handling** | Empty `codeFiles` `{}` or `null` handled gracefully | Handled safely via early return `if (!files || Object.keys(files).length === 0)` | **PASS** |
| 9 | **Unexpected Status Payload Strings** | Status strings like `"BUILDING"`, `"Deploying"`, `"UNKNOWN_STATUS"`, `""` handled without crashing | `rawStatus = (data.status || '').toLowerCase()` converts to lowercase class | **PASS** |
| 10 | **Shortcut Keydown Event Handling** | `Ctrl+Enter` or `Cmd+Enter` on prompt textarea submits deployment form | `form.requestSubmit()` triggers form submit event as expected | **PASS** |
| 11 | **Vitest Workbench UI Suite** | Execute `npx vitest run tests/workbench-ui.test.ts` | 21/21 tests passed (230ms) | **PASS** |
| 12 | **Vitest Studio Integration Suite** | Execute `npx vitest run tests/studio.test.ts` | 18/18 tests passed (681ms) | **PASS** |
| 13 | **Adversarial Non-String `serviceId`** | `topology-update` with numeric `serviceId: 123` | Throws `TypeError: serviceId.toLowerCase is not a function` in `getNode` | **FAIL (Low)** |
| 14 | **Adversarial Non-String `status`** | `topology-update` with numeric `status: 500` | Throws `TypeError: (data.status || "").toLowerCase is not a function` | **FAIL (Low)** |
| 15 | **Adversarial Non-String `message`** | `log` message with numeric `message: 404` | Throws `TypeError: ansiText.replace is not a function` in `appendLogMessage` | **FAIL (Low)** |

---

## Detailed Findings & Challenges

### [Low Risk] Challenge 1: Uncoerced Non-String Payloads in WebSocket Handlers (`studio.js`)

- **Assumption challenged**: Assumes all incoming WebSocket JSON payload values (`serviceId`, `status`, `message`, `text`) are strings.
- **Attack Scenario**: If a backend or third-party log stream sends a numeric status (e.g. `{ type: 'topology-update', serviceId: 'web-frontend', status: 500 }`) or numeric log message (e.g. `{ type: 'log', message: 404 }`), `studio.js` attempts to invoke `.toLowerCase()` or `.replace()` directly on the number, resulting in a client-side `TypeError`.
- **Blast Radius**: Causes the WebSocket `onmessage` handler to throw an uncaught exception for that frame.
- **Suggested Defense**:
  1. In `getNode(serviceId)`: ensure string conversion via `const sid = String(serviceId);`.
  2. In `topology-update`: ensure string conversion via `const rawStatus = String(data.status || '').toLowerCase();`.
  3. In `appendLogMessage(data)`: ensure string conversion via `const ansiText = String(data.text || data.message || '');`.

---

## Unchallenged Areas

- **Backend LXD container provisioning runtime**: Covered by integration test suite `tests/studio.test.ts` mock backend; real LXD container socket requires live Zerops infrastructure token.

---

## Final Assessment

- **Unit & UI Test Suites**: 39 / 39 PASSED (100%)
- **Empirical DOM & Layout Boundary Harness**: 9 / 9 Primary Tests PASSED
- **Verdict**: **APPROVE**
