import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCw } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  onCapture: (photoBlob: Blob, photoDataUrl: string) => void;
  disabled?: boolean;
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Failed to access camera");
      setIsStreaming(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas dimensions to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add timestamp watermark
    context.fillStyle = "rgba(255, 255, 255, 0.8)";
    context.fillRect(10, canvas.height - 40, 300, 30);
    context.fillStyle = "#000";
    context.font = "16px Arial";
    context.fillText(new Date().toLocaleString(), 20, canvas.height - 18);

    // Convert to blob with compression
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          onCapture(blob, dataUrl);
          stopCamera();
        }
      },
      "image/jpeg",
      0.8
    );
  };

  const toggleCamera = () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    startCamera(newMode);
  };

  useEffect(() => {
    if (!disabled) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [disabled]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white">Starting camera...</p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-2">
        <Button
          onClick={capturePhoto}
          disabled={!isStreaming || disabled}
          className="flex-1"
        >
          <Camera className="h-4 w-4 mr-2" />
          Capture Photo
        </Button>
        <Button
          onClick={toggleCamera}
          disabled={!isStreaming || disabled}
          variant="outline"
          size="icon"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
