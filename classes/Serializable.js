class Serializable {
  constructor() {}
  serialize() {
    return JSON.stringify(this);
  }
}

module.exports = Serializable;
