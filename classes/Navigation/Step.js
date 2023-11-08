const { polylineToLines } = require("../../functions/helpers");
const Serializable = require("../Serializable");
const NavPosition = require("./NavPosition");
const Position = require("./Position");

class Step extends Serializable {
  constructor(stepData, idx) {
    super();

    if (stepData.sClass == "Step") {
      return this.fromSerialized(stepData);
    }

    this.fromGoogleData(stepData, idx);
  }

  fromGoogleData(stepData, idx) {
    this.distance = stepData.distance;
    this.duration = stepData.duration;
    this.end_location = new Position(stepData.end_location);
    this.start_location = new Position(stepData.start_location);
    this.html_instructions = stepData.html_instructions;
    this.maneuver = stepData.maneuver;

    if (idx === undefined || idx === null) {
      throw new Error(
        `Step was constructed without reference to original idx: ${idx}`
      );
    }

    this.idx = idx;

    let classifiedPoints = stepData.path.map((point, idx) => {
      return new NavPosition(idx, point);
    });

    this.points = classifiedPoints;
    this.longestDistanceBetweenPoints =
      this.calculateLongestDistanceBetweenPoints();
  }

  calculateLongestDistanceBetweenPoints() {
    let lines = polylineToLines(this.points);

    let distances = lines.map(([p1, p2]) => p1.haversineDistanceTo(p2));

    return Math.max(...distances);
  }

  serialize() {
    let temp = { ...this };
    temp.points = this.points.map((point) => point.serialize());

    return temp;
  }

  getLastPointIndex() {
    return this.points.length - 1;
  }
}

module.exports = Step;
