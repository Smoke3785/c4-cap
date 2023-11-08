// ENV
require("dotenv").config();

const Arduino = require("./classes/Arduino");
const State = require("./classes/State");
const Server = require("./classes/Server/Server");
const Navigator = require("./classes/Navigation/Navigator");
const Location = require("./classes/Navigation/Location");
const Logger = require("./classes/Logger");
const ClassBase = require("./classes/ClassBase");

class Main extends ClassBase {
  #tickIntervalMs = 1;
  #tickRunning = false;
  constructor() {
    super();
    this.tickInterval;
    this.ticks = 0;

    // Services
    this.arduino = null;
    this.state = null;
    this.server = null;
    this.navigator = null;
    this.location = null;

    // Logger
    this.logger = new Logger(this);
  }

  log(...args) {
    this.logger.log("Main", "standard", ...args);
  }

  warning(...args) {
    this.logger.log("Main", "warning", ...args);
  }

  error(...args) {
    this.logger.log("Main", "error", ...args);
  }

  notify(...args) {
    this.logger.log("Main", "notify", ...args);
  }

  async init() {
    // this.logger.welcome();
    console.log("");
    console.log("");
    this.notify(`Running pre-flight checks`);
    this.log(`Initializing main process`);

    // Construct
    this.state = new State(this);
    this.arduino = new Arduino(this);
    this.location = new Location(this);
    this.navigator = new Navigator(this);
    this.server = new Server(this);

    // Initialize
    await this.state.init();
    await this.arduino.init();
    await this.location.init();
    await this.navigator.init();
    await this.server.init();
  }

  startTicking() {
    this.tickInterval = setInterval(() => this.tick(), this.#tickIntervalMs);
  }

  start() {
    this.arduino.start();
    this.server.start();
    this.state.start();
    this.navigator.start();
    this.location.start();

    // Once these services are started, tick once;
    this.startTicking();
    this.notify(
      `All services initialized, started, and ticked. Ready for takeoff!`
    );

    setTimeout(() => {
      // Send initial state once tick has run once.
      // this.server.sendInitialState(); // NOTE: Does it make sense to emit the state before the client has connected? I don't think so...
    }, this.#tickIntervalMs);
  }

  stop() {
    clearInterval(this.tickInterval);
    this.log(`Stopped after ${this.ticks} ticks.`);
  }

  async tick() {
    let start = performance.now();

    await this.state.tick();
    await this.arduino.tick();
    await this.server.tick();
    await this.navigator.tick();
    await this.location.tick();

    this.ticks++;
  }
  isTickRunning() {
    return this.#tickRunning;
  }
  setTickRunning(val) {
    this.#tickRunning(!!val);
  }
}

async function start() {
  const mainProcess = new Main();
  await mainProcess.init();
  await mainProcess.start();
}

start();
