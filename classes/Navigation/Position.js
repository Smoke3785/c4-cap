const Serializable = require("../Serializable");
const { vectorMath } = require("../../functions/helpers");

// Basically a Vec3
class Position extends Serializable {
  #elevation = null;

  constructor(lat, lng, elevation) {
    super();

    this.latitude;
    this.longitude;

    if (Array.isArray(lat)) {
      this.build(...lat);
      return;
    }

    if (lat?.lat && lat?.lng) {
      this.build(lat?.lat, lat?.lng, lat?.elevation);
      return;
    }

    this.build(lat, lng, elevation);
  }
  build(lat, lng, elevation) {
    if (!this.isValid(lat)) {
      throw new Error(`Missing or malformed latitude ${lat}`);
    }
    if (!this.isValid(lng)) {
      throw new Error(`Missing or malformed longitude ${lng}`);
    }
    if (elevation !== undefined && this.isValid(elevation)) {
      throw new Error(`Malformed elevation ${elevation}`);
    }

    this.latitude = lat;
    this.longitude = lng;

    if (elevation) {
      this.#elevation = elevation;
    }
  }
  getLatitude() {
    return this.latitude;
  }
  setLatitude(v) {
    if (!this.isValid(v)) {
      throw new Error("Missing or malformed latitude");
    }
    this.latitude = v;
  }
  getLongitude() {
    return this.longitude;
  }
  setLongitude(v) {
    if (!this.isValid(v)) {
      throw new Error("Missing or malformed longitude");
    }
    this.latitude = v;
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

  adjustLongitude(v) {
    this.longitude += v;
  }

  adjustLatitude(v) {
    this.latitude += v;
  }

  isValid(n) {
    return typeof n === "number";
  }

  addName(name) {
    this.name = name;
  }

  getVec2() {
    return [this.getLatitude(), this.getLongitude()];
  }

  getVec3() {
    return [this.getLatitude(), this.getLongitude(), this.getElevation()];
  }

  // Serialization
  serialize() {
    return { lat: this.getLatitude(), lng: this.getLongitude() };
  }

  distanceTo(pos2) {
    throw new Error("NOT_IMPLIMENTED");
  }

  distanceToPolyline(polyline) {
    return Math.min(
      ...polyline.map(([p1, p2]) =>
        this.distanceToLine([p1.getVec2(), p2.getVec2()])
      )
    );
  }

  distanceToLine([[x1, y1], [x2, y2]]) {
    const [x, y] = this.getVec2();

    // Calculate the vector from the start of the line to the given point
    const v1 = { x: x - x1, y: y - y1 };

    // Calculate the vector along the line
    const v2 = { x: x2 - x1, y: y2 - y1 };

    // Calculate the dot product of v1 and v2
    const dot = v1.x * v2.x + v1.y * v2.y;

    // Calculate the squared magnitude of v2
    const mag2 = v2.x * v2.x + v2.y * v2.y;

    // Calculate the parameter t for the closest point on the line
    const t = Math.min(1, Math.max(0, dot / mag2));

    // Calculate the closest point on the line
    const closestX = x1 + t * v2.x;
    const closestY = y1 + t * v2.y;

    // Calculate the distance between the given point and the closest point
    // const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);

    const distance = new Position(x, y).haversineDistanceTo(
      new Position(closestX, closestY)
    );

    return distance;
  }

  haversineDistanceTo(pos2) {
    let distance = vectorMath.haversineDistance(this.getVec2(), pos2.getVec2());

    return distance;
  }
}

module.exports = Position;
