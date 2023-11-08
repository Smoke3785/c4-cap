const { Client } = require("@googlemaps/google-maps-services-js");
// const { pointsToPolyline } = require("../../functions/helpers");
// import { decode, encode } from "@googlemaps/polyline-codec";
const gmpc = require("@googlemaps/polyline-codec");

const { decode, encode } = gmpc;

const EventEmitter = require("events");
const axios = require("axios");
const Service = require("../Service");
const Position = require("./Position");
const Route = require("./Route");
const fs = require("fs");
const { polylineToLines } = require("../../functions/helpers");

// This controls the logic for the turn-by-turn navigation system.
class Navigator extends Service {
  #pointDetectionRange = 10; // meters
  #recalculationGracePeriod = 5; // seconds

  constructor(mainProcess) {
    super(mainProcess, "Navigator");

    this.mainProcess = mainProcess;
    this.setTickInterval(10);

    this.navTickRunning = false;

    this.hasReachedRouteSinceCalculation = false;
    this.ticksDeviatedFromRoad = 0;
  }

  async init() {
    this.log(`Initializing navigation service`);

    // Check for API key
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      this.error(
        `No Google Maps API key found. Please set the GOOGLE_MAPS_API_KEY environment variable.`
      );
      process.exit(1);
    }
    this.client = new Client({});

    this.log(`Navigation service initialized`);
  }

  async start() {
    this.log(`Starting navigation service`);
  }

  async tick() {
    if (!this.shouldTick()) return;

    if (this.isNavigating()) {
      this.navigationTick();
    }
  }

  async recalculate() {
    let destination = this.getState("currentRoute");

    this.log(`Recalculating route to (${destination.originalInput})`);

    let { status = "UNKNOWN", data = null } = await this.getRoute(
      destination.end_address
    );

    if (status !== "SUCCESS") {
      // return responseCallback(status);
    }

    let route = new Route(data);

    this.log(`Recalculated route retrieved (${destination.originalInput})`);
    this.updateState("currentRoute", route);
    this.updateState("currentStep", 0);
    this.updateState("nextPoint", 0);

    this.hasReachedRouteSinceCalculation = false;
  }

  navigationTick() {
    if (this.navTickRunning) return;
    this.navTickRunning = true;
    let nextPointCoordinates = this.getNextPointCoordinates();
    let carPosition = this.getState("carPosition");

    // Calculate distance from road
    let distanceToRoad = carPosition.distanceToPolyline(
      polylineToLines(this.getCurrentStepObject().points)
    );

    // console.log("DISTANCE TO ROAD" + distanceToRoad);

    if (distanceToRoad > 70 && this.hasReachedRouteSinceCalculation === true) {
      if (
        this.ticksDeviatedFromRoad <
        this.#recalculationGracePeriod * (this.getTickInterval() / 1000)
      ) {
        // this.recalculate();
        this.navTickRunning = false;
        this.ticksDeviatedFromRoad = 0;
        return;
      } else {
        console.log(`Deviated from road for ${this.ticksDeviatedFromRoad}`);
        tick++;
        this.navTickRunning = false;
        return;
      }
    }

    if (distanceToRoad < 20 && this.hasReachedRouteSinceCalculation === false) {
      console.log(`CAR HAS REACHED ROAD!`);
      this.hasReachedRouteSinceCalculation = true;
    }

    // Check if car has reached next point
    if (
      nextPointCoordinates.haversineDistanceTo(carPosition) <
      this.#pointDetectionRange
    ) {
      this.log(`VEHICLE HAS HIT POINT ${nextPointCoordinates.getVec2()}`);
      if (this.atLastPoint()) {
        this.advanceStep();
      } else {
        this.advancePoint();
      }
      this.navTickRunning = false;
      return;
    }

    let nearestPoint = null;

    // console.log("failed to hit next point, checking further along this step");

    // If the car hasn't reached the next point, search the remaining points along the current step.
    let remaining = this.getRemainingPoints();

    for (let i = 0; i < remaining.length; i++) {
      let p = remaining[i];
      let _distance = p.haversineDistanceTo(carPosition);

      if (_distance < this.#pointDetectionRange) {
        if (this.isLastPoint(p.idx)) {
          this.advanceStep();
        } else {
          this.setPoint(p.idx);
        }
        this.navTickRunning = false;
        return;
      }
    }

    // If the car hasn't reached any point on the current step, check all steps within 1000m next step.
    let nearbySteps = this.getStepsBeginningWithin(1000);

    // for (let nearbyStep of nearbySteps) {
    //   for (let point of nearbyStep.points) {
    //     if (
    //       point.haversineDistanceTo(carPosition) < this.#pointDetectionRange
    //     ) {
    //       this.updateState("currentStep", nearbyStep.idx);
    //       this.updateState("nextPoint", point.idx);
    //       this.navTickRunning = false;
    //       return;
    //     }
    //   }
    // }

    // console.log(nextSteps);

    this.navTickRunning = false;
    // console.log("failed to hit any remaining points, ");
  }

  advancePoint() {
    this.updateState("nextPoint", this.getState("nextPoint") + 1);
    return;
  }

  setPoint(idx) {
    console.log("setting point");
    this.updateState("nextPoint", idx);
    return;
  }

  advanceStep() {
    throw new Error("NOT_IMPLEMENTED");
  }

  atLastPoint() {
    return this.isLastPoint(this.getState("nextPoint"));
  }

  isLastPoint(idx) {
    return idx >= this.getCurrentStepObject().getLastPointIndex();
  }

  getRemainingPoints() {
    let step = this.getCurrentStepObject();

    return step.points.slice(this.getState("nextPoint"), step.points.length);
  }

  getStepsBeginningWithin(range) {
    let route = this.getState("currentRoute");
    let steps = [];

    for (let i = 0; i < route.steps.length; i++) {
      const step = route.steps[i];
      let firstPoint = step.points[0];
      if (
        firstPoint.haversineDistanceTo(this.getState("carPosition")) < range
      ) {
        steps.push(step);
      } else {
        return steps;
      }
    }
  }

  getTraveledPoints() {
    throw new Error("NOT_IMPLEMENTED");
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

    if (status !== "SUCCESS") {
      return responseCallback(status);
    }

    let route = new Route(data);

    // console.log(route);

    this.log(`Navigation destination retrieved (${destination})`);
    this.updateState("previewRoute", route);

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

  isNavigating() {
    return this.getState("currentRoute") !== null;
  }

  getCurrentStepObject() {
    return this.getState("currentRoute").steps[this.getState("currentStep")];
  }

  getNextPointCoordinates() {
    let currentRoute = this.getState("currentRoute");
    let stepIndex = this.getState("currentStep");
    let nextPointIndex = this.getState("nextPoint");

    if ([stepIndex, nextPointIndex, currentRoute].includes(null)) return null;

    let nextPointCoordinates =
      currentRoute.steps[stepIndex].points[nextPointIndex];

    return nextPointCoordinates;
  }

  async confirmRoutePreview(responseCallback) {
    let temp = this.getState("previewRoute");

    if (!temp) {
      this.warning(`Route navigation confirmed but preview doesn't exist`);
      return responseCallback("NO_PREVIEW");
    }

    this.updateState("currentStep", 0);
    this.updateState("nextPoint", 0);
    this.updateState("currentRoute", temp);
    this.updateState("previewRoute", null);

    this.log(`Route navigation confirmed (${temp?.originalInput})`);

    return responseCallback("SUCCESS");
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
