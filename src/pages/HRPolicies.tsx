import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Download, Trash2, Folder, Plus, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const DOCUMENT_CATEGORIES = [
  { value: "HR Policies", label: "HR Policies", icon: "📋" },
  { value: "Leave Policy", label: "Leave Policy", icon: "🏖️" },
  { value: "Attendance Policy", label: "Attendance Policy", icon: "⏰" },
  { value: "Code of Conduct", label: "Code of Conduct", icon: "📖" },
  { value: "Internal Documents", label: "Internal Documents", icon: "📁" },
];

interface HRDocument {
  id: string;
  category: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  version: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function HRPolicies() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    title: "",
    description: "",
    file: null as File | null,
  });
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissions();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["hr-policy-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_policy_documents")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("title");

      if (error) throw error;
      return data as HRDocument[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.file) throw new Error("No file selected");

      setUploading(true);
      
      // Upload file to storage
      const fileExt = data.file.name.split(".").pop();
      const fileName = `${Date.now()}-${data.title.replace(/\s+/g, "-")}.${fileExt}`;
      const filePath = `${data.category}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("hr-policy-documents")
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: dbError } = await supabase
        .from("hr_policy_documents")
        .insert({
          category: data.category,
          title: data.title,
          description: data.description || null,
          file_path: filePath,
          file_name: data.file.name,
          file_size: data.file.size,
          mime_type: data.file.type,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-policy-documents"] });
      setUploadDialogOpen(false);
      setFormData({ category: "", title: "", description: "", file: null });
      toast.success("Document uploaded successfully!");
    },
    onError: (error: Error) => {
      toast.error("Failed to upload: " + error.message);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: HRDocument) => {
      // Delete from storage
      await supabase.storage.from("hr-policy-documents").remove([doc.file_path]);
      
      // Soft delete from database
      const { error } = await supabase
        .from("hr_policy_documents")
        .update({ is_active: false })
        .eq("id", doc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-policy-documents"] });
      toast.success("Document deleted successfully!");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const handleDownload = async (doc: HRDocument) => {
    const { data, error } = await supabase.storage
      .from("hr-policy-documents")
      .createSignedUrl(doc.file_path, 60);

    if (error) {
      toast.error("Failed to generate download link");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate(formData);
  };

  const filteredDocuments = selectedCategory === "all" 
    ? documents 
    : documents.filter(d => d.category === selectedCategory);

  const groupedDocuments = filteredDocuments.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, HRDocument[]>);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">HR Policies & Documents</h1>
          <p className="text-muted-foreground">Company policies and internal documents</p>
        </div>
        {permissions?.canManageHRDocuments && (
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory("all")}
        >
          All Documents
        </Button>
        {DOCUMENT_CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={selectedCategory === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.value)}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(groupedDocuments).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No documents available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([category, docs]) => {
            const categoryInfo = DOCUMENT_CATEGORIES.find(c => c.value === category);
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">{categoryInfo?.icon || "📄"}</span>
                    {category}
                    <Badge variant="secondary">{docs.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{doc.title}</h4>
                          {doc.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span>•</span>
                            <span>v{doc.version || "1.0"}</span>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(doc)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            {permissions?.canManageHRDocuments && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(doc)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload HR Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Leave Policy 2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the document"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                required
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, Word, Excel, PowerPoint
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || !formData.file || !formData.category}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
