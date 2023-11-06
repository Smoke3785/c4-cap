// This has the ability to query the speed limit from the Google Maps API
// It may make sense to do this calculation offline, if possible.
class SpeedLimit extends Service {
  constructor(mainProcess) {
    super(mainProcess, "SpeedLimit");

    //
    // this.setTickInterval(1000 * 60 * 5);
  }
}

module.exports = SpeedLimit;
