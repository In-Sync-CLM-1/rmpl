import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Search, BarChart, Copy, Trash2, Edit, AlertCircle, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";

interface Campaign {
  id: string;
  name: string;
  type: "email" | "whatsapp";
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  created_by: string;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFiltering, setIsFiltering] = useState(false);

  const {
    data: campaigns,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
    refetch,
  } = usePaginatedQuery<Campaign>({
    queryKey: ["campaigns"],
    queryFn: async (from, to) => {
      const { data, error, count } = await supabase
        .from("campaigns")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      return { data: data as Campaign[], count, error };
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;

      toast.success("Campaign deleted successfully");
      refetch();
    } catch (error: any) {
      toast.error("Failed to delete campaign");
    }
  };

  const handleDuplicate = async (campaign: Campaign) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("campaigns").insert({
        name: `${campaign.name} (Copy)`,
        type: campaign.type,
        status: "draft",
        template_id: null,
        filter_criteria: {},
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Campaign duplicated successfully");
      refetch();
    } catch (error: any) {
      toast.error("Failed to duplicate campaign");
    }
  };

  const handleFilterChange = (callback: () => void) => {
    setIsFiltering(true);
    callback();
    setTimeout(() => setIsFiltering(false), 300);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "default",
      sent: "default",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || campaign.type === typeFilter;
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const columns: DataTableColumn<Campaign>[] = [
    {
      header: "Name",
      cell: (campaign) => <span className="font-medium">{campaign.name}</span>,
    },
    {
      header: "Type",
      cell: (campaign) => <span className="capitalize">{campaign.type}</span>,
    },
    {
      header: "Status",
      cell: (campaign) => getStatusBadge(campaign.status),
    },
    {
      header: "Recipients",
      accessorKey: "total_recipients",
    },
    {
      header: "Sent",
      cell: (campaign) => (
        <div className="flex items-center gap-2">
          {campaign.sent_count}
          {campaign.sent_count === 0 && campaign.status === "sent" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">No emails sent. Check campaign details.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ),
    },
    {
      header: "Delivered",
      accessorKey: "delivered_count",
    },
    {
      header: "Opened",
      accessorKey: "opened_count",
    },
    {
      header: "Clicked",
      accessorKey: "clicked_count",
    },
    {
      header: "Date",
      cell: (campaign) =>
        campaign.sent_at
          ? format(new Date(campaign.sent_at), "MMM d, yyyy")
          : campaign.scheduled_at
          ? format(new Date(campaign.scheduled_at), "MMM d, yyyy")
          : format(new Date(campaign.created_at), "MMM d, yyyy"),
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <Button onClick={() => navigate("/campaigns/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => handleFilterChange(() => setSearchQuery(e.target.value))}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={(value) => handleFilterChange(() => setTypeFilter(value))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => handleFilterChange(() => setStatusFilter(value))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filteredCampaigns}
        columns={columns}
        isLoading={isLoading || isFiltering}
        getRowKey={(campaign) => campaign.id}
        emptyState={{
          icon: Megaphone,
          title: "No campaigns found",
          description: "Get started by creating your first campaign",
          actionLabel: "New Campaign",
          onAction: () => navigate("/campaigns/new"),
        }}
        pagination={{
          currentPage,
          totalPages,
          totalItems: totalCount,
          itemsPerPage,
          onPageChange: handlePageChange,
          onItemsPerPageChange: handleItemsPerPageChange,
        }}
        actions={(campaign) => (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/campaigns/${campaign.id}/analytics`)}
              title="View Analytics"
            >
              <BarChart className="h-4 w-4" />
            </Button>
            {campaign.status === "draft" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDuplicate(campaign)}
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(campaign.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />
    </div>
  );
}
