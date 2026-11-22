
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [22.7196, 75.8577];

const createIssueIcon = (color) =>
  L.divIcon({
    className: "civiceye-map-marker",
    html: `<div style="width:18px;height:18px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px #0005;"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const selectedIcon = L.divIcon({
  className: "civiceye-selected-marker",
  html: `
    <div class="civiceye-selected-pin">
      <div class="civiceye-selected-pulse"></div>
      <div class="civiceye-selected-dot"></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const notificationIssueIcon = L.divIcon({
  className: "civiceye-notification-marker",
  html: `
    <div class="civiceye-notification-pin">
      <div class="civiceye-notification-pulse"></div>
      <div class="civiceye-notification-dot"></div>
      <div class="civiceye-notification-label">
        FROM NOTIFICATION
      </div>
    </div>
  `,
  iconSize: [190, 62],
  iconAnchor: [95, 22],
});

const STATUS_COLORS = {
  resolved: "#16a34a",
  "in progress": "#f97316",
  pending: "#ef4444",
};

function MapClickHandler({ onLocationSelect, selectable }) {
  useMapEvents({
    click(event) {
      if (selectable && onLocationSelect) {
        onLocationSelect({
          latitude: Number(event.latlng.lat.toFixed(7)),
          longitude: Number(event.latlng.lng.toFixed(7)),
        });
      }
    },
  });

  return null;
}

function MapViewController({ center, zoom = 15 }) {
  const map = useMap();

  useEffect(() => {
    if (
      Array.isArray(center) &&
      center.length === 2 &&
      center.every((value) => Number.isFinite(Number(value)))
    ) {
      map.flyTo([Number(center[0]), Number(center[1])], zoom, {
        duration: 0.8,
      });
    }
  }, [center, map, zoom]);

  return null;
}

export default function IssueMap({
  issues = [],
  selectable = false,
  selectedLocation = null,
  selectedIssueId = null,
  onLocationSelect,
  onStatusChange,
  showSearch = false,
  height = "420px",
}) {
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (
      selectedLocation &&
      Number.isFinite(Number(selectedLocation.latitude)) &&
      Number.isFinite(Number(selectedLocation.longitude))
    ) {
      setMapCenter([
        Number(selectedLocation.latitude),
        Number(selectedLocation.longitude),
      ]);
    }
  }, [selectedLocation]);

  const searchLocation = async (event) => {
    event?.preventDefault();

    const query = searchText.trim();

    if (!query) {
      setSearchError("Pehle area ya location ka naam likho.");
      return;
    }

    setSearching(true);
    setSearchError("");

    try {
      const searchQuery = /indore/i.test(query)
        ? query
        : `${query}, Indore, Madhya Pradesh, India`;

      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Location search service is unavailable.");
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        setSearchError(
          "Location nahi mili. Naam thoda aur specific karke try karo."
        );
        return;
      }

      const result = results[0];
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        setSearchError("Is search result ke coordinates valid nahi hain.");
        return;
      }

      const nextLocation = {
        latitude,
        longitude,
      };

      setMapCenter([latitude, longitude]);

      if (selectable && onLocationSelect) {
        onLocationSelect(nextLocation);
      }

      setSearchText(result.display_name || query);
    } catch (error) {
      console.error("Location search error:", error);

      setSearchError(
        "Location search nahi ho paayi. Internet connection check karke dobara try karo."
      );
    } finally {
      setSearching(false);
    }
  };

  const validIssues = issues.filter((issue) => {
    const latitude = Number(issue.latitude);
    const longitude = Number(issue.longitude);

    return (
      issue.latitude !== null &&
      issue.latitude !== undefined &&
      issue.longitude !== null &&
      issue.longitude !== undefined &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  });

  const getIssueColor = (issue) => {
    const normalizedStatus = (issue.status || "Pending")
      .trim()
      .toLowerCase();

    if (normalizedStatus === "resolved") {
      return STATUS_COLORS.resolved;
    }

    if (normalizedStatus === "in progress") {
      return STATUS_COLORS["in progress"];
    }

    return STATUS_COLORS.pending;
  };

  const validSelectedLocation =
    selectedLocation &&
    selectedLocation.latitude != null &&
    selectedLocation.longitude != null &&
    Number.isFinite(Number(selectedLocation.latitude)) &&
    Number.isFinite(Number(selectedLocation.longitude));

  return (
    <div
      className="civiceye-map-wrapper"
      style={{
        height,
        width: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>
        {`
          .civiceye-notification-marker,
          .civiceye-selected-marker {
            background: transparent !important;
            border: none !important;
          }

          .civiceye-selected-pin {
            position: relative;
            width: 34px;
            height: 34px;
          }

          .civiceye-selected-dot {
            position: absolute;
            top: 7px;
            left: 7px;
            width: 20px;
            height: 20px;
            border: 3px solid #ffffff;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 2px 10px #991b1b99;
            z-index: 2;
          }

          .civiceye-selected-pulse {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 28px;
            height: 28px;
            border: 3px solid #ef4444;
            border-radius: 50%;
            animation: civiceye-selected-pulse 1.4s ease-out infinite;
          }

          @keyframes civiceye-selected-pulse {
            0% {
              transform: scale(.65);
              opacity: 1;
            }
            100% {
              transform: scale(1.8);
              opacity: 0;
            }
          }

          .civiceye-notification-pin {
            position: relative;
            width: 190px;
            height: 62px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }

          .civiceye-notification-dot {
            position: absolute;
            top: 5px;
            left: 82px;
            width: 22px;
            height: 22px;
            border: 4px solid #ffffff;
            border-radius: 50%;
            background: #7c3aed;
            box-shadow: 0 2px 12px #4c1d95aa;
            z-index: 3;
          }

          .civiceye-notification-pulse {
            position: absolute;
            top: 1px;
            left: 78px;
            width: 30px;
            height: 30px;
            border: 3px solid #8b5cf6;
            border-radius: 50%;
            animation: civiceye-notification-pulse 1.5s infinite;
            z-index: 2;
          }

          .civiceye-notification-label {
            position: absolute;
            top: 38px;
            left: 50%;
            transform: translateX(-50%);
            background: #5b21b6;
            color: #ffffff;
            border: 1px solid #ddd6fe;
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .5px;
            white-space: nowrap;
            box-shadow: 0 2px 8px #0005;
            z-index: 4;
          }

          @keyframes civiceye-notification-pulse {
            0% {
              transform: scale(.8);
              opacity: 1;
            }
            100% {
              transform: scale(2);
              opacity: 0;
            }
          }
        `}
      </style>

      {showSearch && (
        <>
          <form
            onSubmit={searchLocation}
            style={{
              display: "flex",
              gap: "6px",
              padding: "7px 9px",
              background: "#fff",
              alignItems: "center",
              flexWrap: "nowrap",
              zIndex: 500,
            }}
          >
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search location (e.g. Rau, Geeta Bhavan)"
              aria-label="Search map location"
              style={{
                flex: "1 1 auto",
                width: "100%",
                minWidth: 0,
                padding: "8px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "13px",
                outlineOffset: "2px",
                color: "#0f172a",
                background: "#fff",
              }}
            />

            <button
              type="submit"
              disabled={searching}
              style={{
                padding: "8px 12px",
                border: 0,
                borderRadius: "8px",
                background: searching ? "#64748b" : "#2563eb",
                color: "#fff",
                fontWeight: 600,
                cursor: searching ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {searchError && (
            <div
              role="status"
              style={{
                padding: "7px 12px",
                background: "#fff7ed",
                color: "#9a3412",
                fontSize: "13px",
              }}
            >
              {searchError}
            </div>
          )}
        </>
      )}

      {selectable && (
        <div
          className="civiceye-map-instructions"
          style={{
            padding: "7px 12px",
            background: "#eff6ff",
            color: "#1e40af",
            fontSize: "13px",
          }}
        >
          Search an area or click directly on the map to select the exact
          complaint location.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <MapViewController center={mapCenter} zoom={16} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler
            selectable={selectable}
            onLocationSelect={onLocationSelect}
          />

          {validSelectedLocation && (
            <Marker
              position={[
                Number(selectedLocation.latitude),
                Number(selectedLocation.longitude),
              ]}
              icon={selectedIcon}
              zIndexOffset={500}
            >
              <Popup>Selected complaint location</Popup>
            </Marker>
          )}

          {validIssues.map((issue) => {
            const isNotificationSelected =
              selectedIssueId != null &&
              String(issue._id) === String(selectedIssueId);

            return (
              <Marker
                key={issue._id}
                position={[
                  Number(issue.latitude),
                  Number(issue.longitude),
                ]}
                icon={
                  isNotificationSelected
                    ? notificationIssueIcon
                    : createIssueIcon(getIssueColor(issue))
                }
                zIndexOffset={isNotificationSelected ? 1000 : 0}
              >
                <Popup>
                  <div style={{ minWidth: "190px" }}>
                    {isNotificationSelected && (
                      <div
                        style={{
                          display: "inline-block",
                          background: "#ede9fe",
                          color: "#5b21b6",
                          borderRadius: "5px",
                          padding: "4px 7px",
                          fontSize: "11px",
                          fontWeight: 800,
                          marginBottom: "8px",
                        }}
                      >
                        OPENED FROM NOTIFICATION
                      </div>
                    )}

                    <strong>{issue.title || "Civic issue"}</strong>
                    <br />
                    Category: {issue.category || "Other"}
                    <br />
                    Status: {issue.status || "Pending"}
                    <br />
                    Location: {issue.location || "Not provided"}
                    <br />

                    {issue.createdAt && (
                      <>
                        Reported:{" "}
                        {new Date(issue.createdAt).toLocaleString("en-IN")}
                        <br />
                      </>
                    )}

                    {onStatusChange && (
                      <div style={{ marginTop: "10px" }}>
                        <label
                          htmlFor={`map-status-${issue._id}`}
                          style={{
                            display: "block",
                            fontWeight: 600,
                            marginBottom: "5px",
                          }}
                        >
                          Update complaint status
                        </label>

                        <select
                          id={`map-status-${issue._id}`}
                          value={issue.status || "Pending"}
                          onChange={(event) =>
                            onStatusChange(issue._id, event.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "7px",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div
        className="civiceye-map-legend"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "18px",
          padding: "10px 12px",
          fontSize: "13px",
          background: "#fff",
          color: "#111827",
        }}
      >
        <span>
          <span style={{ color: "#ef4444" }}>●</span> Pending
        </span>

        <span>
          <span style={{ color: "#f97316" }}>●</span> In Progress
        </span>

        <span>
          <span style={{ color: "#16a34a" }}>●</span> Resolved
        </span>

        {selectedIssueId && (
          <span>
            <span style={{ color: "#7c3aed" }}>●</span> Opened from notification
          </span>
        )}
      </div>
    </div>
  );
}
