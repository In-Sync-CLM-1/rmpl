import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuthCheck } from "@/hooks/useAuthCheck";
import { useFormDialog } from "@/hooks/useFormDialog";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { FormDialog } from "@/components/forms/FormDialog";
import { FormField } from "@/components/forms/FormField";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

interface Designation {
  id: string;
  title: string;
  description: string | null;
  level: number | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

interface DesignationFormData {
  title: string;
  description: string;
  level: string;
  department: string;
}

export default function Designations() {
  useAuthCheck();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [designationToDelete, setDesignationToDelete] = useState<Designation | null>(null);
  const [formData, setFormData] = useState<DesignationFormData>({
    title: "",
    description: "",
    level: "",
    department: "",
  });

  const {
    data: designations,
    isLoading,
    refetch,
  } = usePaginatedQuery<Designation>({
    queryKey: ["designations"],
    queryFn: async (from, to) => {
      const { data, error, count } = await supabase
        .from("designations")
        .select("*", { count: "exact" })
        .order("level", { ascending: true })
        .range(from, to);
      return { data, count, error };
    },
    initialItemsPerPage: 100, // Show all designations
  });

  const { create, update, delete: deleteDesignation, isDeleting } = useCrudMutation<Designation>({
    queryKey: ["designations"],
    createFn: async (data) => {
      const { data: result, error } = await supabase
        .from("designations")
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    updateFn: async (id, data) => {
      const { data: result, error } = await supabase
        .from("designations")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    deleteFn: async (id) => {
      const { error } = await supabase.from("designations").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: {
      create: "Designation created successfully",
      update: "Designation updated successfully",
      delete: "Designation deleted successfully",
    },
    errorMessages: {
      create: "Failed to create designation",
      update: "Failed to update designation",
      delete: "Failed to delete designation",
    },
  });

  const formDialog = useFormDialog<Designation>({
    onSubmit: async (data) => {
      const dataToSave = {
        title: formData.title,
        description: formData.description || null,
        level: formData.level ? parseInt(formData.level) : null,
        department: formData.department || null,
      };

      if (formDialog.isEditing && formDialog.selectedItem) {
        await update({ id: formDialog.selectedItem.id, data: dataToSave });
      } else {
        await create(dataToSave);
      }
    },
    onSuccess: () => {
      setFormData({ title: "", description: "", level: "", department: "" });
    },
    transformForEdit: (item) => ({
      title: item.title,
      description: item.description || "",
      level: item.level?.toString() || "",
      department: item.department || "",
    }),
  });

  const handleOpenDialog = (designation?: Designation) => {
    if (designation) {
      const transformed = formDialog.getInitialValues();
      if (transformed) {
        setFormData(transformed);
      }
    } else {
      setFormData({ title: "", description: "", level: "", department: "" });
    }
    formDialog.openDialog(designation);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDesignation(deleteId);
      setDeleteId(null);
      setDesignationToDelete(null);
    }
  };

  const filteredDesignations = designations.filter(
    (designation) =>
      designation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      designation.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: DataTableColumn<Designation>[] = [
    {
      header: "Title",
      cell: (designation) => <span className="font-medium">{designation.title}</span>,
    },
    {
      header: "Department",
      cell: (designation) => designation.department || "—",
    },
    {
      header: "Level",
      cell: (designation) =>
        designation.level ? (
          <Badge variant="outline">Level {designation.level}</Badge>
        ) : (
          "—"
        ),
    },
    {
      header: "Description",
      cell: (designation) => (
        <span className="max-w-xs truncate">{designation.description || "—"}</span>
      ),
    },
    {
      header: "Status",
      cell: (designation) => (
        <Badge variant={designation.is_active ? "default" : "secondary"}>
          {designation.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">Designations</h2>
        <p className="text-sm text-muted-foreground">
          Define position titles and organizational roles
        </p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Designation Management</CardTitle>
              <CardDescription>
                Create and manage position titles and roles
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Designation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search designations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <DataTable
            data={filteredDesignations}
            columns={columns}
            isLoading={isLoading}
            getRowKey={(designation) => designation.id}
            emptyState={{
              icon: Briefcase,
              title: "No designations found",
              description: "Get started by creating your first designation",
              actionLabel: "Create Designation",
              onAction: () => handleOpenDialog(),
            }}
            actions={(designation) => (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDialog(designation)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteId(designation.id);
                    setDesignationToDelete(designation);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          />
        </CardContent>
      </Card>

      <FormDialog
        open={formDialog.isOpen}
        onOpenChange={formDialog.closeDialog}
        title={formDialog.isEditing ? "Edit Designation" : "Create New Designation"}
        description={
          formDialog.isEditing
            ? "Update designation information"
            : "Add a new designation to your organization"
        }
        onSubmit={() => formDialog.handleSubmit(formDialog.selectedItem!)}
        isLoading={formDialog.isSaving}
        submitLabel={formDialog.isEditing ? "Update" : "Create"}
      >
        <FormField label="Position Title" htmlFor="title" required>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Department" htmlFor="department">
          <Input
            id="department"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
        </FormField>
        <FormField label="Seniority Level (1-10)" htmlFor="level">
          <Input
            id="level"
            type="number"
            min="1"
            max="10"
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
          />
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </FormField>
      </FormDialog>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDesignationToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        itemName={designationToDelete?.title}
        isLoading={isDeleting}
      />
    </div>
  );
}
