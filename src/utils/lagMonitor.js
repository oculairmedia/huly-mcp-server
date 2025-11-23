export class EventLoopLagMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled || process.env.HULY_MONITOR_LAG === '1';
    this.threshold = options.threshold || parseInt(process.env.HULY_LAG_THRESHOLD_MS || '100', 10);
    this.checkInterval = options.checkInterval || 1000;
    this.logger = options.logger || console;
    this.intervalId = null;
    this.lastCheck = Date.now();
  }

  start() {
    if (!this.enabled) {
      return;
    }

    this.lastCheck = Date.now();

    this.intervalId = setInterval(() => {
      const now = Date.now();
      const lag = now - this.lastCheck - this.checkInterval;

      if (lag > this.threshold) {
        this.logger.warn(`Event loop lag detected: ${lag}ms (threshold: ${this.threshold}ms)`);
      }

      this.lastCheck = now;
    }, this.checkInterval);

    if (this.intervalId.unref) {
      this.intervalId.unref();
    }

    this.logger.info(
      `Event loop lag monitor started (threshold: ${this.threshold}ms, interval: ${this.checkInterval}ms)`
    );
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Event loop lag monitor stopped');
    }
  }
}
