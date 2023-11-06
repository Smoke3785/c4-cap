const { Client } = require("@googlemaps/google-maps-services-js");
// import { decode, encode } from "@googlemaps/polyline-codec";
const gmpc = require("@googlemaps/polyline-codec");

const { decode, encode } = gmpc;

const EventEmitter = require("events");
const axios = require("axios");
const Service = require("../Service");
const Position = require("./Position");
const fs = require("fs");

// This controls the logic for the turn-by-turn navigation system.
class Navigator extends Service {
  constructor(mainProcess) {
    super(mainProcess, "Navigator");

    this.mainProcess = mainProcess;
    this.setTickInterval(1000);
  }

  async init() {
    this.log(`Initializing navigation service`);

    this.client = new Client({});

    this.log(`Navigation service initialized`);
  }

  async start() {
    this.log(`Starting navigation service`);
  }

  async tick() {
    if (!this.shouldTick()) return;
  }

  async getRoute(destination) {
    this.log(`Attempting to fetch route (${destination})`);

    const result = {
      status: "UNKNOWN",
      data: null,
    };

    let originalDestination = `${destination}`;

    if (Array.isArray(destination)) {
      destination = new Position(destination).serialize();
    }

    const oPos = this.getState("carPosition");

    let response;

    try {
      response = await this.client.directions({
        params: {
          origin: oPos.serialize(),
          destination,
          travelMode: "DRIVING",
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: "bestguess",
          },
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
        timeout: 10000,
      });
    } catch (e) {
      if (e?.code) result.status = e.code;
      this.warning(`Failed to fetch route (${destination}): ${result.status}`);
      return result;
    }

    // This doesn't throw an error, but is still a failure.
    if (["ZERO_RESULTS"].includes(response.data.status)) {
      result.status = response.data.status;
      this.warning(`Failed to fetch route (${destination}): ${result.status}`);
      return result;
    }

    result.status = "SUCCESS";

    const route = response.data.routes[0];
    let decodedRoute = this.decodeRoutePolylines(route);

    // Store original request
    decodedRoute.originalInput = originalDestination;
    result.data = decodedRoute;

    return result;
  }

  async getRoutePreview(destination, responseCallback) {
    this.log(`Navigation destination requested (${destination})`);

    let { status = "UNKNOWN", data = null } = await this.getRoute(destination);

    if (status === "SUCCESS") {
      this.log(`Navigation destination retrieved (${destination})`);
      this.updateState("previewRoute", data);
    }

    responseCallback(status);
  }

  clearRoutePreview(responseCallback) {
    let preview = this.getState("previewRoute");

    if (preview === null) {
      this.warning(`Route preview cancelled but preview doesn't exist`);
      return responseCallback("SUCCESS");
    }

    let destination = preview?.originalInput;

    this.log(`Route preview cancelled (${destination})`);

    this.updateState("previewRoute", null);

    return responseCallback("SUCCESS");
  }

  async confirmRoutePreview(responseCallback) {
    return responseCallback("NOT_IMPLIMENTED");
  }

  // Decodes polylines into coordinate points to allow the system to track
  // the car's progress along a given "step" - this needs optimized
  decodeRoutePolylines(route) {
    let temp = { ...route };

    function dpa(xa) {
      return xa.map(([lat, lng]) => ({
        lat,
        lng,
      }));
    }

    let dop = decode(temp.overview_polyline.points);

    temp.decodedOverview = dop;
    temp.decodedOverviewLatLng = dpa(dop);

    let legs = route.legs.map((leg) => {
      return {
        ...leg,
        steps: leg.steps.map((step) => {
          let pathArray = decode(step.polyline.points);

          return {
            ...step,
            path: pathArray,
            latLng: dpa(pathArray),
          };
        }),
      };
    });

    return {
      ...temp,
      legs,
    };
  }

  async stop() {}
}

module.exports = Navigator;
