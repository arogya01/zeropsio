"use strict";
/**
 * src/studio/server.ts
 * Express & WebSocket HTTP Server for ZeroOps Web Studio & Log Streamer.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStudioServer = createStudioServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const stack_synthesizer_js_1 = require("../synthesizer/stack-synthesizer.js");
const private_net_js_1 = require("../synthesizer/private-net.js");
const yaml_generator_js_1 = require("../synthesizer/yaml-generator.js");
const code_synthesizer_js_1 = require("../code-gen/code-synthesizer.js");
const zcp_client_js_1 = require("../zcp/zcp-client.js");
const ws_logger_js_1 = require("./ws-logger.js");
function createStudioServer(options = {}) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '10mb' }));
    const server = http_1.default.createServer(app);
    const logger = new ws_logger_js_1.WsLogger();
    const wss = logger.attach(server, '/ws/logs');
    const zcpClient = new zcp_client_js_1.ZcpClient({ mode: options.mock !== false ? 'mock' : 'real' });
    // Locate static public directory dynamically
    const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    const candidateDirs = [
        path_1.default.resolve(currentDir, 'public'),
        path_1.default.resolve(process.cwd(), 'src/studio/public'),
        path_1.default.resolve(process.cwd(), 'zeroops-engine/src/studio/public'),
        path_1.default.resolve(currentDir, '../../src/studio/public')
    ];
    const staticDir = candidateDirs.find((d) => fs_1.default.existsSync(d)) || candidateDirs[0];
    app.use(express_1.default.static(staticDir));
    // --- REST API Endpoints ---
    // Health check
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ok',
            version: '1.0.0',
            timestamp: new Date().toISOString()
        });
    });
    // System status & topology
    app.get('/api/status', async (_req, res) => {
        try {
            const topology = await zcpClient.getPrivateTopology('default-proj');
            res.json({
                status: 'RUNNING',
                timestamp: new Date().toISOString(),
                topology
            });
        }
        catch {
            res.json({
                status: 'RUNNING',
                timestamp: new Date().toISOString()
            });
        }
    });
    // GET Topology Map
    app.get('/api/topology', async (req, res) => {
        const projectId = req.query.projectId || 'default-proj';
        const topology = await zcpClient.getPrivateTopology(projectId);
        res.json(topology);
    });
    // POST /api/synthesize - Synthesize stack topology, YAML configs, and full application code
    app.post('/api/synthesize', (req, res) => {
        const { prompt, projectName } = req.body || {};
        if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
            return res.status(400).json({ error: 'Prompt is required and must be a non-empty string' });
        }
        try {
            const rawTopology = (0, stack_synthesizer_js_1.synthesizeStack)(prompt, { projectName });
            const enrichedTopology = (0, private_net_js_1.injectPrivateNetEnv)(rawTopology);
            const configs = (0, yaml_generator_js_1.generateZeropsConfigs)(enrichedTopology);
            const codeArtifacts = (0, code_synthesizer_js_1.synthesizeCode)(enrichedTopology);
            return res.json({
                success: true,
                projectName: enrichedTopology.projectName,
                topology: enrichedTopology,
                zeropsProjectImportYaml: configs.zeropsProjectImportYaml,
                zeropsYaml: configs.zeropsYaml,
                codeFiles: codeArtifacts.files,
                codeArtifacts
            });
        }
        catch (err) {
            return res.status(500).json({ error: err.message || 'Synthesis failed' });
        }
    });
    // POST /api/deploy - Trigger autonomous build & deployment pipeline
    app.post('/api/deploy', async (req, res) => {
        const { prompt, projectName } = req.body || {};
        const name = projectName || 'zeroops-cloud-stack';
        const promptText = prompt || 'Default ZeroOps Full-Stack Cloud Factory';
        try {
            const rawTopology = (0, stack_synthesizer_js_1.synthesizeStack)(promptText, { projectName: name });
            const enrichedTopology = (0, private_net_js_1.injectPrivateNetEnv)(rawTopology);
            const configs = (0, yaml_generator_js_1.generateZeropsConfigs)(enrichedTopology);
            await zcpClient.importProject(configs.zeropsProjectImportYaml);
            const deployResult = await zcpClient.deployProject(name, configs.zeropsYaml);
            const liveUrl = deployResult.publicUrl || `https://${name}.zerops.app`;
            // Broadcast logs to WS streamer
            logger.runDeploymentPipeline(promptText, name).catch(() => { });
            return res.json({
                success: true,
                projectName: name,
                deploymentId: deployResult.deploymentId,
                liveUrl,
                publicUrl: liveUrl,
                status: 'DEPLOYED',
                topology: enrichedTopology
            });
        }
        catch (err) {
            return res.status(500).json({ error: err.message || 'Deployment failed' });
        }
    });
    // Fallback route serving SPA index.html for non-API requests
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
            return next();
        }
        const indexPath = path_1.default.join(staticDir, 'index.html');
        if (fs_1.default.existsSync(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            res.status(404).send('Web Studio index.html not found');
        }
    });
    const listen = (overridePort, overrideHost) => {
        const p = overridePort !== undefined ? overridePort : options.port !== undefined ? options.port : 3000;
        const h = overrideHost || options.host || '0.0.0.0';
        return new Promise((resolve, reject) => {
            server.listen(p, h, () => {
                const addr = server.address();
                if (addr && typeof addr === 'object') {
                    resolve(addr.port);
                }
                else {
                    resolve(p);
                }
            });
            server.on('error', reject);
        });
    };
    const close = () => {
        return new Promise((resolve) => {
            logger.close();
            server.close(() => resolve());
        });
    };
    return {
        app,
        server,
        wss,
        logger,
        listen,
        close
    };
}
//# sourceMappingURL=server.js.map