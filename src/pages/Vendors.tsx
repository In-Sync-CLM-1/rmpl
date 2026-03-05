import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Package, Upload, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { format } from "date-fns";

interface Vendor {
  id: string;
  vendor_name: string;
  vendor_type: string;
  service_type: string | null;
  contact_person: string | null;
  contact_no: string | null;
  email_id: string | null;
  city: string | null;
  department: string | null;
  created_at: string;
}

export default function Vendors() {
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();
  const { canDeleteVendors } = permissions;
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const {
    data: vendors,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
    refetch,
  } = usePaginatedQuery<Vendor>({
    queryKey: ["vendors"],
    queryFn: async (from, to) => {
      const { data, count, error } = await supabase
        .from("vendors")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      return { data, count, error };
    },
    initialItemsPerPage: 25,
  });

  const { delete: deleteVendor } = useCrudMutation<Vendor>({
    queryKey: ["vendors"],
    createFn: async () => ({ id: "" } as Vendor),
    updateFn: async () => ({ id: "" } as Vendor),
    deleteFn: async (id: string) => {
      const { error } = await supabase.from("vendors").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: {
      delete: "Vendor deleted successfully",
    },
    errorMessages: {
      delete: "Failed to delete vendor",
    },
  });

  const handleDelete = async () => {
    if (deleteId) {
      await deleteVendor(deleteId);
      setDeleteId(null);
      refetch();
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Vendor Name",
      "Vendor Type",
      "Contact Person",
      "Contact No.",
      "Email Id",
      "Address",
      "City",
      "State",
      "Pin Code",
      "GST",
      "Department",
    ];
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "vendors_template.csv";
    link.click();
    toast.success("Template downloaded successfully");
  };

  const handleExport = async () => {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const headers = [
        "Vendor Name",
        "Vendor Type",
        "Contact Person",
        "Contact No.",
        "Email Id",
        "Address",
        "City",
        "State",
        "Pin Code",
        "GST",
        "Department",
        "Created Date",
      ];

      const rows = data.map((vendor) => [
        vendor.vendor_name,
        vendor.vendor_type,
        vendor.contact_person || "",
        vendor.contact_no || "",
        vendor.email_id || "",
        vendor.address || "",
        vendor.city || "",
        vendor.state || "",
        vendor.pin_code || "",
        vendor.gst || "",
        vendor.department || "",
        format(new Date(vendor.created_at), "yyyy-MM-dd HH:mm:ss"),
      ]);

      const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `vendors_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      toast.success("Vendors exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export vendors");
    }
  };

  const columns: DataTableColumn<Vendor>[] = [
    {
      header: "Vendor Name",
      accessorKey: "vendor_name",
      cell: (vendor) => (
        <div className="flex flex-col">
          <span className="font-medium">{vendor.vendor_name}</span>
          <span className="text-xs text-muted-foreground">
            {[vendor.vendor_type, vendor.service_type].filter(Boolean).join(" • ")}
          </span>
        </div>
      ),
    },
    {
      header: "Contact Person",
      accessorKey: "contact_person",
      cell: (vendor) => vendor.contact_person || "-",
    },
    {
      header: "Contact No.",
      accessorKey: "contact_no",
      cell: (vendor) => vendor.contact_no || "-",
    },
    {
      header: "Email Id",
      accessorKey: "email_id",
      cell: (vendor) => vendor.email_id || "-",
    },
    {
      header: "City",
      accessorKey: "city",
      cell: (vendor) => vendor.city || "-",
    },
    {
      header: "Department",
      accessorKey: "department",
      cell: (vendor) => vendor.department || "-",
    },
    {
      header: "Created Date",
      accessorKey: "created_at",
      cell: (vendor) => format(new Date(vendor.created_at), "dd MMM yyyy"),
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Vendors</h1>
            <p className="text-muted-foreground">Manage your vendor repository</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Template
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setShowBulkImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={() => navigate("/vendors/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </div>
      </div>

      <DataTable
        data={vendors}
        columns={columns}
        isLoading={isLoading}
        pagination={{
          currentPage,
          totalPages,
          totalItems: totalCount,
          itemsPerPage,
          onPageChange: handlePageChange,
          onItemsPerPageChange: handleItemsPerPageChange,
        }}
        getRowKey={(vendor) => vendor.id}
        onRowClick={(vendor) => navigate(`/vendors/${vendor.id}`)}
        actions={(vendor) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/vendors/${vendor.id}`);
              }}
            >
              Edit
            </Button>
            {canDeleteVendors && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(vendor.id);
                }}
              >
                Delete
              </Button>
            )}
          </>
        )}
      />

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Vendor"
        description="Are you sure you want to delete this vendor? This action cannot be undone."
      />

      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        tableName="vendors"
        tableLabel="Vendors"
        requiredColumns={["vendor_name", "vendor_type"]}
        templateColumns={[
          "Vendor Name",
          "Vendor Type",
          "Contact Person",
          "Contact No.",
          "Email Id",
          "Address",
          "City",
          "State",
          "Pin Code",
          "GST",
          "Department",
        ]}
        onImportComplete={() => refetch()}
      />
    </div>
  );
}
