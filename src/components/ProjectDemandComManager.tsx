import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, CheckCircle2, Circle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useProjectDemandCom, DemandComChecklistItem } from "@/hooks/useProjectDemandCom";
import { ProjectDemandComDialog } from "./ProjectDemandComDialog";

interface ProjectDemandComManagerProps {
  projectId: string;
}

export function ProjectDemandComManager({ projectId }: ProjectDemandComManagerProps) {
  const { checklistItems, isLoading, initializeChecklist, updateChecklistItem } =
    useProjectDemandCom(projectId);
  const [selectedItem, setSelectedItem] = useState<DemandComChecklistItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleInitialize = () => {
    initializeChecklist(projectId);
  };

  const handleEdit = (item: DemandComChecklistItem) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleUpdate = (data: {
    assigned_to?: string | null;
    due_date?: string | null;
    status?: "pending" | "in_progress" | "completed";
    description?: string | null;
  }) => {
    if (!selectedItem) return;

    updateChecklistItem({
      itemId: selectedItem.id,
      data: {
        ...data,
        assigned_to: data.assigned_to === "unassigned" ? null : data.assigned_to,
      },
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  // Group items by category
  const groupedItems = checklistItems.reduce((acc, item) => {
    const category = item.checklist_item.split(" - ")[0];
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, DemandComChecklistItem[]>);

  const completedCount = checklistItems.filter((i) => i.status === "completed").length;
  const totalCount = checklistItems.length;

  if (isLoading) {
    return <div className="text-center py-8">Loading checklist...</div>;
  }

  if (checklistItems.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          No DemandCom checklist found for this project.
        </p>
        <Button onClick={handleInitialize}>Initialize DemandCom Checklist</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">DemandCom Checklist Progress</h3>
          <p className="text-sm text-muted-foreground">
            {completedCount} of {totalCount} items completed
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
          </div>
          <div className="text-xs text-muted-foreground">Complete</div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedItems).map(([category, items]) => (
              <>
                <TableRow key={category} className="bg-muted/50">
                  <TableCell colSpan={7} className="font-semibold">
                    {category}
                  </TableCell>
                </TableRow>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{getStatusIcon(item.status)}</TableCell>
                    <TableCell className="font-medium">
                      {item.checklist_item.split(" - ")[1]}
                    </TableCell>
                    <TableCell>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">
                          No description
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.assigned_user?.full_name || (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.due_date ? (
                        format(new Date(item.due_date), "MMM dd, yyyy")
                      ) : (
                        <span className="text-muted-foreground">No date</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProjectDemandComDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={selectedItem}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
