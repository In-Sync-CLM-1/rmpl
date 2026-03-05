import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, MoveUp, MoveDown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PipelineStage {
  id: string;
  name: string;
  description: string | null;
  stage_order: number;
  stage_type: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export default function PipelineStages() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  const [stageTypeFilter, setStageTypeFilter] = useState<string>("participant");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    stage_order: "",
    stage_type: "participant",
    color: "#3b82f6",
  });

  useEffect(() => {
    checkAuthAndFetchStages();
  }, [stageTypeFilter]);

  const checkAuthAndFetchStages = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await fetchStages();
  };

  const fetchStages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("stage_type", stageTypeFilter)
        .order("stage_order", { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load pipeline stages");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dataToSave = {
        name: formData.name,
        description: formData.description || null,
        stage_order: parseInt(formData.stage_order),
        stage_type: formData.stage_type,
        color: formData.color,
      };

      if (selectedStage) {
        const { error } = await supabase
          .from("pipeline_stages")
          .update(dataToSave)
          .eq("id", selectedStage.id);

        if (error) throw error;
        toast.success("Stage updated successfully");
      } else {
        const { error } = await supabase
          .from("pipeline_stages")
          .insert([dataToSave]);

        if (error) throw error;
        toast.success("Stage created successfully");
      }

      setDialogOpen(false);
      setFormData({ name: "", description: "", stage_order: "", stage_type: "participant", color: "#3b82f6" });
      setSelectedStage(null);
      fetchStages();
    } catch (error: any) {
      toast.error(error.message || "Failed to save stage");
    }
  };

  const handleEdit = (stage: PipelineStage) => {
    setSelectedStage(stage);
    setFormData({
      name: stage.name,
      description: stage.description || "",
      stage_order: stage.stage_order.toString(),
      stage_type: stage.stage_type,
      color: stage.color,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stage?")) return;

    try {
      const { error } = await supabase
        .from("pipeline_stages")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Stage deleted successfully");
      fetchStages();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete stage");
    }
  };

  const handleReorder = async (stageId: string, direction: "up" | "down") => {
    const currentStage = stages.find(s => s.id === stageId);
    if (!currentStage) return;

    const newOrder = direction === "up" ? currentStage.stage_order - 1 : currentStage.stage_order + 1;
    
    if (newOrder < 1 || newOrder > stages.length) {
      toast.error("Cannot move stage further");
      return;
    }

    try {
      const { error } = await supabase
        .from("pipeline_stages")
        .update({ stage_order: newOrder })
        .eq("id", stageId);

      if (error) throw error;
      fetchStages();
    } catch (error: any) {
      toast.error("Failed to reorder stage");
    }
  };

  const filteredStages = stages.filter(stage =>
    stage.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">Pipeline Stages</h2>
        <p className="text-sm text-muted-foreground">Define workflow stages for participant progression</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pipeline Stage Management</CardTitle>
              <CardDescription>Create and organize workflow stages</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setSelectedStage(null);
                  const nextOrder = stages.length > 0 ? Math.max(...stages.map(s => s.stage_order)) + 1 : 1;
                  setFormData({ name: "", description: "", stage_order: nextOrder.toString(), stage_type: stageTypeFilter, color: "#3b82f6" });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Stage
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{selectedStage ? "Edit Stage" : "Create New Stage"}</DialogTitle>
                    <DialogDescription>
                      {selectedStage ? "Update stage information" : "Add a new stage to your pipeline"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="name">Stage Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="stage_type">Stage Type</Label>
                      <Select
                        value={formData.stage_type}
                        onValueChange={(value) => setFormData({ ...formData, stage_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="participant">Participant</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="project">Project</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="stage_order">Order</Label>
                      <Input
                        id="stage_order"
                        type="number"
                        min="1"
                        value={formData.stage_order}
                        onChange={(e) => setFormData({ ...formData, stage_order: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="color">Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="color"
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-20 h-10"
                        />
                        <Input
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          placeholder="#3b82f6"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {selectedStage ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={stageTypeFilter} onValueChange={setStageTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">Participant Stages</SelectItem>
                <SelectItem value="client">Client Stages</SelectItem>
                <SelectItem value="project">Project Stages</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredStages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No stages found</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Stage
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Stage Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStages.map((stage, index) => (
                  <TableRow key={stage.id}>
                    <TableCell className="font-medium">{stage.stage_order}</TableCell>
                    <TableCell>{stage.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{stage.stage_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-sm text-muted-foreground">{stage.color}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{stage.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={stage.is_active ? "default" : "secondary"}>
                        {stage.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(stage.id, "up")}
                          disabled={index === 0}
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(stage.id, "down")}
                          disabled={index === filteredStages.length - 1}
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(stage)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(stage.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
