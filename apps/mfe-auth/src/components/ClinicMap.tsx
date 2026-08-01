import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { t, useLanguageStore } from "../lib/language";

export type MapClinic = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  external?: boolean;
};

// Fit the view to all markers once they're known (and fix Leaflet sizing when
// the map mounts inside a tab that was previously hidden).
function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);
  return null;
}

// Leaflet map showing the owner's location and nearby clinics as coloured
// circle markers (green = registered clinic, amber = OpenStreetMap listing).
// Uses free OpenStreetMap tiles — no API key required.
export function ClinicMap({
  userLocation,
  clinics,
}: {
  userLocation: { latitude: number; longitude: number } | null;
  clinics: MapClinic[];
}) {
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const points: [number, number][] = [];
  if (userLocation) points.push([userLocation.latitude, userLocation.longitude]);
  clinics.forEach((c) => points.push([c.latitude, c.longitude]));
  if (points.length === 0) return null;

  const center: LatLngExpression = points[0];

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 dark:border-neutral-800" style={{ height: 320 }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMarkers points={points} />

        {userLocation && (
          <CircleMarker
            center={[userLocation.latitude, userLocation.longitude]}
            radius={8}
            pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>{tr("youAreHere")}</Popup>
          </CircleMarker>
        )}

        {clinics.map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.latitude, c.longitude]}
            radius={7}
            pathOptions={{
              color: c.external ? "#b45309" : "#15803d",
              fillColor: c.external ? "#f59e0b" : "#22c55e",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <strong>{c.name}</strong>
                {typeof c.distanceKm === "number" && <div>{c.distanceKm.toFixed(1)} {tr("kmAway")}</div>}
                {c.external && <div style={{ color: "#b45309" }}>{tr("osmListing")}</div>}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tr("directions")}
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
