import { useState, useRef } from "react";
import { FormDialog } from "./forms/FormDialog";
import { FormField } from "./forms/FormField";
import { Textarea } from "./ui/textarea";
import { CheckCircle2, Upload, X, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (notes: string, files: File[]) => Promise<void>;
  taskName: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

export function CompleteTaskDialog({ 
  open, 
  onOpenChange, 
  onConfirm,
  taskName,
}: CompleteTaskDialogProps) {
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;
    
    setIsLoading(true);
    try {
      await onConfirm(notes, files);
      setNotes("");
      setFiles([]);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilesSelect = (selectedFiles: FileList | File[]) => {
    const validFiles: File[] = [];
    const fileArray = Array.from(selectedFiles);
    
    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        continue; // Skip files larger than 10MB
      }
      if (files.length + validFiles.length >= MAX_FILES) {
        break; // Stop if we've reached max files
      }
      // Avoid duplicates by name
      if (!files.some(f => f.name === file.name) && !validFiles.some(f => f.name === file.name)) {
        validFiles.push(file);
      }
    }
    
    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelect(e.target.files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setNotes("");
          setFiles([]);
        }
        onOpenChange(isOpen);
      }}
      title="Complete Task"
      description={`You are about to complete the task "${taskName}". Please provide a completion note.`}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel="Complete Task"
    >
      <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg mb-4">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm text-muted-foreground">
          This will mark the task as "Completed"
        </span>
      </div>

      <FormField label="Completion Notes" htmlFor="completion_notes" required>
        <Textarea
          id="completion_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter details about task completion..."
          rows={4}
          required
        />
      </FormField>

      <FormField label={`Attach Files (Optional, max ${MAX_FILES})`} htmlFor="completion_files">
        <input
          ref={fileInputRef}
          type="file"
          id="completion_files"
          className="hidden"
          onChange={handleInputChange}
          multiple
        />
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            files.length >= MAX_FILES && "opacity-50 pointer-events-none"
          )}
        >
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag & drop files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max {MAX_FILES} files, 10MB each
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </p>
            {files.map((file) => (
              <div 
                key={file.name}
                className="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.name);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </FormField>
    </FormDialog>
  );
}
