import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { Network } from "@capacitor/network";

interface NativeLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
}

interface NativePhotoData {
  blob: Blob;
  dataUrl: string;
}

export const isNative = () => {
  return Capacitor.isNativePlatform();
};

export const nativeAttendanceService = {
  /**
   * Check if we're running on native platform
   */
  isNative,

  /**
   * Request camera permission
   */
  async requestCameraPermission(): Promise<boolean> {
    if (!isNative()) return true;

    try {
      const result = await Camera.checkPermissions();
      if (result.camera === "granted") return true;

      const requestResult = await Camera.requestPermissions({ permissions: ["camera"] });
      return requestResult.camera === "granted";
    } catch (error) {
      console.error("Camera permission error:", error);
      return false;
    }
  },

  /**
   * Request location permission
   */
  async requestLocationPermission(): Promise<boolean> {
    if (!isNative()) return true;

    try {
      const result = await Geolocation.checkPermissions();
      if (result.location === "granted") return true;

      const requestResult = await Geolocation.requestPermissions();
      return requestResult.location === "granted";
    } catch (error) {
      console.error("Location permission error:", error);
      return false;
    }
  },

  /**
   * Capture photo using native camera
   * Forces live capture, prevents gallery selection
   */
  async capturePhoto(): Promise<NativePhotoData> {
    if (!isNative()) {
      throw new Error("Native camera only available on mobile");
    }

    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera, // Force camera, no gallery
        saveToGallery: false,
        correctOrientation: true,
        width: 1280,
        height: 720,
      });

      if (!image.dataUrl) {
        throw new Error("Failed to capture photo");
      }

      // Convert base64 to blob
      const response = await fetch(image.dataUrl);
      const blob = await response.blob();

      return {
        blob,
        dataUrl: image.dataUrl,
      };
    } catch (error) {
      console.error("Native camera error:", error);
      throw error;
    }
  },

  /**
   * Get high-accuracy GPS location
   */
  async getLocation(): Promise<NativeLocationData> {
    if (!isNative()) {
      throw new Error("Native geolocation only available on mobile");
    }

    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      return {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
        altitude: coordinates.coords.altitude || undefined,
        speed: coordinates.coords.speed || undefined,
      };
    } catch (error) {
      console.error("Native geolocation error:", error);
      throw error;
    }
  },

  /**
   * Get network status
   */
  async getNetworkStatus(): Promise<{ connected: boolean; connectionType: string }> {
    if (!isNative()) {
      return {
        connected: navigator.onLine,
        connectionType: "unknown",
      };
    }

    try {
      const status = await Network.getStatus();
      return {
        connected: status.connected,
        connectionType: status.connectionType,
      };
    } catch (error) {
      console.error("Network status error:", error);
      return { connected: false, connectionType: "unknown" };
    }
  },

  /**
   * Listen for network changes
   */
  addNetworkListener(callback: (connected: boolean) => void) {
    if (!isNative()) {
      window.addEventListener("online", () => callback(true));
      window.addEventListener("offline", () => callback(false));
      return;
    }

    Network.addListener("networkStatusChange", (status) => {
      callback(status.connected);
    });
  },

  /**
   * Get device information
   */
  getDeviceInfo() {
    return {
      platform: Capacitor.getPlatform(),
      isNative: isNative(),
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    };
  },
};
