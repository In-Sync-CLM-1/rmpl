import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Camera, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";

interface PermissionStatus {
  camera: "prompt" | "granted" | "denied";
  location: "prompt" | "granted" | "denied";
}

interface PermissionHandlerProps {
  onPermissionsGranted: () => void;
}

export function PermissionHandler({ onPermissionsGranted }: PermissionHandlerProps) {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: "prompt",
    location: "prompt",
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkPermissions = async () => {
    setIsChecking(true);
    
    try {
      // Check camera permission
      const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      // Check location permission
      const locationStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      
      setPermissions({
        camera: cameraStatus.state as "granted" | "denied" | "prompt",
        location: locationStatus.state as "granted" | "denied" | "prompt",
      });

      // If both granted, proceed
      if (cameraStatus.state === "granted" && locationStatus.state === "granted") {
        onPermissionsGranted();
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, camera: "granted" }));
      await checkPermissions();
    } catch (error) {
      console.error("Camera permission denied:", error);
      setPermissions(prev => ({ ...prev, camera: "denied" }));
    }
  };

  const requestLocationPermission = async () => {
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      setPermissions(prev => ({ ...prev, location: "granted" }));
      await checkPermissions();
    } catch (error) {
      console.error("Location permission denied:", error);
      setPermissions(prev => ({ ...prev, location: "denied" }));
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const allGranted = permissions.camera === "granted" && permissions.location === "granted";

  if (allGranted) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Attendance marking requires camera and location access to verify your presence.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {/* Camera Permission */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5" />
            <div>
              <p className="font-medium">Camera Access</p>
              <p className="text-sm text-muted-foreground">Required for photo capture</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permissions.camera === "granted" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Button 
                onClick={requestCameraPermission}
                size="sm"
                disabled={isChecking}
              >
                {permissions.camera === "denied" ? "Retry" : "Grant"}
              </Button>
            )}
          </div>
        </div>

        {/* Location Permission */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5" />
            <div>
              <p className="font-medium">Location Access</p>
              <p className="text-sm text-muted-foreground">Required for GPS verification</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permissions.location === "granted" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Button 
                onClick={requestLocationPermission}
                size="sm"
                disabled={isChecking}
              >
                {permissions.location === "denied" ? "Retry" : "Grant"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {(permissions.camera === "denied" || permissions.location === "denied") && (
        <Alert variant="destructive">
          <AlertDescription>
            Some permissions were denied. Please enable them in your browser settings to continue.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
