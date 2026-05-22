/******************************************************************************
 * Trip Storage Module for OpenSeaMap Trip Planner
 * 
 * This module provides browser storage functionality to save and load trips
 * using the browser's localStorage API.
 * 
 * Features:
 * - Save trips with timestamps
 * - Load trips from storage
 * - Delete individual trips
 * - Manage multiple saved trips
 * - XSS protection through HTML escaping
 ******************************************************************************/

const TRIP_STORAGE_KEY = "openseamap_trips";

/**
 * Save the current route to browser storage
 * @param {string} tripName - The name to give this trip
 */
function TripStorage_saveTrip(tripName) {
  // Validate input
  if (!tripName || tripName.trim() === "") {
    alert("Please enter a trip name.");
    return;
  }

  tripName = tripName.trim();

  // Check if route exists
  if (!routeObject || !routeObject.getGeometry()) {
    alert("No route to save. Please draw a route first.");
    return;
  }

  // Get all existing trips
  const trips = TripStorage_getAllTrips();

  // Check if trip name already exists
  if (trips.some((trip) => trip.name === tripName)) {
    if (!confirm(`A trip named "${tripName}" already exists. Overwrite it?`)) {
      return;
    }
  }

  // Serialize the route
  const tripData = {
    name: tripName,
    timestamp: new Date().toISOString(),
    coordinates: routeTrack,
    featureData: {
      type: routeObject.getGeometry().getType(),
      coordinates: routeObject
        .getGeometry()
        .getCoordinates()
        .map(([x, y]) => ({ x, y })),
    },
  };

  // Remove old trip with same name if exists
  const filteredTrips = trips.filter((trip) => trip.name !== tripName);
  filteredTrips.push(tripData);

  // Save to localStorage
  try {
    localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(filteredTrips));
    alert(`Trip "${tripName}" saved successfully!`);
  } catch (error) {
    console.error("Error saving trip to localStorage:", error);
    alert("Error saving trip. Storage may be full.");
  }
}

/**
 * Load a trip from storage onto the map
 * @param {string} tripName - The name of the trip to load
 */
function TripStorage_loadTrip(tripName) {
  const trips = TripStorage_getAllTrips();
  const trip = trips.find((t) => t.name === tripName);

  if (!trip) {
    alert("Trip not found.");
    return;
  }

  // Clear current route
  layer_nautical_route.getSource().clear();

  // Recreate the feature from stored data
  const coordinates = trip.featureData.coordinates.map((coord) => [coord.x, coord.y]);
  const geometry = new ol.geom.LineString(coordinates);
  const feature = new ol.Feature(geometry);

  // Add feature to layer
  layer_nautical_route.getSource().addFeature(feature);

  // Update route tracking variables
  routeObject = feature;
  routeTrack = trip.coordinates;
  routeChanged = false;

  // Update the UI
  NauticalRoute_getPoints(routeTrack);
  document.getElementById("tripName").value = tripName;
  document.getElementById("buttonRouteDownloadTrack").disabled = false;

  alert(`Trip "${tripName}" loaded successfully!`);
}

/**
 * Delete a trip from storage
 * @param {string} tripName - The name of the trip to delete
 */
function TripStorage_deleteTrip(tripName) {
  if (!confirm(`Delete trip "${tripName}"?`)) {
    return;
  }

  const trips = TripStorage_getAllTrips();
  const filteredTrips = trips.filter((trip) => trip.name !== tripName);

  try {
    if (filteredTrips.length === 0) {
      localStorage.removeItem(TRIP_STORAGE_KEY);
    } else {
      localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(filteredTrips));
    }
    alert(`Trip "${tripName}" deleted.`);
    TripStorage_showTripsListDialog(); // Refresh the list
  } catch (error) {
    console.error("Error deleting trip:", error);
    alert("Error deleting trip.");
  }
}

/**
 * Clear all saved trips
 */
function TripStorage_clearAllTrips() {
  if (!confirm("Delete ALL saved trips? This cannot be undone.")) {
    return;
  }

  try {
    localStorage.removeItem(TRIP_STORAGE_KEY);
    alert("All trips deleted.");
    TripStorage_showTripsListDialog(); // Refresh the list
  } catch (error) {
    console.error("Error clearing trips:", error);
    alert("Error clearing trips.");
  }
}

/**
 * Get all saved trips from storage
 * @returns {Array} Array of trip objects
 */
function TripStorage_getAllTrips() {
  try {
    const data = localStorage.getItem(TRIP_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error retrieving trips from localStorage:", error);
    return [];
  }
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function TripStorage_escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Format date for display
 * @param {string} isoDateString - ISO format date string
 * @returns {string} Formatted date string
 */
function TripStorage_formatDate(isoDateString) {
  const date = new Date(isoDateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

/**
 * Show dialog with list of saved trips
 */
function TripStorage_showTripsListDialog() {
  const trips = TripStorage_getAllTrips();

  let htmlText =
    '<div style="position:absolute; top:5px; right:5px; cursor:pointer;">';
  htmlText +=
    '<img src="./resources/action/close.gif" onClick="closeActionDialog();"/></div>';
  htmlText += "<h3>Saved Trips</h3>";

  if (trips.length === 0) {
    htmlText += "<p>No saved trips yet.</p>";
  } else {
    htmlText += '<table border="1" style="width:100%; margin-bottom:15px;">';
    htmlText +=
      "<tr><th>Trip Name</th><th>Date</th><th>Actions</th></tr>";

    trips.forEach((trip) => {
      const escapedName = TripStorage_escapeHtml(trip.name);
      const formattedDate = TripStorage_formatDate(trip.timestamp);
      htmlText += "<tr>";
      htmlText += "<td>" + escapedName + "</td>";
      htmlText += "<td>" + formattedDate + "</td>";
      htmlText +=
        '<td><button onclick="TripStorage_loadTrip(\'' +
        escapedName.replace(/'/g, "\\\'")
        + "');\">Load</button> " +
        '<button onclick="TripStorage_deleteTrip(\'' +
        escapedName.replace(/'/g, "\\\'")
        + "');\">Delete</button></td>";
      htmlText += "</tr>";
    });

    htmlText += "</table>";
    htmlText +=
      '<button onclick="TripStorage_clearAllTrips();" style="background-color: #ff6b6b; color: white; padding: 8px 12px; cursor: pointer;">Delete All Trips</button>';
  }

  showActionDialog(htmlText);
}
