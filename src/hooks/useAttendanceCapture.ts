import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  city?: string;
  state?: string;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  timestamp: string;
}

interface AttendanceCaptureData {
  photo: Blob;
  photoDataUrl: string;
  location: LocationData;
  deviceInfo: DeviceInfo;
  networkStatus: string;
}

export function useAttendanceCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedData, setCapturedData] = useState<Partial<AttendanceCaptureData>>({});

  const getDeviceInfo = (): DeviceInfo => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      timestamp: new Date().toISOString(),
    };
  };

  const getNetworkStatus = (): string => {
    return navigator.onLine ? "online" : "offline";
  };

  const uploadPhoto = async (
    photoBlob: Blob,
    userId: string,
    type: "sign_in" | "sign_out"
  ): Promise<string> => {
    const timestamp = new Date().getTime();
    const fileName = `${userId}/${new Date().toISOString().split('T')[0]}/${type}_${timestamp}.jpg`;

    const { data, error } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, photoBlob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const saveToIndexedDB = async (data: AttendanceCaptureData) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(["pending_attendance"], "readwrite");
      const store = transaction.objectStore("pending_attendance");
      
      await store.add({
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
      
      toast.info("Attendance saved locally - will sync when online");
    } catch (error) {
      console.error("IndexedDB error:", error);
    }
  };

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("AttendanceDB", 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("pending_attendance")) {
          db.createObjectStore("pending_attendance", { keyPath: "id" });
        }
      };
    });
  };

  const markAttendance = async (
    type: "sign_in" | "sign_out",
    userId: string,
    attendanceRecordId?: string
  ) => {
    if (!capturedData.photo || !capturedData.location) {
      toast.error("Please capture photo and location first");
      return;
    }

    setIsCapturing(true);
    try {
      const deviceInfo = getDeviceInfo();
      const networkStatus = getNetworkStatus();

      // If offline, save to IndexedDB
      if (networkStatus === "offline") {
        await saveToIndexedDB({
          photo: capturedData.photo,
          photoDataUrl: capturedData.photoDataUrl!,
          location: capturedData.location,
          deviceInfo,
          networkStatus,
        });
        return;
      }

      // Upload photo
      const photoUrl = await uploadPhoto(capturedData.photo, userId, type);

      // Prepare attendance data
      const attendanceData: any = {
        [`${type}_time`]: new Date().toISOString(),
        [`${type}_photo_url`]: photoUrl,
        [`${type}_location_accuracy`]: capturedData.location.accuracy,
        [`${type}_location_city`]: capturedData.location.city,
        [`${type}_location_state`]: capturedData.location.state,
        [`${type}_device_info`]: deviceInfo,
        location_lat: capturedData.location.latitude,
        location_lng: capturedData.location.longitude,
        network_status: networkStatus,
        sync_status: "synced",
      };

      if (type === "sign_in") {
        // Create new attendance record
        const today = new Date().toISOString().split('T')[0];
        attendanceData.user_id = userId;
        attendanceData.date = today;
        attendanceData.status = "present";

        const { error } = await supabase
          .from("attendance_records")
          .insert(attendanceData);

        if (error) throw error;
      } else {
        // Update existing record
        if (!attendanceRecordId) throw new Error("Attendance record ID required for sign out");

        const { error } = await supabase
          .from("attendance_records")
          .update(attendanceData)
          .eq("id", attendanceRecordId);

        if (error) throw error;
      }

      toast.success(`${type === "sign_in" ? "Signed in" : "Signed out"} successfully!`);
      setCapturedData({});
    } catch (error: any) {
      console.error("Attendance marking error:", error);
      toast.error("Failed to mark attendance: " + error.message);
    } finally {
      setIsCapturing(false);
    }
  };

  return {
    capturedData,
    setCapturedData,
    isCapturing,
    markAttendance,
  };
}
