class Serializable {
  constructor() {}
  serialize() {
    // let temp = this;
    // let keys = Object.keys(temp)

    // for(let i = 0; i < keys.length; i++) {
    //   let object = temp
    // }

    return JSON.stringify(this);
  }
  fromSerialized(serialized) {
    return JSON.parse(serialized);
  }
}

module.exports = Serializable;
