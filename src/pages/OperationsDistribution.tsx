import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumn } from "@/components/data-table/DataTable";
import { DistributionDialog } from "@/components/operations/DistributionDialog";
import { useOperationsDistribution, type OperationsDistribution } from "@/hooks/useOperationsDistribution";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileDown, Pencil, Trash2, Search, Package } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";
import { Badge } from "@/components/ui/badge";

function OperationsDistribution() {
  const { distributions, isLoading, createDistribution, updateDistribution, deleteDistribution } = useOperationsDistribution();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<OperationsDistribution | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [distributionToDelete, setDistributionToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");

  const handleCreate = () => {
    setEditingDistribution(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (distribution: OperationsDistribution) => {
    setEditingDistribution(distribution);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDistributionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (distributionToDelete) {
      await deleteDistribution(distributionToDelete);
      setDeleteDialogOpen(false);
      setDistributionToDelete(null);
    }
  };

  const handleExport = () => {
    if (!distributions) return;
    
    const exportData = distributions.map((d) => ({
      "Project": d.projects?.project_number || "N/A",
      "Client": d.client_name || d.projects?.project_name || "N/A",
      "Item": d.inventory_items?.items || "N/A",
      "Brand": d.inventory_items?.brand || "",
      "Model": d.inventory_items?.model || "",
      "Type": d.distribution_type,
      "Qty Dispatched": d.quantity_dispatched,
      "Date": format(new Date(d.despatch_date), "dd/MM/yyyy"),
      "Despatched To": d.despatched_to,
      "Location": d.location || "",
      "Mode": d.dispatch_mode === "by_hand" ? "By Hand" : "Courier",
      "AWB": d.awb_number || "",
      "Usage": d.usage_count,
      "Damaged/Lost": d.damaged_lost_count,
      "Balance": d.quantity_dispatched - d.usage_count - d.damaged_lost_count,
      "Return Location": d.return_location || "",
      "Images": d.images?.length || 0,
      "Notes": d.notes || "",
    }));

    exportToCSV(exportData, "operations-distribution", []);
  };

  const filteredDistributions = distributions?.filter((d) => {
    const matchesSearch = 
      d.despatched_to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.projects?.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.inventory_items?.items.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || d.distribution_type === typeFilter;
    const matchesMode = modeFilter === "all" || d.dispatch_mode === modeFilter;

    return matchesSearch && matchesType && matchesMode;
  });

  const columns: DataTableColumn<OperationsDistribution>[] = [
    {
      header: "Project / Client",
      accessorKey: "projects",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium">
            {row.projects?.project_number || "No Project"}
          </span>
          <span className="text-sm text-muted-foreground">
            {row.client_name || row.projects?.project_name || "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Inventory Item",
      accessorKey: "inventory_items",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{row.inventory_items?.items}</span>
          {row.inventory_items?.brand && (
            <span className="text-sm text-muted-foreground">
              {row.inventory_items.brand} {row.inventory_items.model}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Type",
      accessorKey: "distribution_type",
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.distribution_type.replace("_", " ")}
        </Badge>
      ),
    },
    {
      header: "Date",
      accessorKey: "despatch_date",
      cell: (row) => format(new Date(row.despatch_date), "dd MMM yyyy"),
    },
    {
      header: "Despatched To",
      accessorKey: "despatched_to",
    },
    {
      header: "Location",
      accessorKey: "location",
      cell: (row) => row.location || "-",
    },
    {
      header: "Mode",
      accessorKey: "dispatch_mode",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="capitalize">{row.dispatch_mode.replace("_", " ")}</span>
          {row.dispatch_mode === "courier" && row.awb_number && (
            <span className="text-xs text-muted-foreground">AWB: {row.awb_number}</span>
          )}
        </div>
      ),
    },
    {
      header: "Images",
      accessorKey: "images",
      cell: (row) => {
        if (!row.images || row.images.length === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex gap-1">
            {row.images.slice(0, 3).map((url, idx) => (
              <img 
                key={idx} 
                src={url} 
                alt={`Image ${idx + 1}`}
                className="h-8 w-8 object-cover rounded border border-border"
              />
            ))}
            {row.images.length > 3 && (
              <div className="h-8 w-8 flex items-center justify-center rounded border border-border bg-muted text-xs">
                +{row.images.length - 3}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: "Quantities",
      accessorKey: "quantity_dispatched",
      cell: (row) => (
        <div className="flex flex-col gap-1 text-sm">
          <span>Dispatched: {row.quantity_dispatched}</span>
          <span className="text-muted-foreground">Usage: {row.usage_count}</span>
          <span className="text-muted-foreground">Lost/Damaged: {row.damaged_lost_count}</span>
          <span className="font-medium text-primary">
            Balance: {row.quantity_dispatched - row.usage_count - row.damaged_lost_count}
          </span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full px-6 py-6 space-y-4 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Operations Distribution</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline">
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Distribution
            </Button>
          </div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client, recipient, or item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="text-sm font-medium mb-2 block">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="gift">Gift</SelectItem>
                <SelectItem value="event_item">Event Item</SelectItem>
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <label className="text-sm font-medium mb-2 block">Mode</label>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="by_hand">By Hand</SelectItem>
                <SelectItem value="courier">Courier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          data={filteredDistributions || []}
          columns={columns}
          isLoading={isLoading}
          getRowKey={(row) => row.id}
          emptyState={{
            icon: Package,
            title: "No distributions found",
            description: "Start by adding your first distribution record",
          }}
        />

        <DistributionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={async (data) => {
            if (editingDistribution) {
              await updateDistribution({ id: editingDistribution.id, formData: data });
            } else {
              await createDistribution(data);
            }
          }}
          initialData={editingDistribution}
        />

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Distribution"
          description="Are you sure you want to delete this distribution record? This action cannot be undone."
        />
    </div>
  );
}

export default OperationsDistribution;
