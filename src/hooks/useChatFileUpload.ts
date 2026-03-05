 import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for other files

export function useChatFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File, conversationId: string) => {
    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    
    if (file.size > maxSize) {
      toast.error(`${isImage ? "Image" : "File"} size must be less than ${isImage ? "5MB" : "10MB"}`);
      return null;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${conversationId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get signed URL for private bucket
      const { data: signedUrlData } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 days

      setProgress(100);
      
      return {
        url: signedUrlData?.signedUrl || "",
        path: data.path,
        name: file.name,
        size: file.size,
      };
    } catch (error: any) {
      console.error("File upload error:", error);
      
      // Provide more specific error messages
      if (error?.message?.includes("Bucket not found")) {
        toast.error("Storage not configured. Please contact support.");
      } else if (error?.message?.includes("not authorized") || error?.statusCode === 403) {
        toast.error("Permission denied. Please try logging in again.");
      } else if (error?.message?.includes("payload too large")) {
        toast.error("File is too large to upload");
      } else {
        toast.error("Failed to upload file. Please try again.");
      }
      return null;
    } finally {
      setIsUploading(false);
    }
  };

   const getSignedUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrl(path, 60 * 60); // 1 hour
    return data?.signedUrl;
   }, []);

  return {
    uploadFile,
    getSignedUrl,
    isUploading,
    progress,
  };
}
