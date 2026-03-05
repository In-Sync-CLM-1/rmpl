import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Package2, Search, Save, Hash } from "lucide-react";
import { format } from "date-fns";

interface ITInventoryItem {
  id: string;
  invoice_no: string;
  line_number: number | null;
  items: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  imei: string | null;
  status: string;
  date_of_purchase: string;
  vendor_name: string;
}

export default function InventorySerialEntry() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItems, setEditingItems] = useState<Record<string, { serial_number: string; imei: string }>>({});

  const { data: items, isLoading } = useQuery({
    queryKey: ["it-inventory-serial-entry", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("inventory_items")
        .select("id, invoice_no, line_number, items, brand, model, serial_number, imei, status, date_of_purchase, vendor_name")
        .eq("category", "IT")
        .order("invoice_no", { ascending: true })
        .order("line_number", { ascending: true });

      if (searchTerm) {
        query = query.or(
          `invoice_no.ilike.%${searchTerm}%,items.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ITInventoryItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, serial_number, imei }: { id: string; serial_number: string; imei: string }) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ serial_number: serial_number || null, imei: imei || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it-inventory-serial-entry"] });
      toast.success("Serial number updated");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update serial number");
    },
  });

  const handleInputChange = (id: string, field: "serial_number" | "imei", value: string) => {
    setEditingItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        serial_number: prev[id]?.serial_number ?? items?.find(i => i.id === id)?.serial_number ?? "",
        imei: prev[id]?.imei ?? items?.find(i => i.id === id)?.imei ?? "",
        [field]: value,
      },
    }));
  };

  const handleSave = (item: ITInventoryItem) => {
    const editedData = editingItems[item.id];
    if (!editedData) return;

    updateMutation.mutate({
      id: item.id,
      serial_number: editedData.serial_number,
      imei: editedData.imei,
    });

    // Clear from editing state after save
    setEditingItems(prev => {
      const newState = { ...prev };
      delete newState[item.id];
      return newState;
    });
  };

  const itemsWithoutSerial = items?.filter(i => !i.serial_number) || [];
  const itemsWithSerial = items?.filter(i => i.serial_number) || [];

  const columns: DataTableColumn<ITInventoryItem>[] = [
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
      header: "Item",
      accessorKey: "items",
      cell: (item) => (
        <div>
          <div className="font-medium">{item.items}</div>
          {(item.brand || item.model) && (
            <div className="text-xs text-muted-foreground">
              {[item.brand, item.model].filter(Boolean).join(" - ")}
            </div>
          )}
        </div>
      ),
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
      header: "Serial Number",
      accessorKey: "serial_number",
      cell: (item) => {
        const isEditing = editingItems[item.id] !== undefined;
        const value = isEditing ? editingItems[item.id].serial_number : (item.serial_number || "");
        return (
          <Input
            value={value}
            onChange={(e) => handleInputChange(item.id, "serial_number", e.target.value)}
            placeholder="Enter serial number"
            className="h-8 w-40"
          />
        );
      },
    },
    {
      header: "IMEI",
      accessorKey: "imei",
      cell: (item) => {
        const isEditing = editingItems[item.id] !== undefined;
        const value = isEditing ? editingItems[item.id].imei : (item.imei || "");
        return (
          <Input
            value={value}
            onChange={(e) => handleInputChange(item.id, "imei", e.target.value)}
            placeholder="Enter IMEI"
            className="h-8 w-40"
          />
        );
      },
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
        return (
          <Badge variant="outline" className={statusColors[item.status as keyof typeof statusColors] || ""}>
            {item.status}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Serial Number Entry</h1>
            <p className="text-muted-foreground">
              Enter serial numbers and IMEI for IT inventory items
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total IT Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{items?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-yellow-600">Pending Serial Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{itemsWithoutSerial.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-green-600">Serial Entered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{itemsWithSerial.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice, item, brand, or serial number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items || []}
        isLoading={isLoading}
        getRowKey={(item) => item.id}
        emptyState={{
          icon: Package2,
          title: "No IT Items Found",
          description: "No IT inventory items found for serial number entry",
        }}
        actions={(item) => {
          const hasChanges = editingItems[item.id] !== undefined;
          return (
            <Button
              size="sm"
              disabled={!hasChanges || updateMutation.isPending}
              onClick={() => handleSave(item)}
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          );
        }}
      />
    </div>
  );
}
