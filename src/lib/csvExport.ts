import { DataTableColumn } from "@/components/data-table/DataTable";

export function exportToCSV<T>(data: T[], source: string, columns: DataTableColumn<T>[]) {
  if (data.length === 0) {
    return;
  }

  // Create header row from column definitions
  const headers = columns.map(col => col.header).join(",");

  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value: any;
      
      // Get the value using accessorKey or custom cell renderer
      if (col.cell && typeof col.cell === "function") {
        // For custom cell renderers, we need to extract the raw value
        // This is a simplified approach - just use accessorKey if available
        value = col.accessorKey ? (row as any)[col.accessorKey] : "";
      } else {
        value = col.accessorKey ? (row as any)[col.accessorKey] : "";
      }

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '""';
      }

      // Handle objects (like nested relations)
      if (typeof value === "object" && !Array.isArray(value)) {
        // Try to extract a meaningful property
        value = value.company_name || value.name || JSON.stringify(value);
      }

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join("; ");
      }

      // Convert to string and escape
      const stringValue = String(value);
      
      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(",");
  });

  // Combine headers and rows
  const csv = [headers, ...rows].join("\n");

  // Create blob and download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `${source}-export-${timestamp}.csv`;
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}
