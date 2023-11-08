const ClassBase = require("./ClassBase");

class Serializable extends ClassBase {
  constructor() {
    super();
  }
  serialize() {
    return JSON.stringify(this);
  }
  fromSerialized(serialized) {
    return JSON.parse(serialized);
  }
}

module.exports = Serializable;
