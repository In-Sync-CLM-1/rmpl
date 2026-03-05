import { useState } from "react";
import { PermissionHandler } from "./PermissionHandler";
import { CameraCapture } from "./CameraCapture";
import { LocationCapture } from "./LocationCapture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";
import { useAttendanceCapture } from "@/hooks/useAttendanceCapture";

interface AttendanceCaptureProps {
  type: "sign_in" | "sign_out";
  userId: string;
  attendanceRecordId?: string;
  onComplete: () => void;
  onCancel: () => void;
}

type CaptureStep = "permissions" | "location" | "camera" | "review" | "submitting";

export function AttendanceCapture({
  type,
  userId,
  attendanceRecordId,
  onComplete,
  onCancel,
}: AttendanceCaptureProps) {
  const [step, setStep] = useState<CaptureStep>("permissions");
  const { capturedData, setCapturedData, isCapturing, markAttendance } = useAttendanceCapture();

  const handlePermissionsGranted = () => {
    setStep("location");
  };

  const handleLocationCaptured = (location: any) => {
    setCapturedData(prev => ({ ...prev, location }));
    setStep("camera");
  };

  const handlePhotoCaptured = (photoBlob: Blob, photoDataUrl: string) => {
    setCapturedData(prev => ({ ...prev, photo: photoBlob, photoDataUrl }));
    setStep("review");
  };

  const handleSubmit = async () => {
    setStep("submitting");
    await markAttendance(type, userId, attendanceRecordId);
    onComplete();
  };

  const getStepTitle = () => {
    switch (step) {
      case "permissions": return "Grant Permissions";
      case "location": return "Capturing Location";
      case "camera": return "Capture Photo";
      case "review": return "Review & Submit";
      case "submitting": return "Submitting...";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "permissions": return "We need camera and location access";
      case "location": return "Acquiring GPS coordinates";
      case "camera": return "Take your attendance photo";
      case "review": return "Verify details before submitting";
      case "submitting": return "Processing your attendance";
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {type === "sign_in" ? "Check In" : "Check Out"}
        </CardTitle>
        <CardDescription>{getStepDescription()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-6">
          {["permissions", "location", "camera", "review"].map((s, idx) => (
            <div key={s} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["permissions", "location", "camera", "review"].indexOf(step) > idx
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {["permissions", "location", "camera", "review"].indexOf(step) > idx ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="text-xs mt-1 capitalize">{s}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === "permissions" && (
          <PermissionHandler onPermissionsGranted={handlePermissionsGranted} />
        )}

        {step === "location" && (
          <LocationCapture onLocationCaptured={handleLocationCaptured} />
        )}

        {step === "camera" && (
          <CameraCapture onCapture={handlePhotoCaptured} />
        )}

        {step === "review" && capturedData.location && capturedData.photoDataUrl && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Captured Photo</h3>
              <img
                src={capturedData.photoDataUrl}
                alt="Attendance"
                className="w-full rounded-lg border"
              />
            </div>

            <div>
              <h3 className="font-medium mb-2">Location Details</h3>
              <div className="text-sm space-y-1 p-3 bg-muted rounded-lg">
                {capturedData.location.city && capturedData.location.state && (
                  <p>📍 {capturedData.location.city}, {capturedData.location.state}</p>
                )}
                <p>Coordinates: {capturedData.location.latitude.toFixed(6)}, {capturedData.location.longitude.toFixed(6)}</p>
                <p>Accuracy: ±{capturedData.location.accuracy.toFixed(0)} meters</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={onCancel} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isCapturing} className="flex-1">
                {isCapturing ? "Submitting..." : `Submit ${type === "sign_in" ? "Check In" : "Check Out"}`}
              </Button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Processing your attendance...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
