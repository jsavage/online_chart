/******************************************************************************
 * Trip Storage Module for OpenSeaMap Trip Planner
 * Provides localStorage functionality to save and load trips
 * 
 * Features:
 * - Save trips to browser localStorage
 * - Load trips from storage
 * - Delete individual trips
 * - List all saved trips with timestamps
 * - UI dialogs for managing trips
 ******************************************************************************/

/**
 * Saves the current trip to browser localStorage
 * @param {string} tripName - Name of the trip to save
 */
function TripStorage_saveTrip(tripName) {
  // Validate input
  if (!tripName || tripName.trim() === "") {
    alert("Please enter a trip name.");
    return;
  }

  tripName = tripName.trim();

  // Check if route exists
  if (!routeObject || !routeTrack || routeTrack.length === 0) {
    alert("No route to save. Please draw a route first.");
    return;
  }

  // Check localStorage support
  if (!window.localStorage) {
    alert("Your browser does not support localStorage.");
    return;
  }

  // Check if trip already exists
  const existingTrip = TripStorage_getTrip(tripName);
  if (existingTrip && !confirm(`Trip "${tripName}" already exists. Overwrite it?`)) {
    return;
  }

  // Serialize the trip data
  const tripData = {
    name: tripName,
    coordinates: routeTrack,
    timestamp: new Date().toISOString(),
    distance: document.getElementById("routeDistance").innerHTML,
  };

  try {
    const allTrips = TripStorage_getAllTrips();
    allTrips[tripName] = tripData;
    localStorage.setItem("trips", JSON.stringify(allTrips));
    alert(`Trip "${tripName}" saved successfully!`);
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      alert("Storage quota exceeded. Please delete some trips.");
    } else {
      alert("Error saving trip: " + e.message);
    }
  }
}

/**
 * Retrieves a specific trip from storage
 * @param {string} tripName - Name of the trip to retrieve
 * @returns {object|null} Trip data or null if not found
 */
function TripStorage_getTrip(tripName) {
  const allTrips = TripStorage_getAllTrips();
  return allTrips[tripName] || null;
}

/**
 * Loads a trip from storage onto the map
 * @param {string} tripName - Name of the trip to load
 */
function TripStorage_loadTrip(tripName) {
  const trip = TripStorage_getTrip(tripName);

  if (!trip) {
    alert(`Trip "${tripName}" not found.`);
    return;
  }

  if (!routeObject) {
    alert("Trip Planner is not initialized.");
    return;
  }

  try {
    // Convert stored coordinates back to feature
    const coordinates = trip.coordinates.map((point) => [point.x, point.y]);

    // Create new linestring feature
    const lineString = new ol.geom.LineString(coordinates);
    const feature = new ol.Feature({
      geometry: lineString,
    });

    // Clear existing route
    layer_nautical_route.getSource().clear();

    // Add loaded route to layer
    layer_nautical_route.getSource().addFeature(feature);

    // Update the route object and track
    routeObject = feature;
    routeTrack = trip.coordinates;

    // Update the UI with the trip name and details
    document.getElementById("tripName").value = tripName;
    NauticalRoute_getPoints(routeTrack);

    // Mark as not changed since we just loaded
    routeChanged = false;

    alert(`Trip "${tripName}" loaded successfully!`);
  } catch (e) {
    alert("Error loading trip: " + e.message);
  }
}

/**
 * Deletes a trip from storage
 * @param {string} tripName - Name of the trip to delete
 */
function TripStorage_deleteTrip(tripName) {
  if (!confirm(`Are you sure you want to delete trip "${tripName}"?`)) {
    return;
  }

  try {
    const allTrips = TripStorage_getAllTrips();
    delete allTrips[tripName];
    localStorage.setItem("trips", JSON.stringify(allTrips));
    alert(`Trip "${tripName}" deleted successfully!`);
    TripStorage_showTripsListDialog();
  } catch (e) {
    alert("Error deleting trip: " + e.message);
  }
}

/**
 * Clears all trips from storage
 */
function TripStorage_clearAllTrips() {
  if (!confirm("Are you sure you want to delete ALL trips? This cannot be undone.")) {
    return;
  }

  try {
    localStorage.removeItem("trips");
    alert("All trips have been cleared.");
    TripStorage_showTripsListDialog();
  } catch (e) {
    alert("Error clearing trips: " + e.message);
  }
}

/**
 * Retrieves all trips from storage
 * @returns {object} Object containing all trips
 */
function TripStorage_getAllTrips() {
  if (!window.localStorage) {
    return {};
  }

  try {
    const trips = localStorage.getItem("trips");
    return trips ? JSON.parse(trips) : {};
  } catch (e) {
    console.error("Error parsing stored trips:", e);
    return {};
  }
}

/**
 * Shows a dialog listing all saved trips with load/delete options
 */
function TripStorage_showTripsListDialog() {
  const allTrips = TripStorage_getAllTrips();
  const tripNames = Object.keys(allTrips);

  let htmlText =
    '<div style="position:absolute; top:5px; right:5px; cursor:pointer;">';
  htmlText +=
    '<img src="./resources/action/close.gif" onClick="closeActionDialog();"/></div>';
  htmlText += "<h3>Saved Trips</h3>";

  if (tripNames.length === 0) {
    htmlText += "<p>No saved trips yet.</p>";
  } else {
    htmlText += '<table border="1" style="width: 100%; margin-top: 10px;">';
    htmlText +=
      "<tr><th>Trip Name</th><th>Saved Date</th><th>Distance</th><th>Actions</th></tr>";

    tripNames.forEach((tripName) => {
      const trip = allTrips[tripName];
      const savedDate = new Date(trip.timestamp).toLocaleString();
      const distance = trip.distance || "N/A";

      // HTML escape the trip name for safety
      const escapedTripName = escapeHtml(tripName);

      htmlText += "<tr>";
      htmlText += `<td>${escapedTripName}</td>`;
      htmlText += `<td>${savedDate}</td>`;
      htmlText += `<td>${distance}</td>`;
      htmlText += "<td>";
      htmlText += `<button onclick="TripStorage_loadTrip('${escapedTripName}'); closeActionDialog();" style="margin-right: 5px;">Load</button>`;
      htmlText += `<button onclick="TripStorage_deleteTrip('${escapedTripName}');" style="background-color: #ff6b6b; color: white;">Delete</button>`;
      htmlText += "</td>";
      htmlText += "</tr>";
    });

    htmlText += "</table>";
  }

  htmlText +=
    '<button onclick="TripStorage_clearAllTrips();" style="margin-top: 10px; background-color: #ff6b6b; color: white;">Clear All Trips</button>';

  showActionDialog(htmlText);
}

/**
 * Helper function to escape HTML characters and prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
