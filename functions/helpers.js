function convert(...args) {
  return args.map((n) => {
    if (Array.isArray(n)) {
      return n;
    }
    if (n?.lat && n?.lng) {
      return [n?.lat, n?.lng];
    }
  });
}

// Given two vectors, calculate the distance between them
function distance(_a, _b) {
  let [a, b] = convert(_a, _b);
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}
// Get the midpoint between two vectors
function midpoint(_a, _b) {
  let [a, b] = convert(_a, _b);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
// Get the angle between two vectors
function angle(_a, _b) {
  let [a, b] = convert(_a, _b);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

// Get the vector between two vectors
function vector(_a, _b) {
  let [a, b] = convert(_a, _b);
  return [b[0] - a[0], b[1] - a[1]];
}

// Get the magnitude of a vector
function magnitude(_a) {
  let [a] = convert(_a);
  return Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2));
}

// Get the unit vector of a vector
function unit(_a) {
  let [a] = convert(_a);
  return [a[0] / magnitude(a), a[1] / magnitude(a)];
}

// Get the dot product of two vectors
function dot(_a, _b) {
  let [a, b] = convert(_a, _b);
  return a[0] * b[0] + a[1] * b[1];
}

// Get the cross product of two vectors
function cross(_a, _b) {
  let [a, b] = convert(_a, _b);
  return a[0] * b[1] - a[1] * b[0];
}

// Get the projection of a onto b
function projection(_a, _b) {
  let [a, b] = convert(_a, _b);
  return dot(a, b) / magnitude(b);
}

function haversineDistance(_a, _b, unit = "m") {
  let [[lat1, lon1], [lat2, lon2]] = convert(_a, _b);

  if (lat1 === lat2 && lon1 === lon2) {
    return 0; // The two points are the same, so the distance is zero.
  }

  const earthRadiusMiles = 3959; // Earth's radius in miles
  const degreesToRadians = Math.PI / 180;

  // Convert latitude and longitude from degrees to radians
  const lat1Rad = lat1 * degreesToRadians;
  const lon1Rad = lon1 * degreesToRadians;
  const lat2Rad = lat2 * degreesToRadians;
  const lon2Rad = lon2 * degreesToRadians;

  // Calculate the differences between the latitudes and longitudes
  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;

  // Use the Haversine formula to calculate the distance
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceMiles = earthRadiusMiles * c;
  const distanceFeet = distanceMiles * 5280;
  const distanceMeters = distanceMiles * 1609.34;

  if (unit == "mi") return distanceMiles;

  if (unit == "m") return distanceMeters;
  if (unit == "ft") return distanceFeet;
}

const vectorMath = {
  distance,
  midpoint,
  angle,
  vector,
  magnitude,
  unit,
  dot,
  cross,
  projection,
  haversineDistance,
};

function polylineToLines(points) {
  let pairs = [];

  for (let i = 0; i < points.length; i++) {
    let c = points[i];
    let n = points[i + 1];
    if (!n) continue;
    pairs.push([c, n]);
  }

  return pairs;
}

module.exports = {
  vectorMath,
  polylineToLines,
};
