import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Download, Upload, FileText, Eye, Pencil, Trash2, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InventoryItem {
  id: string;
  invoice_no: string;
  date_of_purchase: string;
  vendor_name: string;
  invoice_date: string;
  items: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  imei: string | null;
  status: string;
  current_condition: string;
  quantity: number;
  rate: number;
  units: string;
  total_price: number;
  gst_slab: number;
  gst_amount: number;
  total_cost: number;
  invoice_file_url: string | null;
  created_at: string;
  category: string | null;
  line_number: number | null;
}

interface Vendor {
  id: string;
  vendor_name: string;
}

const GST_SLABS = [0, 5, 12, 18, 28, 40];

export default function Inventory() {
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedGstSlabs, setSelectedGstSlabs] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: undefined, to: undefined });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);

  // Load vendors for filter
  useEffect(() => {
    const loadVendors = async () => {
      try {
        const result = await (supabase as any)
          .from("vendors")
          .select("id, vendor_name")
          .order("vendor_name");
        if (result.data) setVendors(result.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadVendors();
  }, []);

  const queryKeyArray: any[] = [
    "inventory",
    searchTerm,
    selectedVendor,
    JSON.stringify(selectedGstSlabs),
    JSON.stringify(dateRange),
  ];

  const {
    data: items,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
    refetch,
  } = usePaginatedQuery<InventoryItem>({
    queryKey: queryKeyArray as string[],
    queryFn: async (from, to) => {
      let query = supabase
        .from("inventory_items")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      // Search filter
      if (searchTerm) {
        query = query.or(
          `invoice_no.ilike.%${searchTerm}%,vendor_name.ilike.%${searchTerm}%,items.ilike.%${searchTerm}%`
        );
      }

      // Vendor filter
      if (selectedVendor !== "all") {
        query = query.eq("vendor_name", selectedVendor);
      }

      // GST slab filter
      if (selectedGstSlabs.length > 0) {
        query = query.in("gst_slab", selectedGstSlabs);
      }

      // Date range filter
      if (dateRange.from) {
        query = query.gte("date_of_purchase", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange.to) {
        query = query.lte("date_of_purchase", format(dateRange.to, "yyyy-MM-dd"));
      }

      const { data, count, error } = await query;
      return { data, count, error };
    },
    initialItemsPerPage: 25,
  });

  const { delete: deleteInventory, isDeleting } = useCrudMutation<InventoryItem>({
    queryKey: ["inventory"],
    createFn: async () => ({ id: "" } as InventoryItem),
    updateFn: async () => ({ id: "" } as InventoryItem),
    deleteFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: { delete: "Inventory item deleted successfully" },
    errorMessages: { delete: "Failed to delete inventory item" },
  });

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteInventory(deleteItem.id);
      setDeleteItem(null);
      refetch();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleExport = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("No inventory items to export");
        return;
      }

      const headers = [
        "Invoice No", "Date of Purchase", "Vendor Name", "Invoice Date", "Items",
        "Brand", "Model", "Item Description", "Quantity", "Rate", "Units",
        "Total Price", "GST Slab", "GST Amount", "Total Cost", "Created Date"
      ];

      const csvContent = [
        headers.join(","),
        ...data.map(item =>
          [
            item.invoice_no,
            format(new Date(item.date_of_purchase), "dd/MM/yyyy"),
            item.vendor_name,
            format(new Date(item.invoice_date), "dd/MM/yyyy"),
            `"${item.items}"`,
            item.brand || "",
            item.model || "",
            item.item_description ? `"${item.item_description}"` : "",
            item.quantity,
            item.rate,
            item.units,
            item.total_price,
            item.gst_slab,
            item.gst_amount,
            item.total_cost,
            format(new Date(item.created_at), "dd/MM/yyyy HH:mm")
          ].join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Inventory exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export inventory");
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Date of Purchase", "Vendor Name", "Invoice Date", "Invoice No", "Items",
      "Brand", "Model", "Items Description", "Quantity", "Rate", "Units", "GST Slab", "Category"
    ];

    const sampleData = [
      "15/01/2025", "ABC Tech Solutions", "10/01/2025", "INV-2025-001", "Laptop",
      "Dell", "Latitude 5520", "Intel i7 16GB RAM", "5", "45000", "Count", "18", "IT"
    ];

    const csvContent = [headers.join(","), sampleData.join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Template downloaded");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const toggleGstSlab = (slab: number) => {
    setSelectedGstSlabs(prev =>
      prev.includes(slab) ? prev.filter(s => s !== slab) : [...prev, slab]
    );
  };

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      header: "Invoice No",
      accessorKey: "invoice_no",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.invoice_no}</span>
          {item.line_number && (
            <Badge variant="outline" className="text-xs">
              #{item.line_number}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: "Category",
      accessorKey: "category",
      cell: (item) => (
        <Badge variant={item.category === "IT" ? "default" : "secondary"}>
          {item.category || "Operations"}
        </Badge>
      ),
    },
    {
      header: "Serial Number",
      accessorKey: "serial_number",
      cell: (item) => item.serial_number || "-",
    },
    {
      header: "IMEI",
      accessorKey: "imei",
      cell: (item) => item.imei || "-",
    },
    {
      header: "Vendor",
      accessorKey: "vendor_name",
    },
    {
      header: "Purchase Date",
      accessorKey: "date_of_purchase",
      cell: (item) => format(new Date(item.date_of_purchase), "dd/MM/yyyy"),
    },
    {
      header: "Items",
      accessorKey: "items",
      cell: (item) => (
        <div className="max-w-[200px] truncate" title={item.items}>
          {item.items}
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (item) => {
        const statusColors = {
          Available: "bg-green-500/10 text-green-600 border-green-500/20",
          Allocated: "bg-blue-500/10 text-blue-600 border-blue-500/20",
          Damaged: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
          Retired: "bg-red-500/10 text-red-600 border-red-500/20",
        };
        const status = item.status || "Available";
        return (
          <Badge variant="outline" className={statusColors[status as keyof typeof statusColors]}>
            {status}
          </Badge>
        );
      },
    },
    {
      header: "Condition",
      accessorKey: "current_condition",
      cell: (item) => item.current_condition || "New",
    },
    {
      header: "Quantity",
      accessorKey: "quantity",
      cell: (item) => `${item.quantity} ${item.units}`,
    },
    {
      header: "Rate",
      accessorKey: "rate",
      cell: (item) => formatCurrency(item.rate),
    },
    {
      header: "GST",
      accessorKey: "gst_slab",
      cell: (item) => (
        <Badge variant="outline" className="bg-primary/10">
          {item.gst_slab}%
        </Badge>
      ),
    },
    {
      header: "Total Cost",
      accessorKey: "total_cost",
      cell: (item) => (
        <span className="font-semibold">{formatCurrency(item.total_cost)}</span>
      ),
    },
    {
      header: "Invoice",
      cell: (item) =>
        item.invoice_file_url ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(item.invoice_file_url!, "_blank")}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">No file</span>
        ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">
              Manage and track your inventory items
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileText className="mr-2 h-4 w-4" />
            Template
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          {permissions.canManageInventory && (
            <Button onClick={() => navigate("/inventory/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Inventory
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input
          placeholder="Search invoice no, vendor, items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="All Vendors" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.vendor_name}>
                {vendor.vendor_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal")}>
              {dateRange.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                ) : (
                  format(dateRange.from, "dd/MM/yyyy")
                )
              ) : (
                "Date Range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start">
              GST Slabs {selectedGstSlabs.length > 0 && `(${selectedGstSlabs.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 bg-popover z-50">
            <div className="space-y-2">
              {GST_SLABS.map((slab) => (
                <div key={slab} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedGstSlabs.includes(slab)}
                    onChange={() => toggleGstSlab(slab)}
                    className="h-4 w-4"
                  />
                  <label className="text-sm">{slab}%</label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Data Table */}
      <DataTable
        data={items}
        columns={columns}
        getRowKey={(item) => item.id}
        isLoading={isLoading}
        emptyState={{
          icon: Package2,
          title: "No inventory items found",
          description: "Get started by adding your first inventory item",
          actionLabel: "Add Inventory",
          onAction: () => navigate("/inventory/new"),
        }}
        actions={(item) => (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/inventory/${item.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {permissions.canDeleteInventory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteItem(item)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        )}
        pagination={{
          currentPage,
          totalPages,
          itemsPerPage,
          totalItems: totalCount,
          onPageChange: handlePageChange,
          onItemsPerPageChange: handleItemsPerPageChange,
        }}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        tableName="inventory_items"
        tableLabel="Inventory"
        requiredColumns={[
          "date_of_purchase",
          "vendor_name",
          "invoice_date",
          "invoice_no",
          "items",
          "quantity",
          "rate",
          "units",
        ]}
        templateColumns={[
          "Date of Purchase",
          "Vendor Name",
          "Invoice Date",
          "Invoice No",
          "Items",
          "Brand",
          "Model",
          "Items Description",
          "Quantity",
          "Rate",
          "Units",
          "GST Slab",
        ]}
        onImportComplete={refetch}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete invoice ${deleteItem?.invoice_no}? This action cannot be undone.`}
        isLoading={isDeleting}
      />
    </div>
  );
}
