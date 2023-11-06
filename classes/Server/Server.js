const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const routeHandler = require("./routes/index");
const EventEmitter = require("events");
const Service = require("../Service");
const Serializable = require("../Serializable");

const DEFAULT_PORT = 22520;

// Asynchronous Server service
class Server extends Service {
  constructor(mainProcess) {
    super(mainProcess, "Server");
    this.mainProcess = mainProcess;
  }
  async init() {
    this.log(`Initializing Server process`);

    // Initialize server
    this.app = express();
    this.app.use(routeHandler);
    this.server = http.createServer(this.app);

    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
      },
    });

    this.log(`Server process initialized`);
  }
  async start() {
    this.log(`Starting Server process`);

    this.server.listen(DEFAULT_PORT, () =>
      this.log(`Listening on port ${DEFAULT_PORT}`)
    );

    this.listenForClientComms();
    this.listenForStateChange();
  }

  listenForClientComms() {
    this.io.on("connection", (socket) => {
      this.log("Client device connected");

      // Event handlers
      socket.on("requestRoutePreview", (destination, responseCallback) => {
        this.mainProcess.navigator.getRoutePreview(
          destination,
          responseCallback
        );
      });

      socket.on("clearRoutePreview", (responseCallback) => {
        this.mainProcess.navigator.clearRoutePreview(responseCallback);
      });

      socket.on("confirmRoutePreview", (responseCallback) => {
        this.mainProcess.navigator.confirmRoutePreview(responseCallback);
      });

      socket.on("requestStateRefresh", () => {
        this.sendInitialState();
      });

      // Disconnect
      socket.on("disconnect", () => {
        this.log("Client device disconnected");
      });
    });
  }

  sendInitialState() {
    let registry = this.main().state.stateKeys;
    registry.forEach((key) => {
      let value = this.getState(key);

      this.io.emit("stateUpdate", key, value);
    });
  }

  listenForStateChange() {
    this.mainProcess.state.on("stateUpdate", (key, value, timestamp) => {
      // Serialize data
      if (value instanceof Serializable) {
        value = value.serialize();
      }

      this.io.emit("stateUpdate", key, value, timestamp);
    });
  }
}

module.exports = Server;
