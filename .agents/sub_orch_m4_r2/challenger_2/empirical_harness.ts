/**
 * Empirical Challenge Test Harness for Milestone M4 Studio UI & WebSocket Log Streamer
 * Location: .agents/sub_orch_m4_r2/challenger_2/empirical_harness.ts
 */

import fs from 'fs';
import path from 'path';

class MockClassList {
  private el: MockElement;
  constructor(el: MockElement) { this.el = el; }

  add(...classes: string[]) {
    classes.forEach(c => {
      if (c) this.el.classListSet.add(c);
    });
    this.sync();
  }

  remove(...classes: string[]) {
    classes.forEach(c => this.el.classListSet.delete(c));
    this.sync();
  }

  contains(c: string): boolean {
    return this.el.classListSet.has(c);
  }

  toggle(c: string, force?: boolean): boolean {
    if (force === true) { this.add(c); return true; }
    if (force === false) { this.remove(c); return false; }
    if (this.contains(c)) { this.remove(c); return false; }
    else { this.add(c); return true; }
  }

  private sync() {
    this.el.classNameVal = Array.from(this.el.classListSet).join(' ');
  }
}

class MockElement {
  tagName: string;
  id: string;
  classNameVal: string;
  classListSet: Set<string>;
  classList: MockClassList;
  dataset: Record<string, string> = {};
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  textContent: string = '';
  innerHTMLVal: string = '';
  style: Record<string, string> = {};
  disabled: boolean = false;
  value: string = '';
  listeners: Record<string, Function[]> = {};

  constructor(tagName: string = 'div', id: string = '', className: string = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.classNameVal = className;
    this.classListSet = new Set(className.split(' ').filter(Boolean));
    this.classList = new MockClassList(this);
  }

  get className(): string {
    return this.classNameVal;
  }

  set className(val: string) {
    this.classNameVal = val;
    this.classListSet = new Set((val || '').split(' ').filter(Boolean));
  }

  get innerHTML(): string {
    return this.innerHTMLVal;
  }

  set innerHTML(val: string) {
    this.innerHTMLVal = val;
    if (val === '') {
      this.children = [];
    }
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id;
    if (name === 'class') return Array.from(this.classListSet).join(' ');
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.dataset[key] || null;
    }
    return null;
  }

  setAttribute(name: string, val: string) {
    if (name === 'id') this.id = val;
    if (name === 'class') {
      this.className = val;
    }
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = val;
    }
  }

  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event: { type: string; key?: string; ctrlKey?: boolean; metaKey?: boolean; preventDefault?: Function; target?: any }) {
    const list = this.listeners[event.type] || [];
    const evt = {
      type: event.type,
      key: event.key || '',
      ctrlKey: event.ctrlKey || false,
      metaKey: event.metaKey || false,
      preventDefault: event.preventDefault || (() => {}),
      target: event.target || this,
      currentTarget: this
    };
    list.forEach(fn => fn(evt));
  }

  requestSubmit() {
    this.dispatchEvent({ type: 'submit' });
  }

  focus() {}

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
  }

  querySelector(selector: string): MockElement | null {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.children.find(c => c.classList.contains(cls)) || null;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const search = (node: MockElement) => {
      node.children.forEach(c => {
        if (selector.startsWith('.') && c.classList.contains(selector.slice(1))) {
          results.push(c);
        } else if (selector.startsWith('#') && c.id === selector.slice(1)) {
          results.push(c);
        }
        search(c);
      });
    };
    search(this);
    return results;
  }
}

// Create Document Mock
class MockDocument {
  elements: Map<string, MockElement> = new Map();
  allElements: MockElement[] = [];
  listeners: Record<string, Function[]> = {};

  register(id: string, el: MockElement) {
    el.id = id;
    this.elements.set(id, el);
    if (!this.allElements.includes(el)) this.allElements.push(el);
  }

  add(el: MockElement) {
    if (!this.allElements.includes(el)) this.allElements.push(el);
  }

  remove(id: string) {
    const el = this.elements.get(id);
    if (el) {
      this.elements.delete(id);
      this.allElements = this.allElements.filter(e => e !== el);
    }
  }

  getElementById(id: string): MockElement | null {
    return this.elements.get(id) || null;
  }

