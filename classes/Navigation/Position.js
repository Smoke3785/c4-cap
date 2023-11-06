const Serializable = require("../Serializable");

// Basically a Vec3
class Position extends Serializable {
  #latitude;
  #longitude;
  #elevation = null;

  constructor(lat, long, elevation) {
    super();

    if (Array.isArray(lat)) {
      let [t1, t2, t3] = lat;
      lat = t1;
      long = t2;
      elevation = t3;
    }

    if (!this.isValid(lat)) {
      throw new Error("Missing or malformed latitude");
    }
    if (!this.isValid(long)) {
      throw new Error("Missing or malformed longitude");
    }
    if (elevation !== undefined && this.isValid(elevation)) {
      throw new Error("Malformed elevation");
    }

    this.#latitude = lat;
    this.#longitude = long;

    if (elevation) {
      this.#elevation = elevation;
    }
  }

  getLatitude() {
    return this.#latitude;
  }
  setLatitude(v) {
    if (!this.isValid(v)) {
      throw new Error("Missing or malformed latitude");
    }
    this.#latitude = v;
  }
  getLongitude() {
    return this.#longitude;
  }
  setLongitude(v) {
    if (!this.isValid(v)) {
      throw new Error("Missing or malformed longitude");
    }
    this.#latitude = v;
  }
  getElevation() {
    return this.#elevation;
  }
  setElevation(v) {
    if (!this.isValid(v)) {
      throw new Error("Missing or malformed elevation");
    }
    this.#elevation = v;
  }

  isValid(n) {
    return typeof n === "number";
  }

  //   Serialization
  serialize() {
    return [this.getLatitude(), this.getLongitude()];
  }
}

module.exports = Position;
