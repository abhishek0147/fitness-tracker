// GPS utility functions for calculating distance, elevation, etc.

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total distance and elevation from a route
 * @param {Array} route - Array of {latitude, longitude, elevation} points
 * @returns {Object} {total_distance_km, total_elevation_m, max_elevation_m}
 */
function calculateRouteStats(route) {
  if (!route || route.length < 2) {
    return { total_distance_km: 0, total_elevation_m: 0, max_elevation_m: 0 };
  }

  let totalDistance = 0;
  let totalElevationGain = 0;
  let maxElevation = route[0].elevation || 0;

  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const curr = route[i];

    // Distance calculation
    const distance = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    totalDistance += distance;

    // Elevation gain (only count uphill)
    const elevationDiff = (curr.elevation || 0) - (prev.elevation || 0);
    if (elevationDiff > 0) {
      totalElevationGain += elevationDiff;
    }

    maxElevation = Math.max(maxElevation, curr.elevation || 0);
  }

  return {
    total_distance_km: parseFloat(totalDistance.toFixed(2)),
    total_elevation_m: parseFloat(totalElevationGain.toFixed(2)),
    max_elevation_m: parseFloat(maxElevation.toFixed(2)),
  };
}

/**
 * Convert route to GeoJSON format for mapping
 * @param {Array} route - Array of {latitude, longitude, elevation} points
 * @returns {Object} GeoJSON FeatureCollection
 */
function routeToGeoJSON(route) {
  const coordinates = route.map((point) => [point.longitude, point.latitude, point.elevation || 0]);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {
          points: route.length,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [coordinates[0][0], coordinates[0][1]],
        },
        properties: {
          name: "Start",
          marker: "start",
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [coordinates[coordinates.length - 1][0], coordinates[coordinates.length - 1][1]],
        },
        properties: {
          name: "Finish",
          marker: "finish",
        },
      },
    ],
  };
}

module.exports = {
  calculateDistance,
  calculateRouteStats,
  routeToGeoJSON,
};
