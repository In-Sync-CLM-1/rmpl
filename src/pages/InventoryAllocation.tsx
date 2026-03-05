import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AllocationDialog } from "@/components/inventory/AllocationDialog";
import { ItemHistoryDialog } from "@/components/inventory/ItemHistoryDialog";
import { Package, Search, UserPlus, History, AlertCircle } from "lucide-react";

interface InventoryItem {
  id: string;
  items: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  imei: string | null;
  status: string;
  current_condition: string;
  vendor_name: string;
  category: string | null;
  line_number: number | null;
  invoice_no: string;
}

export default function InventoryAllocation() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("IT");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<{ id: string; name: string } | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["available-inventory", searchTerm, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("inventory_items")
        .select("id, items, brand, model, serial_number, imei, status, current_condition, vendor_name, category, line_number, invoice_no")
        .eq("status", "Available")
        .order("created_at", { ascending: false });

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      if (searchTerm) {
        query = query.or(
          `items.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%,imei.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,invoice_no.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      header: "Invoice / Line",
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
      header: "Item Name",
      accessorKey: "items",
      cell: (item) => (
        <div>
          <div>{item.items}</div>
          {(item.brand || item.model) && (
            <div className="text-xs text-muted-foreground">
              {[item.brand, item.model].filter(Boolean).join(" - ")}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Serial Number",
      accessorKey: "serial_number",
      cell: (item) => {
        if (!item.serial_number && item.category === "IT") {
          return (
            <div className="flex items-center gap-1 text-yellow-600">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">Not entered</span>
            </div>
          );
        }
        return item.serial_number || "-";
      },
    },
    {
      header: "IMEI",
      accessorKey: "imei",
      cell: (item) => item.imei || "-",
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
      header: "Condition",
      accessorKey: "current_condition",
      cell: (item) => (
        <Badge variant="outline">{item.current_condition}</Badge>
      ),
    },
    {
      header: "Vendor",
      accessorKey: "vendor_name",
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Allocate Inventory
          </h1>
          <p className="text-muted-foreground">
            Allocate available inventory items to users
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item, serial number, IMEI, invoice, or brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 bg-background">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="IT">IT</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items || []}
        isLoading={isLoading}
        getRowKey={(item) => item.id}
        emptyState={{
          icon: Package,
          title: "No Available Items",
          description: "No available items found for allocation",
        }}
        actions={(item) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setSelectedItem(item);
                setAllocationDialogOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Allocate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setHistoryItem({ id: item.id, name: item.items });
                setHistoryDialogOpen(true);
              }}
            >
              <History className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      {selectedItem && (
        <AllocationDialog
          item={selectedItem}
          isOpen={allocationDialogOpen}
          onClose={() => {
            setAllocationDialogOpen(false);
            setSelectedItem(null);
          }}
        />
      )}

      {historyItem && (
        <ItemHistoryDialog
          itemId={historyItem.id}
          itemName={historyItem.name}
          isOpen={historyDialogOpen}
          onClose={() => {
            setHistoryDialogOpen(false);
            setHistoryItem(null);
          }}
        />
      )}
    </div>
  );
}
