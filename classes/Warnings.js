const EventEmitter = require("events");
const Service = require("./Service");

class Warnings extends Service {
  #warnings = [];
  constructor(mainProcess) {
    super(mainProcess, "Warnings");

    this.mainProcess = mainProcess;
  }

  async init() {}

  async start() {}

  async stop() {}

  addWarning() {}

  getWarnings() {}

  clearWarning() {}
}

module.exports = Warnings;
