const { EventEmitter } = require("events");
const Service = require("./Service");
const Position = require("./Navigation/Position");
const Serializable = require("./Serializable");

// This object stores the state for all constituent devices
// Asynchronous service
class State extends Service {
  #tickInterval = null;
  constructor(mainProcess) {
    super(mainProcess, "State");
    this.mainProcess = mainProcess;

    this.stateKeys = [];
    // Actual state store
    // this.resistor33 = 0; // Value of Arduino test resistor
  }

  registerDefaultStates() {
    // Arduino state
    this.registerState("resistor33", 0);
    this.registerState("fakeSpeed", 0);

    // Location state
    this.registerState("carPosition", new Position(0, 0));

    // Navigation state
    this.registerState("previewRoute", null);
    this.registerState("currentRoute", null);
    this.registerState("currentStep", null);
  }

  registerState(key, defaultValue = null) {
    this.stateKeys.push(key);
    this[key] = defaultValue;
  }

  async init() {
    this.log(`Initializing State service`);
    this.registerDefaultStates();
    this.log(`State service initialized `);
  }
  async start() {}

  async tick() {}

  isSameValue(v1, v2) {
    if (v1 === null || v2 === null) {
      return v1 === v2;
    }

    if (v1 instanceof Serializable) {
      v1 = v1.serialize();
    }

    if (v2 instanceof Serializable) {
      v2 = v2.serialize();
    }

    if (typeof v1 !== typeof v2) {
      return false;
    }

    if (typeof v1 === "object") {
      if (Array.isArray(v1) && Array.isArray(v2)) {
        if (v1.length !== v2.length) {
          return false;
        }

        for (let i = 0; i < v1.length; i++) {
          if (!this.isSameValue(v1[i], v2[i])) {
            return false;
          }
        }
      } else {
        const keys1 = Object.keys(v1);
        const keys2 = Object.keys(v2);

        if (keys1.length !== keys2.length) {
          return false;
        }

        for (const key of keys1) {
          if (!keys2.includes(key) || !this.isSameValue(v1[key], v2[key])) {
            return false;
          }
        }
      }

      return true;
    }

    return v1 === v2;
  }

  updateState(key, value, timestamp) {
    if (this[key] === undefined) {
      throw new Error(`Tried to update un-initialized state ${key}`);
    }

    // if (this.isSameValue(this[key], value)) return;

    this[key] = value;
    this.emit("stateUpdate", key, value, timestamp);
  }

  getState(key) {
    if (this[key] === undefined) {
      throw new Error(`Tried to get un-initialized state ${key}`);
    }

    return this[key];
  }
}

module.exports = State;