  querySelector(selector: string): MockElement | null {
    if (selector.startsWith('#')) return this.getElementById(selector.slice(1));
    for (const el of this.allElements) {
      if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) return el;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const res: MockElement[] = [];
    for (const el of this.allElements) {
      if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) res.push(el);
    }
    return res;
  }

  createElement(tagName: string): MockElement {
    const el = new MockElement(tagName);
    this.add(el);
    return el;
  }

  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  triggerDOMContentLoaded() {
    (this.listeners['DOMContentLoaded'] || []).forEach(fn => fn());
  }
}

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  url: string;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  send(msg: string) {
    this.sentMessages.push(msg);
  }

  simulateServerMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateRawMessage(raw: string) {
    if (this.onmessage) {
      this.onmessage({ data: raw });
    }
  }
}

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(category: string, name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      results.push({ category, name, passed: true });
      console.log(`  ✓ [${category}] ${name}`);
    } catch (err: any) {
      results.push({ category, name, passed: false, error: err.message || String(err), details: err.stack });
      console.error(`  ✕ [${category}] ${name}: ${err.message}`);
    }
  })();
}

async function runEmpiricalHarness() {
  console.log('Starting M4 Empirical Challenge Harness…\n');

  const engineDir = path.resolve('/Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine');
  const htmlContent = fs.readFileSync(path.join(engineDir, 'public/studio.html'), 'utf-8');
  const jsContent = fs.readFileSync(path.join(engineDir, 'public/studio.js'), 'utf-8');

  const doc = new MockDocument();

  const promptForm = new MockElement('form', 'prompt-form');
  const promptInput = new MockElement('textarea', 'prompt-input');
  const deployBtn = new MockElement('button', 'deploy-btn');
  const terminal = new MockElement('pre', 'terminal');
  const yamlView = new MockElement('pre', 'yaml-view');
  const codeTree = new MockElement('div', 'code-tree');
  const chatWelcome = new MockElement('div', 'chat-welcome');
  const chatFeed = new MockElement('div', 'chat-feed', 'pipeline-feed hidden');
  const feedUserMsg = new MockElement('div', 'feed-user-msg');
  const feedSuccess = new MockElement('div', 'feed-success', 'hidden');
  const successLink = new MockElement('a', 'success-link');
  const templateGrid = new MockElement('div', '', 'template-grid');
  const onboarding = new MockElement('div', 'onboarding', 'onboarding-overlay hidden');
  const userNameEl = new MockElement('span', 'user-name');
  const tokenError = new MockElement('div', 'token-error');
  const tokenInput = new MockElement('input', 'zerops-token-input');

  const stepSynth = new MockElement('div', 'feed-step-synth');
  const stepNet = new MockElement('div', 'feed-step-net');
  const stepLxd = new MockElement('div', 'feed-step-lxd');
  const stepHealth = new MockElement('div', 'feed-step-health');

  [stepSynth, stepNet, stepLxd, stepHealth].forEach(step => {
    const statusSpan = new MockElement('span', '', 'feed-step-status');
    statusSpan.textContent = 'waiting';
    statusSpan.dataset['status'] = 'waiting';
    step.appendChild(statusSpan);
  });

  const nodeWeb = new MockElement('div', 'node-web-frontend', 'topo-chip');
  const nodeApi = new MockElement('div', 'node-api-gateway', 'topo-chip');
  const nodeAi = new MockElement('div', 'node-ai-worker', 'topo-chip');
  const nodeDb = new MockElement('div', 'node-db-postgres', 'topo-chip topo-chip--db');
  const nodeCache = new MockElement('div', 'node-cache-valkey', 'topo-chip topo-chip--db');

  [nodeWeb, nodeApi, nodeAi, nodeDb, nodeCache].forEach(n => {
    const ipSpan = new MockElement('span', '', 'topo-chip__ip');
    ipSpan.textContent = '10.160.0.10';
    n.appendChild(ipSpan);
  });

  const tabTerminal = new MockElement('button', '', 'wb-tab active');
  tabTerminal.dataset['tab'] = 'wb-terminal';
  const tabYaml = new MockElement('button', '', 'wb-tab');
  tabYaml.dataset['tab'] = 'wb-yaml';
  const tabCode = new MockElement('button', '', 'wb-tab');
  tabCode.dataset['tab'] = 'wb-code';

  const paneTerminal = new MockElement('div', 'wb-terminal', 'wb-pane active');
  const paneYaml = new MockElement('div', 'wb-yaml', 'wb-pane');
  const paneCode = new MockElement('div', 'wb-code', 'wb-pane');

  const codeSidebar = new MockElement('aside', 'code-sidebar');
  const codeFileList = new MockElement('ul', 'code-file-list');
  const codeActiveFilename = new MockElement('div', 'code-active-filename');
  const codeActiveContent = new MockElement('pre', 'code-active-content');

  // Register elements
  doc.register('prompt-form', promptForm);
  doc.register('prompt-input', promptInput);
  doc.register('deploy-btn', deployBtn);
  doc.register('terminal', terminal);
  doc.register('yaml-view', yamlView);
  doc.register('code-tree', codeTree);
  doc.register('chat-welcome', chatWelcome);
  doc.register('chat-feed', chatFeed);
  doc.register('feed-user-msg', feedUserMsg);
  doc.register('feed-success', feedSuccess);
  doc.register('success-link', successLink);
  doc.register('onboarding', onboarding);
  doc.register('user-name', userNameEl);
  doc.register('token-error', tokenError);
  doc.register('zerops-token-input', tokenInput);

  doc.register('feed-step-synth', stepSynth);
  doc.register('feed-step-net', stepNet);
  doc.register('feed-step-lxd', stepLxd);
  doc.register('feed-step-health', stepHealth);

  doc.register('node-web-frontend', nodeWeb);
  doc.register('node-api-gateway', nodeApi);
  doc.register('node-ai-worker', nodeAi);
  doc.register('node-db-postgres', nodeDb);
  doc.register('node-cache-valkey', nodeCache);

  doc.register('wb-terminal', paneTerminal);
  doc.register('wb-yaml', paneYaml);
  doc.register('wb-code', paneCode);

  doc.add(tabTerminal);
  doc.add(tabYaml);
  doc.add(tabCode);

  doc.add(paneTerminal);
  doc.add(paneYaml);
  doc.add(paneCode);

  doc.register('code-sidebar', codeSidebar);
  doc.register('code-file-list', codeFileList);
  doc.register('code-active-filename', codeActiveFilename);
  doc.register('code-active-content', codeActiveContent);

  let createdSocket: MockWebSocket | null = null;

  (global as any).document = doc;
  (global as any).window = {
    location: { protocol: 'http:', host: 'localhost:3000' },
    Terminal: null,
    FitAddon: null,
    fetch: async (url: string) => {
      if (url === '/api/auth/me') return { ok: true, json: async () => ({ user: { name: 'TestUser' }, hasToken: true }) };
      if (url === '/api/templates') return { ok: true, json: async () => ({ templates: [{ id: 't1', name: 'Test Stack', description: 'Test prompt' }] }) };
      if (url === '/api/synthesize') return { ok: true, json: async () => ({ success: true, zeropsYml: 'zerops:\n  setup: web', codeFiles: { 'zerops.yml': 'zerops:\n  setup: web', 'server.js': 'console.log("hello");' } }) };
      return { ok: true, json: async () => ({}) };
    },
    sessionStorage: {
      getItem: (key: string) => (key === 'zerops_pat' ? 'mock_pat_token' : null),
      setItem: () => {},
      removeItem: () => {}
    }
  };
  (global as any).location = (global as any).window.location;
  (global as any).fetch = (global as any).window.fetch;
  (global as any).sessionStorage = (global as any).window.sessionStorage;
  (global as any).WebSocket = function(url: string) {
    createdSocket = new MockWebSocket(url);
    return createdSocket;
  };

  // CATEGORY 1: Split-Pane UI Layout Rendering
  await recordTest('Split-Pane UI', 'html HTML file contains all M4 split-pane structure and panel IDs', () => {
    if (!htmlContent.includes('id="chat-feed"')) throw new Error('Missing #chat-feed');
    if (!htmlContent.includes('id="prompt-bar"')) throw new Error('Missing #prompt-bar');
    if (!htmlContent.includes('id="wb-terminal"')) throw new Error('Missing #wb-terminal');
    if (!htmlContent.includes('id="wb-yaml"')) throw new Error('Missing #wb-yaml');
    if (!htmlContent.includes('id="wb-code"')) throw new Error('Missing #wb-code');
    if (!htmlContent.includes('class="panel-left"')) throw new Error('Missing .panel-left');
    if (!htmlContent.includes('class="panel-right"')) throw new Error('Missing .panel-right');
  });

  // Execute studio.js script via eval in simulated DOM
  try {
    eval(jsContent);
    doc.triggerDOMContentLoaded();
  } catch (err: any) {
    console.error('Failed to execute studio.js:', err);
  }

  // CATEGORY 1 Test 2: Tab Switching
  await recordTest('Split-Pane UI', 'Tab switching updates active classes across tabs and panes', () => {
    tabYaml.dispatchEvent({ type: 'click' });
    if (!tabYaml.classList.contains('active')) throw new Error('tabYaml should be active');
    if (tabTerminal.classList.contains('active')) throw new Error('tabTerminal should not be active');
    if (!paneYaml.classList.contains('active')) throw new Error('paneYaml should be active');
    if (paneTerminal.classList.contains('active')) throw new Error('paneTerminal should not be active');
  });

  // CATEGORY 2: Topology Strip Transitions
  await recordTest('Topology Strip', 'topology-update changes node class, handles status, preserves topo-chip--db and updates IP', () => {
    if (!createdSocket) throw new Error('WebSocket connection not initialized');

    createdSocket.simulateServerMessage({
      type: 'topology-update',
      serviceId: 'web-frontend',
      status: 'BUILDING',
      privateIp: '10.160.0.12:8080'
    });
    if (!nodeWeb.classList.contains('building')) throw new Error('nodeWeb expected building class');
    const webIp = nodeWeb.querySelector('.topo-chip__ip');
    if (!webIp || webIp.textContent !== '10.160.0.12:8080') throw new Error('IP update failed for nodeWeb');

    createdSocket.simulateServerMessage({
      type: 'topology-update',
      serviceId: 'postgres',
      status: 'DEPLOYING',
      privateIp: '10.160.0.21:5432'
    });
    if (!nodeDb.classList.contains('deploying')) throw new Error('nodeDb expected deploying class via alias postgres');
    if (!nodeDb.classList.contains('topo-chip--db')) throw new Error('nodeDb must preserve topo-chip--db class');

    createdSocket.simulateServerMessage({
      type: 'topology-update',
      serviceId: 'valkey',
      status: 'HEALTHY',
      privateIp: '10.160.0.25:6379'
    });
    if (!nodeCache.classList.contains('healthy')) throw new Error('nodeCache expected healthy class via alias valkey');
    if (!nodeCache.classList.contains('topo-chip--db')) throw new Error('nodeCache must preserve topo-chip--db class');
  });

  // CATEGORY 3: Code Inspector File Tree Navigation
  await recordTest('Code Inspector', 'renderCodeFiles populates file list and content viewer, click selects active file', async () => {
    promptInput.value = 'E-Commerce app';
    promptForm.dispatchEvent({ type: 'submit' });

    await new Promise(r => setTimeout(r, 50));

    if (codeFileList.children.length !== 2) {
      throw new Error(`Expected 2 files in code-file-list, got ${codeFileList.children.length}`);
    }

    const firstFileItem = codeFileList.children[0];
    if (!firstFileItem.classList.contains('active')) throw new Error('First file item should be active');
    if (codeActiveFilename.textContent !== 'zerops.yml') throw new Error(`Expected zerops.yml, got ${codeActiveFilename.textContent}`);
    if (!codeActiveContent.textContent.includes('zerops:')) throw new Error('Expected zerops content in active viewer');

    const secondFileItem = codeFileList.children[1];
    secondFileItem.dispatchEvent({ type: 'click' });
    if (!secondFileItem.classList.contains('active')) throw new Error('Second file item should become active');
    if (firstFileItem.classList.contains('active')) throw new Error('First file item should lose active class');
    if (codeActiveFilename.textContent !== 'server.js') throw new Error(`Expected server.js, got ${codeActiveFilename.textContent}`);
  });

  // CATEGORY 4: Boundary Conditions & Edge Case Stress Testing

  // 4.1 Rapid Tab Switching
  await recordTest('Boundary Tests', 'Rapid tab switching (100 switches) does not crash or leave inconsistent active states', () => {
    const tabs = [tabTerminal, tabYaml, tabCode];
    for (let i = 0; i < 100; i++) {
      const idx = i % 3;
      tabs[idx].dispatchEvent({ type: 'click' });
    }
    if (!tabTerminal.classList.contains('active')) throw new Error('tabTerminal should end active after 100 switches');
    if (tabYaml.classList.contains('active') || tabCode.classList.contains('active')) throw new Error('Other tabs must not be active');
    if (!paneTerminal.classList.contains('active')) throw new Error('paneTerminal should end active');
  });

  // 4.2 Missing DOM Elements
  await recordTest('Boundary Tests', 'Missing optional DOM elements do not throw uncaught exceptions during log/ws messages', () => {
    if (!createdSocket) throw new Error('WebSocket connection not initialized');

    createdSocket.simulateServerMessage({
      type: 'log',
      message: 'Building LXD container image…'
    });

    createdSocket.simulateServerMessage({
      type: 'complete',
      liveUrl: 'https://testapp.zerops.app',
      projectName: 'testapp'
    });

    if (feedSuccess.classList.contains('hidden')) throw new Error('feedSuccess should be unhidden on complete');
  });

  // 4.3 Empty File Trees
  await recordTest('Boundary Tests', 'Empty or null codeFiles object handled gracefully without crashing', () => {
    if (!createdSocket) throw new Error('WS connection required');

    createdSocket.simulateServerMessage({
      type: 'complete',
      liveUrl: 'https://app.zerops.app'
    });
  });

  // 4.4 Unexpected Status Payload Strings & Malformed WS Messages
  await recordTest('Boundary Tests', 'Unexpected status payload strings in topology-update', () => {
    if (!createdSocket) throw new Error('WS connection required');

    // 1. Unknown status string
    createdSocket.simulateServerMessage({
      type: 'topology-update',
      serviceId: 'api-gateway',
      status: 'UNKNOWN_CRASH_STATE',
      privateIp: '10.160.0.15'
    });
    if (!nodeApi.classList.contains('unknown_crash_state')) throw new Error('Expected unknown_crash_state class on nodeApi');

    // 2. Empty status string
    createdSocket.simulateServerMessage({
      type: 'topology-update',
      serviceId: 'api-gateway',
      status: '',
      privateIp: '10.160.0.15'
    });
    if (nodeApi.className !== 'topo-chip ') throw new Error(`Expected clean topo-chip class, got '${nodeApi.className}'`);

    // 3. Raw malformed non-JSON frame
    createdSocket.simulateRawMessage('NON_JSON_CORRUPTED_FRAME_###');
  });

  // 4.5 Adversarial Payloads & Robustness Tests
  await recordTest('Boundary Tests', 'Non-string serviceId in topology-update message handling', () => {
    if (!createdSocket) throw new Error('WS connection required');

    // Send numeric serviceId (e.g. 123)
    createdSocket.simulateServerMessage({
      type: 'topology-update',
      serviceId: 123,
      status: 'BUILDING'
    });
  });

  await recordTest('Boundary Tests', 'Non-string status in topology-update message handling', () => {
    if (!createdSocket) throw new Error('WS connection required');

    // Send numeric status (e.g. 500)
    createdSocket.simulateServerMessage({
      type: 'topology-update',
      serviceId: 'web-frontend',
      status: 500
    });
  });

  await recordTest('Boundary Tests', 'Log message with non-string text or undefined fields', () => {
    if (!createdSocket) throw new Error('WS connection required');

    // Send log message with number in message
    createdSocket.simulateServerMessage({
      type: 'log',
      message: 404
    });
  });

  // 4.6 DOM Event Bubbling & Keydown Shortcuts
  await recordTest('Boundary Tests', 'Ctrl+Enter keydown on prompt input triggers form submission', () => {
    let formSubmitted = false;
    promptForm.addEventListener('submit', () => { formSubmitted = true; });

    promptInput.value = 'Deploy via shortcut';
    promptInput.dispatchEvent({ type: 'keydown', key: 'Enter', ctrlKey: true });

    if (!formSubmitted) throw new Error('Ctrl+Enter failed to submit prompt form');
  });

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log(`\nEmpirical Test Summary: ${passedCount} passed, ${failedCount} failed (${results.length} total).`);
  return { passedCount, failedCount, total: results.length, results };
}

runEmpiricalHarness().catch(console.error);
