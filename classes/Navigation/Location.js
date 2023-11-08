const Position = require("./Position");
const Service = require("../Service");

// This service polls the GPS module to determine the current location of
// the vehicle and updates the server state to match.

// I will need to integrate a compass into this as well

const TESTING = true;

class Location extends Service {
  constructor(mainProcess) {
    super(mainProcess, "Location");

    // Will update position 4 times per second
    this.setTickInterval(250);
  }

  async init() {
    // Establish connection with GPS module
  }

  async tick() {
    if (!this.shouldTick()) return;
    if (TESTING) {
      this.updatePositionState(this.getState("fakeCarPosition"));
      return;
    }

    // Get current value from GPS module
    let [lat, lng] = this.getPositionFromGPS();
    this.updatePositionState(lat, lng);
  }

  updatePositionState(lat, lng) {
    if (lat instanceof Position) {
      this.updateState("carPosition", lat);
      return;
    }
    this.updateState("carPosition", new Position(lat, lng));
  }

  getPositionFromGPS() {
    let lat = 41.11038;
    let lng = -78.69994;

    return [lat, lng];
  }
}

module.exports = Location;
