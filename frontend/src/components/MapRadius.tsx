import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map.css';

// Fix pour l'icône Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapRadiusProps {
  city: string;
  radius: number;
  onLocationChange?: (lat: number, lng: number) => void;
  shouldUpdateFromCity?: boolean;
  showCircle: boolean;
}

// Composant pour gérer les événements de la carte
const MapEvents = ({ onLocationChange }: { onLocationChange?: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationChange?.(lat, lng);
    },
  });
  return null;
};

const MapRadius: React.FC<MapRadiusProps> = ({ city, radius, onLocationChange, shouldUpdateFromCity: externalShouldUpdate, showCircle }) => {
  const [center, setCenter] = useState<[number, number]>([48.8566, 2.3522]); // Paris
  const [internalShouldUpdate, setInternalShouldUpdate] = useState(true);

  useEffect(() => {
    setInternalShouldUpdate(externalShouldUpdate ?? true);
  }, [externalShouldUpdate]);

  useEffect(() => {
    const fetchCoordinates = async () => {
      if (!city || !internalShouldUpdate) return;

      // Ne pas faire de géocodage si la ville est vide au démarrage
      if (city === '') return;

      try {
        // Utiliser l'API Google Maps Geocoding au lieu de Nominatim
        if (window.google && window.google.maps && window.google.maps.Geocoder) {
          const geocoder = new window.google.maps.Geocoder();
          const result = await new Promise((resolve, reject) => {
            geocoder.geocode(
              { 
                address: `${city}, France`,
                componentRestrictions: { country: 'FR' }
              },
              (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  resolve(results[0]);
                } else {
                  reject(new Error(`Geocoding failed: ${status}`));
                }
              }
            );
          });

          const location = (result as google.maps.GeocoderResult).geometry.location;
          const newCenter: [number, number] = [location.lat(), location.lng()];
          setCenter(newCenter);
          onLocationChange?.(newCenter[0], newCenter[1]);
        }
      } catch (error) {
        console.error('Erreur lors du géocodage:', error);
        // En cas d'erreur, on garde le centre actuel
      }
    };

    fetchCoordinates();
  }, [city, onLocationChange, internalShouldUpdate]);

  const handleMapClick = (lat: number, lng: number) => {
    setInternalShouldUpdate(false);
    setCenter([lat, lng]);
    onLocationChange?.(lat, lng);
  };

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden mt-2">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {showCircle && (
          <Circle
            center={center}
            radius={radius * 1000}
            pathOptions={{
              color: '#4F46E5',
              fillColor: '#4F46E5',
              fillOpacity: 0.1,
              weight: 2
            }}
          />
        )}
        <MapEvents onLocationChange={onLocationChange} />
      </MapContainer>
    </div>
  );
};

export default MapRadius;