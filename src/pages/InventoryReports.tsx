import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";

type ReportType = "user-wise" | "asset-lifecycle" | "current-summary" | "available-assets";

export default function InventoryReports() {
  const [reportType, setReportType] = useState<ReportType>("current-summary");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = async () => {
    setIsGenerating(true);

    try {
      let data: any[] = [];
      let filename = "";

      switch (reportType) {
        case "user-wise":
          const { data: userWise } = await supabase
            .from("inventory_allocations")
            .select(`
              *,
              user:profiles!inventory_allocations_user_id_fkey(full_name, email),
              inventory_item:inventory_items!inventory_allocations_inventory_item_id_fkey(items, serial_number, brand, model)
            `)
            .order("user_id");
          
          data = userWise?.map(a => ({
            "User Name": a.user?.full_name || a.user?.email,
            "Item": a.inventory_item?.items,
            "Serial Number": a.inventory_item?.serial_number,
            "Brand": a.inventory_item?.brand,
            "Model": a.inventory_item?.model,
            "Allocated Date": a.allocation_date,
            "Expected Return": a.expected_return_date,
            "Status": a.status,
            "Condition": a.allocated_condition,
          })) || [];
          filename = "user-wise-allocations.csv";
          break;

        case "asset-lifecycle":
          const { data: lifecycle } = await supabase
            .from("inventory_audit_log")
            .select(`
              *,
              user:profiles!inventory_audit_log_user_id_fkey(full_name),
              changed_by_profile:profiles!inventory_audit_log_changed_by_fkey(full_name)
            `)
            .order("timestamp", { ascending: false });
          
          data = lifecycle?.map(log => ({
            "Timestamp": log.timestamp,
            "Action": log.action,
            "Old Status": log.old_status,
            "New Status": log.new_status,
            "Old Condition": log.old_condition,
            "New Condition": log.new_condition,
            "User": log.user?.full_name,
            "Changed By": log.changed_by_profile?.full_name,
            "Notes": log.notes,
          })) || [];
          filename = "asset-lifecycle.csv";
          break;

        case "current-summary":
          const { data: summary } = await supabase
            .from("inventory_items")
            .select("*")
            .order("status");
          
          data = summary?.map(item => ({
            "Item": item.items,
            "Serial Number": item.serial_number,
            "IMEI": item.imei,
            "Brand": item.brand,
            "Model": item.model,
            "Status": item.status,
            "Condition": item.current_condition,
            "Vendor": item.vendor_name,
          })) || [];
          filename = "current-inventory-summary.csv";
          break;

        case "available-assets":
          const { data: available } = await supabase
            .from("inventory_items")
            .select("*")
            .eq("status", "Available")
            .order("items");
          
          data = available?.map(item => ({
            "Item": item.items,
            "Serial Number": item.serial_number,
            "IMEI": item.imei,
            "Brand": item.brand,
            "Model": item.model,
            "Condition": item.current_condition,
            "Vendor": item.vendor_name,
            "Purchase Date": item.date_of_purchase,
          })) || [];
          filename = "available-assets.csv";
          break;
      }

      if (data.length === 0) {
        toast.error("No data available for this report");
        return;
      }

      // Generate CSV
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Report generated successfully");
    } catch (error: any) {
      toast.error("Failed to generate report: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Inventory Reports
          </h1>
          <p className="text-muted-foreground">
            Generate and export inventory reports
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user-wise">User-wise Allocated Assets</SelectItem>
                <SelectItem value="asset-lifecycle">Asset Lifecycle History</SelectItem>
                <SelectItem value="current-summary">Current Allocation Summary</SelectItem>
                <SelectItem value="available-assets">Available Assets List</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Report Description:</h4>
            <p className="text-sm text-muted-foreground">
              {reportType === "user-wise" && "Shows all allocations grouped by user with item details"}
              {reportType === "asset-lifecycle" && "Complete history of all inventory changes and actions"}
              {reportType === "current-summary" && "Current status of all inventory items"}
              {reportType === "available-assets" && "List of all available items ready for allocation"}
            </p>
          </div>

          <Button
            onClick={generateReport}
            disabled={isGenerating}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate & Download Report"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
