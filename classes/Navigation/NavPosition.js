const Position = require("./Position");

class NavPosition extends Position {
  constructor(idx, ...args) {
    super(...args);

    this.idx = idx;
  }
}

module.exports = NavPosition;
