import { useState, useRef, useEffect, useCallback, KeyboardEvent, ClipboardEvent } from "react";
import { useMessages, ChatMessage } from "@/hooks/useMessages";
import { useChatFileUpload } from "@/hooks/useChatFileUpload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, ListTodo, Loader2, X, Image, Reply } from "lucide-react";
import { toast } from "sonner";
import { TaskPickerDialog } from "./TaskPickerDialog";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for other files

const isImageFile = (file: File) => file.type.startsWith("image/");

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface MessageInputProps {
  conversationId: string | null;
  disabled?: boolean;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

export function MessageInput({ conversationId, disabled, replyTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      // Max height ~96px for 4 lines
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
    }
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);
  
  const { sendMessage } = useMessages(conversationId);
  const { uploadFile, isUploading } = useChatFileUpload();

  const handleSend = async () => {
    if (!conversationId) return;
    
    const trimmedContent = content.trim();
    
    if (!trimmedContent && !pendingFile) return;

    try {
      // Handle file upload first if there's a pending file
      if (pendingFile) {
        const uploadResult = await uploadFile(pendingFile, conversationId);
        if (uploadResult) {
          await sendMessage.mutateAsync({
            messageType: "file",
            fileUrl: uploadResult.path,
            fileName: uploadResult.name,
            fileSize: uploadResult.size,
          });
        }
        setPendingFile(null);
      }

      // Send text message if there's content
      if (trimmedContent) {
        await sendMessage.mutateAsync({
          content: trimmedContent,
          messageType: "text",
          replyToId: replyTo?.id,
        });
        setContent("");
        onCancelReply?.();
      }
      // Auto-focus so user can type next message immediately
      setTimeout(() => textareaRef.current?.focus(), 0);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImage = isImageFile(file);
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
      if (file.size > maxSize) {
        toast.error(`${isImage ? "Image" : "File"} size must be less than ${isImage ? "5MB" : "10MB"}`);
        return;
      }
      setPendingFile(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (file.size > MAX_IMAGE_SIZE) {
            toast.error("Image size must be less than 5MB");
            return;
          }
          setPendingFile(file);
        }
        break;
      }
    }
  };

  const handleTaskSelect = async (task: { 
    id: string; 
    task_name: string; 
    task_type: "general" | "project";
    project_name?: string;
  }) => {
    if (!conversationId) return;
    
    try {
      const prefix = task.task_type === "project" && task.project_name
        ? `[${task.project_name}] `
        : "";
      
      await sendMessage.mutateAsync({
        content: `${prefix}Shared task: ${task.task_name}`,
        messageType: "task_share",
        taskId: task.task_type === "general" ? task.id : undefined,
        projectTaskId: task.task_type === "project" ? task.id : undefined,
      });
      setShowTaskPicker(false);
      toast.success("Task shared");
      setTimeout(() => textareaRef.current?.focus(), 0);
    } catch (error) {
      console.error("Failed to share task:", error);
      toast.error("Failed to share task");
    }
  };

  const isDisabled = disabled || !conversationId || sendMessage.isPending || isUploading;

  return (
    <div className="p-4 border-t bg-background">
      {/* Reply banner */}
      {replyTo && (
        <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between gap-2 border-l-2 border-primary">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-medium block">
                {replyTo.sender?.full_name || "Unknown"}
              </span>
              <span className="text-xs text-muted-foreground truncate block max-w-[250px]">
                {replyTo.message_type === "file" ? "📎 File" : (replyTo.content?.slice(0, 60) || "")}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {pendingFile && (
        <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isImageFile(pendingFile) ? (
              <img 
                src={URL.createObjectURL(pendingFile)} 
                alt="Preview" 
                className="h-12 w-12 object-cover rounded flex-shrink-0"
              />
            ) : (
              <Paperclip className="h-4 w-4 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-sm truncate block max-w-[180px]">{pendingFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(pendingFile.size)}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => setPendingFile(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="shrink-0"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setShowTaskPicker(true)}
          disabled={isDisabled}
          className="shrink-0"
        >
          <ListTodo className="h-5 w-5" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Type a message... (paste images with Ctrl+V)"
          rows={1}
          className="min-h-[40px] max-h-[96px] resize-none overflow-y-auto py-2"
          disabled={isDisabled}
        />

        <Button
          onClick={handleSend}
          disabled={isDisabled || (!content.trim() && !pendingFile)}
          size="icon"
          className="shrink-0"
        >
          {sendMessage.isPending || isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      <TaskPickerDialog
        open={showTaskPicker}
        onOpenChange={setShowTaskPicker}
        onSelect={handleTaskSelect}
      />
    </div>
  );
}
