import React from "react";
import { DataTableColumn } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type DataSource = "master" | "clients" | "demandcom" | "projects";

export function getColumnsForSource<T = any>(source: DataSource): DataTableColumn<T>[] {
  switch (source) {
    case "master":
      return [
        {
          header: "Name",
          accessorKey: "name",
        },
        {
          header: "Mobile",
          accessorKey: "mobile_numb",
        },
        {
          header: "Email",
          accessorKey: "personal_email_id",
          cell: (row: any) => row.personal_email_id || row.generic_email_id || row.official || "-",
        },
        {
          header: "Company",
          accessorKey: "company_name",
          cell: (row: any) => (
            <span className="max-w-[200px] truncate block">{row.company_name || "-"}</span>
          ),
        },
        {
          header: "Designation",
          accessorKey: "designation",
        },
        {
          header: "Department",
          accessorKey: "deppt",
        },
        {
          header: "City",
          accessorKey: "city",
        },
        {
          header: "State",
          accessorKey: "state",
        },
        {
          header: "Industry",
          accessorKey: "industry_type",
          cell: (row: any) => (
            <span className="max-w-[150px] truncate block">{row.industry_type || "-"}</span>
          ),
        },
        {
          header: "ERP",
          accessorKey: "erp_name",
        },
      ] as DataTableColumn<T>[];

    case "clients":
      return [
        {
          header: "Contact Name",
          accessorKey: "contact_name",
        },
        {
          header: "Company",
          accessorKey: "company_name",
          cell: (row: any) => (
            <span className="max-w-[200px] truncate block">{row.company_name}</span>
          ),
        },
        {
          header: "Contact Number",
          accessorKey: "contact_number",
        },
        {
          header: "Email",
          accessorKey: "email_id",
        },
        {
          header: "Official Address",
          accessorKey: "official_address",
          cell: (row: any) => (
            <span className="max-w-[250px] truncate block">{row.official_address || "-"}</span>
          ),
        },
        {
          header: "Birthday",
          accessorKey: "birthday_date",
          cell: (row: any) => row.birthday_date ? format(new Date(row.birthday_date), "MMM dd, yyyy") : "-",
        },
        {
          header: "Anniversary",
          accessorKey: "anniversary_date",
          cell: (row: any) => row.anniversary_date ? format(new Date(row.anniversary_date), "MMM dd, yyyy") : "-",
        },
      ] as DataTableColumn<T>[];

    case "demandcom":
      return [
        {
          header: "Name",
          accessorKey: "name",
        },
        {
          header: "Mobile",
          accessorKey: "mobile_numb",
        },
        {
          header: "Company",
          accessorKey: "company_name",
          cell: (row: any) => (
            <span className="max-w-[200px] truncate block">{row.company_name || "-"}</span>
          ),
        },
        {
          header: "Designation",
          accessorKey: "designation",
        },
        {
          header: "City",
          accessorKey: "city",
        },
        {
          header: "Status",
          accessorKey: "assignment_status",
          cell: (row: any) => (
            <Badge variant={row.assignment_status === "assigned" ? "default" : "secondary"}>
              {row.assignment_status || "unassigned"}
            </Badge>
          ),
        },
        {
          header: "Latest Disposition",
          accessorKey: "latest_disposition",
          cell: (row: any) => (
            <span className="max-w-[150px] truncate block">{row.latest_disposition || "-"}</span>
          ),
        },
        {
          header: "Last Call",
          accessorKey: "last_call_date",
          cell: (row: any) => row.last_call_date ? format(new Date(row.last_call_date), "MMM dd, yyyy") : "-",
        },
        {
          header: "Next Call",
          accessorKey: "next_call_date",
          cell: (row: any) => row.next_call_date ? format(new Date(row.next_call_date), "MMM dd, yyyy") : "-",
        },
      ] as DataTableColumn<T>[];

    case "projects":
      return [
        {
          header: "Project Name",
          accessorKey: "project_name",
          cell: (row: any) => (
            <span className="max-w-[250px] truncate block font-medium">{row.project_name}</span>
          ),
        },
        {
          header: "Client",
          accessorKey: "clients",
          cell: (row: any) => (
            <span className="max-w-[200px] truncate block">
              {row.clients?.company_name || "-"}
            </span>
          ),
        },
        {
          header: "Status",
          accessorKey: "status",
          cell: (row: any) => {
            const statusVariant = 
              row.status === "active" ? "default" :
              row.status === "completed" ? "default" :
              row.status === "on-hold" ? "secondary" :
              "outline";
            
            return (
              <Badge variant={statusVariant}>
                {row.status}
              </Badge>
            );
          },
        },
        {
          header: "Created",
          accessorKey: "created_at",
          cell: (row: any) => format(new Date(row.created_at), "MMM dd, yyyy"),
        },
        {
          header: "Brief",
          accessorKey: "brief",
          cell: (row: any) => (
            <span className="max-w-[300px] truncate block text-muted-foreground">
              {row.brief ? (row.brief.length > 50 ? row.brief.substring(0, 50) + "..." : row.brief) : "-"}
            </span>
          ),
        },
      ] as DataTableColumn<T>[];

    default:
      return [];
  }
}

export function getRowKey(source: DataSource) {
  // All tables use 'id' as primary key
  return (row: any) => row.id;
}
