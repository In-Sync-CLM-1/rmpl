import { useState, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  city?: string;
  state?: string;
}

interface LocationCaptureProps {
  onLocationCaptured: (location: LocationData) => void;
  disabled?: boolean;
}

export function LocationCapture({ onLocationCaptured, disabled }: LocationCaptureProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reverseGeocode = async (lat: number, lng: number): Promise<{ city?: string; state?: string }> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
      );
      const data = await response.json();
      
      return {
        city: data.address?.city || data.address?.town || data.address?.village,
        state: data.address?.state,
      };
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      return {};
    }
  };

  const captureLocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;
      
      // Get city and state
      const { city, state } = await reverseGeocode(latitude, longitude);

      const locationData: LocationData = {
        latitude,
        longitude,
        accuracy,
        city,
        state,
      };

      setLocation(locationData);
      onLocationCaptured(locationData);
    } catch (err: any) {
      const errorMessage = err.code === 1 
        ? "Location access denied"
        : err.code === 2 
        ? "Location unavailable"
        : "Location request timeout - please try again";
      
      setError(errorMessage);
      console.error("Location error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!disabled) {
      captureLocation();
    }
  }, [disabled]);

  if (isLoading) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>
          Acquiring GPS location... This may take 5-15 seconds.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!location) return null;

  return (
    <div className="p-4 border rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="font-medium">Location Captured</span>
      </div>
      
      {location.city && location.state && (
        <p className="text-sm text-muted-foreground">
          📍 {location.city}, {location.state}
        </p>
      )}
      
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
        <p className={location.accuracy <= 50 ? "text-green-600" : "text-amber-600"}>
          Accuracy: ±{location.accuracy.toFixed(0)} meters
        </p>
      </div>
    </div>
  );
}
