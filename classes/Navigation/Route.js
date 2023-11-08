const Serializable = require("../Serializable");
const { route } = require("../Server/routes");
const Position = require("./Position");
const Step = require("./Step");

class Route extends Serializable {
  constructor(routeData) {
    super();
    if (!routeData) return;

    if (routeData?.sClass === "Route") {
      this.fromSerialized(routeData);
      return;
    }

    this.fromGoogleData(routeData);

    // console.log(this.distance, this.duration);
  }

  fromGoogleData(routeData) {
    this.bounds = {
      northeast: new Position(
        routeData.bounds.northeast.lat,
        routeData.bounds.northeast.lng
      ),
      southwest: new Position(
        routeData.bounds.southwest.lat,
        routeData.bounds.southwest.lng
      ),
    };

    let _route = routeData.legs[0];

    this.distance = _route.distance;
    this.duration = _route.distance;

    this.end_address = _route.startAddress;
    this.end_address = _route.end_address;

    this.warnings = _route.warnings;

    this.decodedOverviewLatLng = routeData.decodedOverviewLatLng;
    this.originalInput = routeData.originalInput;

    this.steps = _route.steps.map((step, idx) => new Step(step, idx));

    this.arrived = _route?.arrived || false;
    this.beginningTimestamp = null;
    this.arrivalTime = null;
  }
  fromSerialized(routeData) {}

  getInitialStep() {
    let temp = { ...this }.steps;
    return temp.shift();
  }

  serialize() {
    let temp = { ...this };

    temp.bounds = {
      northeast: this.bounds?.northeast?.serialize(),
      southwest: this.bounds.southwest.serialize(),
    };

    temp.steps = this.steps.map((step) => step.serialize());

    return temp;
  }
}

module.exports = Route;
