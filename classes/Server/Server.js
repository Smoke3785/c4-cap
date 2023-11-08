const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const routeHandler = require("./routes/index");
const EventEmitter = require("events");
const Service = require("../Service");
const Serializable = require("../Serializable");
const Position = require("../Navigation/Position");

const { polylineToLines } = require("../../functions/helpers");

const DEFAULT_PORT = 22520;

function roughMeterToLatLng(l) {
  return l / 111132.92;
}

function calculatePointNearerToDestination(
  [originLat, originLon],
  [destinationLat, destinationLon],
  nMeters
) {
  const earthRadiusMeters = 6371000; // Earth's radius in meters
  const degreesToRadians = Math.PI / 180;
  const radiansToDegrees = 180 / Math.PI;

  // Convert latitude and longitude from degrees to radians
  originLat = originLat * degreesToRadians;
  originLon = originLon * degreesToRadians;
  destinationLat = destinationLat * degreesToRadians;
  destinationLon = destinationLon * degreesToRadians;

  // Calculate the distance between the origin and destination using the Haversine formula
  const dLat = destinationLat - originLat;
  const dLon = destinationLon - originLon;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = earthRadiusMeters * c;

  // Calculate the new distance from the origin to the desired point
  const newDistanceMeters = distanceMeters - nMeters;

  // Calculate the new latitude and longitude
  const bearing = Math.atan2(
    Math.sin(dLon) * Math.cos(destinationLat),
    Math.cos(originLat) * Math.sin(destinationLat) -
      Math.sin(originLat) * Math.cos(destinationLat) * Math.cos(dLon)
  );
  let newLat = Math.asin(
    Math.sin(originLat) * Math.cos(newDistanceMeters / earthRadiusMeters) +
      Math.cos(originLat) *
        Math.sin(newDistanceMeters / earthRadiusMeters) *
        Math.cos(bearing)
  );
  let newLon =
    originLon +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(newDistanceMeters / earthRadiusMeters) *
        Math.cos(originLat),
      Math.cos(newDistanceMeters / earthRadiusMeters) -
        Math.sin(originLat) * Math.sin(newLat)
    );

  // Convert the new latitude and longitude from radians to degrees
  newLat = newLat * radiansToDegrees;
  newLon = newLon * radiansToDegrees;

  return { lat: newLat, lng: newLon };
}

// Asynchronous Server service
class Server extends Service {
  constructor(mainProcess) {
    super(mainProcess, "Server");
    this.mainProcess = mainProcess;

    this.faking = false; // TEMPORARY TESTING
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
      this.sendInitialState();

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

      const sc = 5;

      // socket.on("moveForwardFake", (responseCallback) => {
      //   if (this.faking) responseCallback("FAKING");
      //   this.faking = true;
      //   console.log("Fake requested");

      //   let currentPosition = this.getState("fakeCarPosition");
      //   let nextPoint = this.mainProcess.navigator.getNextPointCoordinates();

      //   let fakeCoordinate = calculatePointNearerToDestination(
      //     currentPosition.getVec2(),
      //     nextPoint.getVec2(),
      //     0.0000000001
      //   );

      //   this.updateState("fakeCarPosition", new Position(fakeCoordinate));

      //   console.log(fakeCoordinate);

      //   responseCallback("SUCCESS");
      //   this.faking = false;
      // });

      // Disconnect
      socket.on("up", (responseCallback) => {
        let currentPosition = this.getState("fakeCarPosition");
        currentPosition.adjustLatitude(roughMeterToLatLng(1 * sc));
        this.updateState("fakeCarPosition", currentPosition);
        responseCallback("SUCCESS");
      });
      socket.on("down", (responseCallback) => {
        let currentPosition = this.getState("fakeCarPosition");
        currentPosition.adjustLatitude(roughMeterToLatLng(-1 * sc));
        this.updateState("fakeCarPosition", currentPosition);
        responseCallback("SUCCESS");
      });
      socket.on("left", (responseCallback) => {
        let currentPosition = this.getState("fakeCarPosition");
        currentPosition.adjustLongitude(roughMeterToLatLng(-1 * sc));
        this.updateState("fakeCarPosition", currentPosition);
        responseCallback("SUCCESS");
      });
      socket.on("right", (responseCallback) => {
        let currentPosition = this.getState("fakeCarPosition");
        currentPosition.adjustLongitude(roughMeterToLatLng(1 * sc));
        this.updateState("fakeCarPosition", currentPosition);

        // let route = this.getState("currentRoute");

        // let allPoints = route.steps.map((step) => step.points).flat(1);
        // let allLines = polylineToLines(allPoints);
        // let distances = allLines.map(([p1, p2]) =>
        //   parseFloat(p1.haversineDistanceTo(p2))
        // );
        // let longestDistance = Math.max(...distances);
        // let averageDistance =
        //   distances.reduce((a, b) => a + b, 0) / distances.length;
        // let distancesExceedingTen = distances.filter((d) => d > 10).length;
        // let distancesExceedingFifteen = distances.filter((d) => d > 15).length;
        // let distancesExceedingTwenty = distances.filter((d) => d > 20).length;

        // console.log(
        //   distancesExceedingTen,
        //   distancesExceedingFifteen,
        //   distancesExceedingTwenty,
        //   longestDistance,
        //   averageDistance
        // );

        responseCallback("SUCCESS");
      });

      socket.on("disconnect", () => {
        this.log("Client device disconnected");
      });
    });
  }

  sendInitialState() {
    let registry = this.main().state.stateKeys;
    this.log(`Sending initial state to new client (${registry.length} states)`);
    registry.forEach((key) => {
      let value = this.getState(key);
      // console.log(key, value);
      this.emitStateUpdate(key, value);
    });
  }

  emitStateUpdate(key, value, timestamp = Date.now()) {
    let temp;

    // Serialize data
    if (value instanceof Serializable) {
      temp = value.serialize();
    } else {
      temp = value;
    }

    this.io.emit("stateUpdate", key, temp, timestamp);
  }

  listenForStateChange() {
    this.mainProcess.state.on("stateUpdate", (key, value, timestamp) => {
      this.emitStateUpdate(key, value);
    });
  }
}

module.exports = Server;
