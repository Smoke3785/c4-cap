const Position = require("./Position");
const Service = require("../Service");

// This service polls the GPS module to determine the current location of
// the vehicle and updates the server state to match.

// I will need to integrate a compass into this as well
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
    // Get current value from GPS module
    let [lat, long] = this.getPositionFromGPS();
    this.updatePositionState(lat, long);
  }

  updatePositionState(lat, long) {
    this.updateState("carPosition", new Position(lat, long));
  }

  getPositionFromGPS() {
    let lat = 41.11038;
    let long = -78.69994;

    return [lat, long];
  }
}

module.exports = Location;
