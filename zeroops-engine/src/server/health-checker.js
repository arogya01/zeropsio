/**
 * Automated Verification & Health Check Audit Runner
 * Verifies that live provisioned Zerops URLs respond with HTTP 200 and valid data.
 */

let LiveAuditor;
try {
  const mod = require('../verifier/live-auditor');
  LiveAuditor = mod.LiveAuditor || mod;
} catch (e) {
  // Graceful fallback if required directly
}

class HealthChecker {
  constructor(options = {}) {
    const opts = { ...options };
    if (LiveAuditor) {
      this.auditor = new LiveAuditor(opts);
    } else {
      this.options = opts;
    }
  }

  /**
   * Run automated health verification suite against a deployed project
   */
  async runAudit(projectName, liveUrl, onLogStream) {
    const log = typeof onLogStream === 'function' ? onLogStream : () => {};

    try {
      if (!this.auditor && LiveAuditor) {
        this.auditor = new LiveAuditor(this.options || {});
      }

      if (this.auditor) {
        const fullResult = await this.auditor.runFullAudit(liveUrl, projectName, log);
        return {
          success: Boolean(fullResult.success && fullResult.passed !== false),
          auditsPassed: fullResult.auditsPassed ?? 0,
          auditsTotal: fullResult.auditsTotal ?? 4,
          score: fullResult.score || '0%',
          details: fullResult.details || {
            publicHttp: { passed: false, statusCode: 500 },
            apiGateway: { passed: false, statusCode: 500 },
            postgresPrivateDb: { passed: false, connected: false },
            valkeyPrivateCache: { passed: false, connected: false }
          },
          liveUrl: fullResult.liveUrl || liveUrl
        };
      }

      throw new Error('LiveAuditor module is required for health check verification');
    } catch (err) {
      log(`❌ [HEALTH-AUDIT ERROR] Verification suite encountered exception: ${err.message}`);
      return {
        success: false,
        auditsPassed: 0,
        auditsTotal: 4,
        score: '0%',
        details: {
          publicHttp: { passed: false, statusCode: 500 },
          apiGateway: { passed: false, statusCode: 500 },
          postgresPrivateDb: { passed: false, connected: false },
          valkeyPrivateCache: { passed: false, connected: false }
        },
        liveUrl: liveUrl || '',
        error: err.message
      };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Executable CLI verification runner
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runAudit('zeroops-demo', 'https://zeroops-demo.zerops.app', console.log)
    .then(result => {
      console.log('\n[CLI VERIFICATION SUMMARY]', JSON.stringify(result, null, 2));
    });
}

module.exports = HealthChecker;
