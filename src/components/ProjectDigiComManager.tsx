import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectDigiCom } from "@/hooks/useProjectDigiCom";
import { ProjectDigiComDialog } from "./ProjectDigiComDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, CheckCircle2, Circle, Clock } from "lucide-react";
import { format, isPast } from "date-fns";
import type { DigiComChecklistItem } from "@/hooks/useProjectDigiCom";

interface ProjectDigiComManagerProps {
  projectId: string;
}

export function ProjectDigiComManager({ projectId }: ProjectDigiComManagerProps) {
  const {
    checklistItems,
    isLoading,
    initializeChecklist,
    isInitializing,
    updateChecklistItem,
  } = useProjectDigiCom(projectId);

  const [selectedItem, setSelectedItem] = useState<DigiComChecklistItem | null>(
    null
  );

  // Fetch team members for the project
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["project-team-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_team_members")
        .select(
          `
          user:profiles!user_id (
            id,
            full_name
          )
        `
        )
        .eq("project_id", projectId);

      if (error) throw error;
      return data.map((tm: any) => tm.user);
    },
    enabled: !!projectId && projectId !== "new",
  });

  // Initialize checklist if empty
  useEffect(() => {
    if (!isLoading && checklistItems.length === 0 && !isInitializing) {
      initializeChecklist();
    }
  }, [isLoading, checklistItems.length, isInitializing, initializeChecklist]);

  // Group items by category
  const groupedItems = checklistItems.reduce(
    (acc, item) => {
      const category = item.checklist_item.split(" - ")[0];
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, DigiComChecklistItem[]>
  );

  // Calculate completion stats
  const completedCount = checklistItems.filter(
    (item) => item.status === "completed"
  ).length;
  const totalCount = checklistItems.length;
  const completionPercentage = totalCount > 0 
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const handleSave = async (data: {
    assigned_to?: string | null;
    due_date?: string | null;
    status?: "pending" | "in_progress" | "completed";
  }) => {
    if (selectedItem) {
      await updateChecklistItem({ id: selectedItem.id, data });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-600">In Progress</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (isLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading checklist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">DigiCom Checklist Progress</h3>
          <span className="text-sm font-medium">
            {completedCount} of {totalCount} completed
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {completionPercentage}% complete
        </p>
      </div>

      {/* Checklist by Category */}
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            {category}
          </h4>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isOverdue =
                    item.due_date &&
                    isPast(new Date(item.due_date)) &&
                    item.status !== "completed";

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{getStatusIcon(item.status)}</TableCell>
                      <TableCell className="font-medium">
                        {item.checklist_item.split(" - ")[1]}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {item.description ? (
                          <span className="text-sm text-muted-foreground truncate block">
                            {item.description}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.assigned_user?.full_name || (
                          <span className="text-muted-foreground italic">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.due_date ? (
                          <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                            {format(new Date(item.due_date), "MMM dd, yyyy")}
                            {isOverdue && " (Overdue)"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedItem(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {/* Edit Dialog */}
      <ProjectDigiComDialog
        item={selectedItem}
        teamMembers={teamMembers}
        onSave={handleSave}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
