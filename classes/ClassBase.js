const EventEmitter = require("events");
const helperFunctions = require("../functions/helpers");

// NOTE - this was a stupid idea, I need to fix this.
// This class is the basis for all others. It exposes a number of helper functions.
class ClassBase extends EventEmitter {
  constructor() {
    super();
    this.constants = {
      EARTH_RADIUS_METERS: 6371000,
      DEGREES_TO_RADIANS: Math.PI / 180,
      RADIANS_TO_DEGREES: 180 / Math.PI,
    };
  }

  //   Returns true if a value is null, undefined, or false, but false if zero.
  // Sick of writing equals signs
  falseNotZero(p) {
    if (p === 0) return false;
    return !!!p;
  }

  hasNull(...args) {
    for (let arg of args) {
      if (arg === null) return true;
    }

    return false;
  }
}

module.exports = ClassBase;
