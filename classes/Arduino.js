var five = require('johnny-five');
const { timeout } = require('../utils');
const Service = require('./Service');
const capcon = require('capture-console');

const TEST_WITHOUT_BOARD = true;

// Asynchronous Arduino service
class Arduino extends Service {
  #connectionRestoreAttemptsMax = 5;

  //   ===========
  // SENSOR VALUES
  //   ===========

  //   Potentiometer
  #potentiometer;

  constructor(mainProcess) {
    super(mainProcess, 'Arduino');
    this.mainProcess = mainProcess;
    this.board = null;

    this.initialConnectionAttempts = 0;

    // Potentiometer value
  }

  async connectToBoard() {
    // For some reason I can't catch the stdout so I need to do this goofy nonsense
    let s = [];
    let t = console.log;
    console.log = (...args) => {
      s.push(args);
    };

    const fl = () => {
      console.log = t;
      console.log('');

      s.forEach((a) => {
        this.mainProcess.logger.log('johnny-5', 'standard', ...a);
      });

      console.log('>>');
    };

    const connectionPromise = new Promise(async (resolve, reject) => {
      let _board = new five.Board();

      _board.on('ready', () => {
        this.board = _board;
        fl();
        resolve();
      });
    });

    await timeout(connectionPromise, 3000).catch(async (e) => {
      fl();
      if (TEST_WITHOUT_BOARD) {
        return this.warning(`Critical failure to connect to Arduino`);
      }
      throw new Error(`Critical failure to connect to Arduino`);
    });

    return;
  }

  async init() {
    this.log(`Initializing Arduino process`);
    this.log(`Connecting to arduino`);

    await this.connectToBoard();

    this.log(`Connected to arduino`);
    this.log(`Arduino process initialized`);
  }

  start() {
    this.log(`Starting Arduino process`);
    this.listenForDisconnect();
    this.listenOnPorts();
    this.fakeSensorInput();
  }

  fakeSensorInput() {
    // 1) y = (sin(x) + 1) / 2
    // 2) y = sin(x)/4 + 1/4

    function rn(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Acceleration time in ms
    let aMs = 6000;
    // Braking time in ms
    let bMs = 3000;

    // let maxSpeed = 120;

    let i = 0;
    // Accellerating?
    let a = true;

    const aPerMs = setInterval(() => {
      let rad = Math.sin(i);
      let p = (rad + 1) / 2;
      let n = Math.round(1023 * p);
      // this.log(n, { a });
      this.mainProcess.state.updateState('fakeSpeed', n, new Date().getTime());
      if (n === 1023) {
        a = false;
        // Recalc time
        aMs = rn(4000, 10000);
      }
      if (n === 0) {
        a = true;
        aMs = rn(2000, 13000);
      }
      i = i + (a ? 2 / aMs : 2 / bMs);
    }, 1);
  }

  listenForDisconnect() {
    if (this.board == null) return;
    this.board.on('close', (event) => {
      this.board = null;
      this.log(`Board has disconnected!`);

      // this.restore();
      this.owner.stop();
    });
  }

  // async restore() {
  //   this.log(`Attempting to restore connection...`);
  //   await this.connectToBoard();

  //   if (this.board == null) {
  //     this.owner.stop();
  //   }
  // }

  listenOnPorts() {
    this.log(`Listening on analogue ports`);

    if (this.board === null) {
      this.log(`Cannot listen on analogue ports - board disconnected!`);
      return;
    }

    var resistor33 = new five.Sensor('A0');

    // Scale the sensor's data from 0-1023 to 0-10 and log changes
    resistor33.on('change', () => {
      if (this.board === null) return;
      let value = resistor33.scaleTo(0, 1023);

      // Invert to match direction
      // let v = Math.abs(value - 1023);

      // this.log(value);
      this.mainProcess.state.updateState(
        'resistor33',
        value,
        performance.now()
      );
    });
  }

  //   States
  updatePotentiometerValue() {}
}

module.exports = Arduino;
