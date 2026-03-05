import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Image, File, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileAttachmentProps {
  fileName: string;
  fileSize: number;
  fileUrl: string;
  isOwnMessage?: boolean;
}

type MediaType = 'image' | 'video' | 'file';

const getMediaType = (fileName: string): MediaType => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return 'video';
  }
  return 'file';
};

export function FileAttachment({
  fileName,
  fileSize,
  fileUrl,
  isOwnMessage,
}: FileAttachmentProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const mediaType = getMediaType(fileName);

  useEffect(() => {
     let cancelled = false;
 
    const loadPreview = async () => {
      if (mediaType !== 'file' && fileUrl) {
        setIsLoadingPreview(true);
        setPreviewError(false);
        try {
           const { data } = await supabase.storage
             .from("chat-attachments")
             .createSignedUrl(fileUrl, 60 * 60);
           if (!cancelled && data?.signedUrl) {
             setPreviewUrl(data.signedUrl);
           }
        } catch (error) {
          console.error("Failed to load preview:", error);
           if (!cancelled) setPreviewError(true);
        } finally {
           if (!cancelled) setIsLoadingPreview(false);
        }
      }
    };
    loadPreview();
 
     return () => { cancelled = true; };
   }, [fileUrl, mediaType]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
      return <Image className="h-5 w-5" />;
    }
    if (["pdf"].includes(ext || "")) {
      return <FileText className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
       const { data } = await supabase.storage
         .from("chat-attachments")
         .createSignedUrl(fileUrl, 60 * 60);
       const signedUrl = data?.signedUrl;
      if (signedUrl) {
        window.open(signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to download file:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Show loading skeleton for media files
  if (mediaType !== 'file' && isLoadingPreview) {
    return (
      <Skeleton className="rounded-lg w-[200px] h-[150px]" />
    );
  }

  // Image preview
  if (mediaType === 'image' && previewUrl && !previewError) {
    return (
      <>
        <div 
          className="cursor-pointer group relative"
          onClick={() => setShowLightbox(true)}
        >
          <img
            src={previewUrl}
            alt={fileName}
            className="rounded-lg max-w-[250px] max-h-[200px] object-cover transition-opacity group-hover:opacity-90"
            loading="lazy"
            onError={() => setPreviewError(true)}
          />
          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className={cn(
              "text-xs px-2 py-1 rounded bg-black/60 text-white truncate",
            )}>
              {fileName}
            </div>
          </div>
        </div>

        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95 backdrop-blur-sm border-border">
            <div className="relative flex flex-col items-center justify-center">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {fileName}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Video preview
  if (mediaType === 'video' && previewUrl && !previewError) {
    return (
      <>
        <div 
          className="relative cursor-pointer group"
          onClick={() => setShowLightbox(true)}
        >
          <video
            src={previewUrl}
            className="rounded-lg max-w-[250px] max-h-[200px] object-cover"
            preload="metadata"
            muted
            onError={() => setPreviewError(true)}
          />
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/40 transition-colors">
            <div className="bg-white/90 rounded-full p-3 shadow-lg">
              <Play className="h-6 w-6 text-black fill-black" />
            </div>
          </div>
          <div className="absolute bottom-2 left-2 right-2">
            <div className="text-xs px-2 py-1 rounded bg-black/60 text-white truncate">
              {fileName}
            </div>
          </div>
        </div>

        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95 backdrop-blur-sm border-border">
            <div className="relative flex flex-col items-center justify-center">
              <video
                src={previewUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-lg"
              />
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {fileName}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Default file card layout (for non-media files or when preview fails)
  return (
    <div
      className={cn(
        "flex items-center gap-3 min-w-[180px] max-w-[250px]",
        isOwnMessage ? "text-primary-foreground" : ""
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg",
          isOwnMessage
            ? "bg-primary-foreground/10"
            : "bg-muted"
        )}
      >
        {getFileIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p
          className={cn(
            "text-xs",
            isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatFileSize(fileSize)}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "shrink-0 h-8 w-8",
          isOwnMessage && "text-primary-foreground hover:bg-primary-foreground/10"
        )}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
