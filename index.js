// ENV
require('dotenv').config();

const Arduino = require('./classes/Arduino');
const State = require('./classes/State');
const Server = require('./classes/Server/Server');
const Navigator = require('./classes/Navigation/Navigator');
const Location = require('./classes/Navigation/Location');
const Logger = require('./classes/Logger');

class Main {
  #tickIntervalMs = 1;
  #tickRunning = false;
  constructor() {
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
    this.logger.log('Main', 'standard', ...args);
  }

  warning(...args) {
    this.logger.log('Main', 'warning', ...args);
  }

  error(...args) {
    this.logger.log('Main', 'error', ...args);
  }

  async init() {
    this.logger.welcome();

    this.log(`Initializing main process`);

    // Construct
    this.arduino = new Arduino(this);
    this.state = new State(this);
    this.server = new Server(this);
    this.navigator = new Navigator(this);
    this.location = new Location(this);

    // Initialize
    await this.state.init();
    await this.arduino.init();
    await this.server.init();
    await this.navigator.init();
    await this.location.init();
  }

  start() {
    this.tickInterval = setInterval(() => this.tick(), this.#tickIntervalMs);
    this.arduino.start();
    this.server.start();
    this.state.start();
    this.navigator.start();
    this.location.start();

    // Send initial state
    this.server.sendInitialState();
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
