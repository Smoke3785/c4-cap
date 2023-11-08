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

  // NOTE - this is also the Haversine formula, I must refactor.
  distanceTo(pos2) {
    let [[lat1, lng1], [lat2, lng2]] = [this.getVec2(), pos2.getVec2()];

    const lat1Rad = lat1 * this.constants.DEGREES_TO_RADIANS;
    const lng1Rad = lng1 * this.constants.DEGREES_TO_RADIANS;
    const lat2Rad = lat2 * this.constants.DEGREES_TO_RADIANS;
    const lng2Rad = lng2 * this.constants.DEGREES_TO_RADIANS;

    const dLat = lat2Rad - lat1Rad;
    const dLng = lng2Rad - lng1Rad;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceMeters = this.constants.EARTH_RADIUS_METERS * c;

    return distanceMeters;
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

    // If the line doesn't have a length, the function won't work.
    // If the start and end of the line are the same, simply return the distance from the point.
    if (x1 === x2 && y1 === y2) {
      return this.haversineDistanceTo(new Position(x1, x2));
    }

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
    const distance = this.haversineDistanceTo(new Position(closestX, closestY));

    return distance;
  }

  haversineDistanceTo(pos2) {
    let distance = vectorMath.haversineDistance(this.getVec2(), pos2.getVec2());

    return distance;
  }

  // NOTE - This doesn't really work correctly.
  interpolateCoordinates(pos2, spacingMeters = 10) {
    let [[lat1, lng1], [lat2, lng2]] = [this.getVec2(), pos2.getVec2()];

    // Calculate the initial and final azimuth
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const distance = this.haversineDistanceTo(pos2);

    const coordinates = [this];

    let distanceAlongPath = spacingMeters;

    while (distanceAlongPath < distance) {
      const lat =
        lat1 +
        (distanceAlongPath / this.constants.EARTH_RADIUS_METERS) *
          this.constants.RADIANS_TO_DEGREES;
      const lng =
        lng1 +
        ((distanceAlongPath / this.constants.EARTH_RADIUS_METERS) *
          this.constants.RADIANS_TO_DEGREES) /
          Math.cos(lat1 * this.constants.DEGREES_TO_RADIANS);

      coordinates.push(new Position(lat, lng));

      distanceAlongPath += spacingMeters;
    }

    coordinates[coordinates.length - 1] = pos2;

    return coordinates;
  }
}

module.exports = Position;
