import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Megaphone, Sparkles, Loader2, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default function Announcements() {
  const queryClient = useQueryClient();
  const [changeDescription, setChangeDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAnnouncement, setGeneratedAnnouncement] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form state for editing the announcement
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [announcementType, setAnnouncementType] = useState("improvement");
  const [priority, setPriority] = useState("medium");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  // Fetch existing announcements
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_announcements")
        .select("*")
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Pagination calculations
  const totalItems = announcements?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAnnouncements = announcements?.slice(startIndex, startIndex + itemsPerPage) || [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Generate announcement with AI
  const handleGenerate = async () => {
    if (!changeDescription.trim()) {
      toast.error("Please enter a change description");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-announcement", {
        body: { changeDescription },
      });

      if (error) throw error;

      setGeneratedAnnouncement(data);
      setTitle(data.title);
      setDescription(data.description);
      setAnnouncementType(data.announcement_type);
      setPriority(data.priority);
      toast.success("Announcement generated successfully!");
    } catch (error: any) {
      console.error("Error generating announcement:", error);
      toast.error(error.message || "Failed to generate announcement");
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate and publish announcement directly
  const handleGenerateAndPublish = async () => {
    if (!changeDescription.trim()) {
      toast.error("Please enter a change description");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-announcement", {
        body: { 
          changeDescription,
          autoSave: true,
          targetRoles: null 
        },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
      toast.success("Announcement generated and published!");
      
      // Reset form
      setChangeDescription("");
      setGeneratedAnnouncement(null);
      setTitle("");
      setDescription("");
    } catch (error: any) {
      console.error("Error generating and publishing announcement:", error);
      toast.error(error.message || "Failed to generate and publish announcement");
    } finally {
      setIsGenerating(false);
    }
  };

  // Publish announcement
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!title || !description) {
        throw new Error("Title and description are required");
      }

      const { error } = await supabase.from("feature_announcements").insert({
        title,
        description,
        announcement_type: announcementType,
        priority,
        image_url: imageUrl || null,
        link_url: linkUrl || null,
        link_text: linkText || null,
        is_active: true,
        published_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
      toast.success("Announcement published!");
      // Reset form
      setChangeDescription("");
      setGeneratedAnnouncement(null);
      setTitle("");
      setDescription("");
      setImageUrl("");
      setLinkUrl("");
      setLinkText("");
      setAnnouncementType("improvement");
      setPriority("medium");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to publish announcement");
    },
  });

  // Toggle announcement active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("feature_announcements")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
      toast.success("Announcement updated");
    },
  });

  // Delete announcement
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("feature_announcements")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-admin"] });
      toast.success("Announcement deleted");
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Megaphone className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Announcements Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* AI Generator Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Generate with AI</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="change-description">Describe the Changes</Label>
              <Textarea
                id="change-description"
                placeholder="E.g. Added company name field to edit contact dialog, removed mobile 2 and generic email fields"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                className="min-h-[120px] mt-2"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !changeDescription.trim()}
                className="flex-1"
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>

              <Button
                onClick={handleGenerateAndPublish}
                disabled={isGenerating || !changeDescription.trim()}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate & Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Preview/Edit Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {generatedAnnouncement ? "Preview & Edit" : "Create Manually"}
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter announcement title"
                maxLength={50}
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter announcement description"
                maxLength={200}
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={announcementType} onValueChange={setAnnouncementType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_feature">New Feature</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="bug_fix">Bug Fix</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="removal">Removal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="image">Image URL (optional)</Label>
              <Input
                id="image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>

            <div>
              <Label htmlFor="link">Link URL (optional)</Label>
              <Input
                id="link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="/feature-page or https://..."
              />
            </div>

            <div>
              <Label htmlFor="link-text">Link Text (optional)</Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Learn more"
              />
            </div>

            <Button
              onClick={() => publishMutation.mutate()}
              disabled={!title || !description || publishMutation.isPending}
              className="w-full"
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Megaphone className="mr-2 h-4 w-4" />
                  Publish Announcement
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Existing Announcements List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Published Announcements</h2>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : announcements && announcements.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {announcement.announcement_type.replace("_", " ")}
                      </Badge>
                      <Badge
                        variant={
                          announcement.priority === "high"
                            ? "destructive"
                            : announcement.priority === "medium"
                            ? "default"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {announcement.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {announcement.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Published: {format(new Date(announcement.published_at), "MMM dd, yyyy")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${announcement.id}`} className="text-sm">
                        Active
                      </Label>
                      <Switch
                        id={`active-${announcement.id}`}
                        checked={announcement.is_active}
                        onCheckedChange={() =>
                          toggleActiveMutation.mutate({
                            id: announcement.id,
                            isActive: announcement.is_active,
                          })
                        }
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this announcement?")) {
                          deleteMutation.mutate(announcement.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No announcements yet. Create your first one above!
          </div>
        )}
      </Card>
    </div>
  );
}
