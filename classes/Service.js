const { EventEmitter } = require("events");

class Service extends EventEmitter {
  #tickInterval = null;
  #serviceName = "Generic Service";

  constructor(mainProcess, name) {
    if (!mainProcess) {
      throw new Error(`Attempted to create service without "mainProcess"`);
    }
    super();
    this.mainProcess = mainProcess;
    this.#serviceName = name;
  }

  main() {
    return this.mainProcess;
  }

  // State
  updateState(key, value, timestamp = Date.now()) {
    this.mainProcess.state.updateState(key, value, timestamp);
  }

  getState(key) {
    return this.mainProcess.state.getState(key);
  }

  log(...args) {
    this.main().logger.log(this.#serviceName, "standard", ...args);
  }

  warning(...args) {
    this.main().logger.log(this.#serviceName, "warning", ...args);
  }

  error(...args) {
    this.main().logger.log(this.#serviceName, "error", ...args);
  }

  // Life cycle
  async init() {}
  async start() {}
  async stop() {}
  async tick() {
    if (!this.shouldTick) return;
  }
  setTickInterval(n) {
    this.#tickInterval = n;
  }

  getTickInterval() {
    return this.#tickInterval;
  }

  shouldTick() {
    if (this.#tickInterval == null) return false;
    if ((this.mainProcess.ticks + 1) % this.#tickInterval) return false;

    return true;
  }
}

module.exports = Service;
