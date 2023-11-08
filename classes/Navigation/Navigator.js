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
  #destinationPointDetectionRange = 25; // meters
  #recalculationRange = 50; // meters
  #recalculationGracePeriod; // seconds
  #stepLookAhead = 5;
  #navTickRunning;
  #verboseLogging = false;

  constructor(mainProcess) {
    super(mainProcess, "Navigator");

    this.mainProcess = mainProcess;
    this.setTickInterval(10);
    this.#recalculationGracePeriod = this.secondsToTicks(5);

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
    this.updateState("calculating", true);

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

    // NOTE: Must calculate the car's distance from the entry point of this route
    // so that if we detect that the car has deviated dramatically from the new course
    // we can recalculate.
    // this.distanceFromFirstPointOnCalcluation;

    this.updateState("calculating", false);

    this.hasReachedRouteSinceCalculation = false;
  }

  set navTickRunning(v) {
    if (!this.#verboseLogging) {
      return (this.#navTickRunning = v);
    }
    if (v === true) {
      this.navTickStart = performance.now();
    } else {
      console.log(
        `Finished navTick calculations in ${parseFloat(
          performance.now() - this.navTickStart
        ).toFixed(2)}ms`
      );
    }

    this.#navTickRunning = v;
  }

  get navTickRunning() {
    return this.#navTickRunning;
  }

  get currentRoute() {
    return this.getState("currentRoute");
  }

  get currentStep() {
    return this.getState("currentStep");
  }

  get currentStepObject() {
    return this.currentRoute.steps[this.currentStep];
  }

  get nextPoint() {
    return this.getState("nextPoint");
  }

  get nextPointCoordinates() {
    return this.currentStepObject.points[this.nextPoint];
  }

  get lastStep() {
    return this.currentRoute.steps.length - 1;
  }

  get lastStepObject() {
    return this.currentRoute.steps[this.lastStep];
  }

  get lastPoint() {
    return this.lastStepObject.points.length - 1;
  }

  get lastPointObject() {
    return this.lastStepObject.points[this.lastPoint];
  }

  get distanceToDestination() {
    return this.carPosition.haversineDistanceTo(this.lastPointObject);
  }

  get atDestination() {
    return this.currentRoute.arrived === true;
  }

  onArrival() {
    this.log(
      `Arrived at destination (${this.currentRoute.originalInput}) in ${
        Date.now() - this.currentRoute.beginningTimestamp
      }ms`
    );
  }

  navigationTick() {
    // Lockout multiple navigation ticks from running at once - is this even possible?
    if (this.navTickRunning) return;
    // Don't try navigating while recalculating
    if (this.isCalculating()) return;
    // Don't bother navigating once already arrived. Client will need to clear navigation. (?)
    if (this.atDestination) return;

    this.navTickRunning = true;

    let nextPointCoordinates = this.nextPointCoordinates;
    let carPosition = this.getState("carPosition");

    // First, calculate if target is at his destination.
    if (this.distanceToDestination <= this.#destinationPointDetectionRange) {
      let route = this.currentRoute;
      route.arrived = true;
      this.updateState("currentRoute", route);
      this.navTickRunning = false;
      this.onArrival();
      return;
    }

    // Calculate distance from road
    let distanceToRoad = this.getDistanceToRoad();

    // NOTE: Must calculate distance to final destination as well!
    // Check to see if the car is within 20m of the route
    if (distanceToRoad < 20 && this.hasReachedRouteSinceCalculation === false) {
      // If the car is within 20m of a new route for the first time, set hasReachedRouteSinceCalculation to true.
      this.log(`Car has reached navigation route`);
      this.hasReachedRouteSinceCalculation = true;
    }

    // If the driver hasn't gotten within 20m of the route, check to see if he is now
    if (this.hasReachedRouteSinceCalculation === false) {
      this.navTickRunning = false;
      return;
    }

    // If the distance to the current step or next step is > 70
    // NOTE - THIS SHOULD ALSO CHECK TO SEE IF THE CAR IS DRIVING BACKWARDS
    // Case: the car is within 70m of the current *step* but getting further away from the next *point*
    // this.isCarDeviatingFromPath();
    if (distanceToRoad > this.#recalculationRange) {
      // If the car has been this far from the road for n ticks, recalculate
      if (this.ticksDeviatedFromRoad >= this.#recalculationGracePeriod) {
        this.recalculate();
        this.navTickRunning = false;
        this.ticksDeviatedFromRoad = 0;
        return;
      }

      // Otherwise, increment ticksDeviatedFromRoad;
      let timeRemaining = this.ticksToSeconds(
        this.#recalculationGracePeriod - this.ticksDeviatedFromRoad
      );

      if (!(timeRemaining % 1)) {
        this.warning(
          `Car is more than ${
            this.#recalculationRange
          }m from path. Recalculating in ${timeRemaining}s`
        );
      }

      this.ticksDeviatedFromRoad++;
      this.navTickRunning = false;
      return;
    } else {
      // If the car is within 70m, reset the recalculation timer
      this.ticksDeviatedFromRoad = 0;
    }

    // Iterate over points in the current step. If the vehicle has reached that point, set the next point.
    for (let point of this.getCurrentStepObject().points) {
      if (point.haversineDistanceTo(carPosition) < this.#pointDetectionRange) {
        if (point.idx !== this.getState("nextPoint") - 1) {
          this.log(
            `VEHICLE HAS HIT POINT ON CURRENT STEP ${nextPointCoordinates.getVec2()}`
          );
          this.setPoint(point.idx + 1);
        }
        break;
      }
    }

    // Assuming there were no points within detectionRange in the current step,
    // check the next step. If the car is determined to be along the next step,
    // set the currentStep *and* the currentPoint
    stepLoop: for (let i = 1; i < this.#stepLookAhead + 1; i++) {
      let nextStepIndex = this.getState("currentStep") + i;
      if (nextStepIndex >= this.getState("currentRoute").steps.length) {
        break;
      }
      let nextStep = this.getStepObject(nextStepIndex);

      for (let point of nextStep.points) {
        if (
          point.haversineDistanceTo(carPosition) < this.#pointDetectionRange
        ) {
          this.log(`VEHICLE HAS HIT POINT ON NEXT STEP ${point.getVec2()}`);
          this.setStep(nextStep.idx);
          this.setPoint(point.idx + 1);
          break stepLoop;
        }
      }
    }

    this.navTickRunning = false;
  }

  advancePoint() {
    throw new Error("DEPRECATED");
    this.updateState("nextPoint", this.getState("nextPoint") + 1);
    return;
  }

  // NOTE: This will have to check to see if the car is at the last point on a step.
  setPoint(idx) {
    // console.log(`setting point ${idx}`);
    this.updateState("nextPoint", idx);
    return;
  }

  // NOTE: This will have to check to see if the car is at the last step on a route.
  setStep(idx) {
    // console.log(`setting step ${idx}`);
    this.updateState("currentStep", idx);
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

  isCalculating() {
    return this.getState("calculating");
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
    this.updateState("calculating", true);
    let { status = "UNKNOWN", data = null } = await this.getRoute(destination);

    if (status !== "SUCCESS") {
      this.updateState("calculating", false);
      return responseCallback(status);
    }

    let route = new Route(data);

    this.log(`Navigation destination retrieved (${destination})`);
    this.updateState("previewRoute", route);

    this.updateState("calculating", false);
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
    return this.getStepObject(this.getState("currentStep"));
  }

  getNextStepObject() {
    return this.getStepObject(this.getState("currentStep") + 1);
  }

  getStepObject(idx) {
    if (this.falseNotZero(idx)) {
      throw new Error(`Attempted to retrieve stepObject without idx: ${idx}`);
    }

    let step = this.getState("currentRoute").steps[idx];
    if (!step) {
      throw new Error(`Tried to access non-existant step ${idx}`);
    }

    return step;
  }

  // NOTE - There may be some edge cases where this does a funny
  getNextPointCoordinates() {
    let currentRoute = this.getState("currentRoute");
    let stepIndex = this.getState("currentStep");
    let nextPointIndex = this.getState("nextPoint");

    // console.log({ currentRoute, nextPointIndex, currentRoute });
    if (this.hasNull(stepIndex, nextPointIndex, currentRoute)) return null;

    let nextPointCoordinates =
      currentRoute.steps[stepIndex].points[nextPointIndex];
    // console.log({ nextPointCoordinates });

    return nextPointCoordinates;
  }

  // This returns the distance from the nearest point on the currentStep and the nextStep
  getDistanceToRoad(lookAhead = this.#stepLookAhead) {
    let distances = [];

    let currentStepIdx = this.getState("currentStep");

    for (let i = 0; i < lookAhead + 1; i++) {
      let stepIdx = currentStepIdx + i;
      if (stepIdx >= this.getState("currentRoute").steps.length) {
        break;
      }
      distances.push(this.getDistanceToStep(stepIdx));
    }

    return Math.min(...distances);
  }

  getDistanceToStep(idx) {
    let step = this.getStepObject(idx);
    let polyline = polylineToLines(step.points);

    let distance = this.carPosition.distanceToPolyline(polyline);

    return distance;
  }

  // NOTE: I'm toying with using this syntax for getters.
  // NOTE: I may create getters for all relevant states.
  get carPosition() {
    return this.getState("carPosition");
  }

  getDistanceToCurrentStep() {
    return this.carPosition.distanceToPolyline(
      polylineToLines(this.getCurrentStepObject().points)
    );
  }

  getDistanceToNextStep() {
    return this.carPosition.distanceToPolyline(
      polylineToLines(this.getNextStepObject().points)
    );
  }

  async confirmRoutePreview(responseCallback) {
    let temp = this.getState("previewRoute");

    temp.beginningTimestamp = Date.now();

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
        steps: leg.steps.map((step, idx) => {
          let path = decode(step.polyline.points);

          // Add the car's current position as the first point in the first path
          if (idx === 0) {
            let interpolatedCoordinates =
              this.carPosition.interpolateCoordinates(new Position(path[0]));

            path = [
              ...interpolatedCoordinates.map((i) => i.getVec2()),
              ...path,
            ];
          }

          return {
            ...step,
            path,
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
