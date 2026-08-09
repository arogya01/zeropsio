/**
 * Demo-day real-deploy quota (manual ops, soft cap).
 * Max concurrent/total live demo projects under the operator PAT.
 */

const MAX_DEMO_PROJECTS = Number(process.env.DEMO_MAX_PROJECTS || 10);

/** @type {Map<string, { projectName: string, liveUrl: string, createdAt: number }>} */
const activeProjects = new Map();

function isRealDeployEnabled() {
  // Default ON for demo day; set DEMO_REAL_DEPLOY=0 to kill-switch.
  const v = process.env.DEMO_REAL_DEPLOY;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

function getDemoPat() {
  return process.env.ZEROPS_DEMO_PAT || process.env.ZEROPS_TOKEN || process.env.ZEROPS_PAT || null;
}

function getDemoOpenAIKey() {
  return process.env.OPENAI_API_KEY || process.env.DEMO_OPENAI_API_KEY || null;
}

function canProvision() {
  return activeProjects.size < MAX_DEMO_PROJECTS;
}

function registerProject(id, info) {
  activeProjects.set(id, { ...info, createdAt: Date.now() });
}

function listProjects() {
  return Array.from(activeProjects.entries()).map(([id, v]) => ({ id, ...v }));
}

function status() {
  return {
    realDeployEnabled: isRealDeployEnabled(),
    maxProjects: MAX_DEMO_PROJECTS,
    activeCount: activeProjects.size,
    slotsRemaining: Math.max(0, MAX_DEMO_PROJECTS - activeProjects.size),
    hasDemoPat: !!getDemoPat(),
    hasDemoOpenAI: !!getDemoOpenAIKey(),
  };
}

module.exports = {
  MAX_DEMO_PROJECTS,
  isRealDeployEnabled,
  getDemoPat,
  getDemoOpenAIKey,
  canProvision,
  registerProject,
  listProjects,
  status,
  activeProjects,
};
