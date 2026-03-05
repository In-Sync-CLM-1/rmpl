import { useState } from "react";
import { useInventoryAllocations, AllocationWithDetails } from "@/hooks/useInventoryAllocation";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReturnDialog } from "@/components/inventory/ReturnDialog";
import { Package, PackageCheck } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

export default function InventoryReturns() {
  const [selectedAllocation, setSelectedAllocation] = useState<AllocationWithDetails | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  const { data: allocations, isLoading } = useInventoryAllocations('active');

  const columns: DataTableColumn<AllocationWithDetails>[] = [
    {
      header: "Item Name",
      cell: (allocation) => allocation.inventory_item?.items || "-",
    },
    {
      header: "Serial Number",
      cell: (allocation) => allocation.inventory_item?.serial_number || "-",
    },
    {
      header: "Allocated To",
      cell: (allocation) => allocation.user?.full_name || allocation.user?.email || "-",
    },
    {
      header: "Allocated On",
      cell: (allocation) => format(new Date(allocation.allocation_date), "MMM dd, yyyy"),
    },
    {
      header: "Condition",
      accessorKey: "allocated_condition",
      cell: (allocation) => (
        <Badge variant="outline">{allocation.allocated_condition}</Badge>
      ),
    },
    {
      header: "Due Date",
      cell: (allocation) => {
        if (!allocation.expected_return_date) return "-";
        
        const dueDate = parseISO(allocation.expected_return_date);
        const isOverdue = isPast(dueDate);
        
        return (
          <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
            {format(dueDate, "MMM dd, yyyy")}
            {isOverdue && " (Overdue)"}
          </span>
        );
      },
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Inventory Returns
          </h1>
          <p className="text-muted-foreground">
            Process returns for allocated inventory items
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={allocations || []}
        isLoading={isLoading}
        getRowKey={(allocation) => allocation.id}
        emptyState={{
          icon: Package,
          title: "No Active Allocations",
          description: "No active allocations found for return processing",
        }}
        actions={(allocation) => (
          <Button
            size="sm"
            onClick={() => {
              setSelectedAllocation(allocation);
              setReturnDialogOpen(true);
            }}
          >
            <PackageCheck className="h-4 w-4 mr-1" />
            Process Return
          </Button>
        )}
      />

      {selectedAllocation && (
        <ReturnDialog
          allocation={selectedAllocation}
          isOpen={returnDialogOpen}
          onClose={() => {
            setReturnDialogOpen(false);
            setSelectedAllocation(null);
          }}
        />
      )}
    </div>
  );
}
