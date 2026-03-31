import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Building2, Search, Users, ChevronDown, ChevronRight, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { ClientAssignmentDialog } from "@/components/ClientAssignmentDialog";
import { ClientBulkAssignDialog } from "@/components/ClientBulkAssignDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Client {
  id: string;
  company_name: string;
  official_address: string | null;
  company_linkedin_page: string | null;
  branch: string | null;
  managed_by: string | null;
  managed_by_name?: string | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  industry: string | null;
  gst_number: string | null;
  website: string | null;
  created_at: string;
  contact_count?: number;
  branches?: ClientBranch[];
}

interface ClientBranch {
  id: string;
  branch_name: string;
  branch_address: string | null;
  gst_number: string | null;
  is_primary: boolean | null;
}

interface Contact {
  id: string;
  contact_name: string;
  designation: string | null;
  contact_number: string | null;
  email_id: string | null;
  is_primary: boolean | null;
}

const Clients = () => {
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [contactsCache, setContactsCache] = useState<Record<string, Contact[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);

  const {
    data: clients,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    refetch,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePaginatedQuery<Client>({
    queryKey: ["clients", searchQuery],
    queryFn: async (from, to) => {
      let query = supabase
        .from("clients")
        .select("*, managed_by_profile:managed_by(full_name), assigned_to_profile:assigned_to(full_name), client_branches(id, branch_name, branch_address, gst_number, is_primary)", { count: "exact" });

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(
          `company_name.ilike.${term},branch.ilike.${term},industry.ilike.${term}`
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      const mapped = data?.map((c: any) => ({
        ...c,
        managed_by_name: c.managed_by_profile?.full_name || null,
        assigned_to_name: c.assigned_to_profile?.full_name || null,
        branches: c.client_branches || [],
      })) || null;

      return { data: mapped, count, error };
    },
  });

  const { delete: deleteClient, isDeleting } = useCrudMutation<Client>({
    queryKey: ["clients"],
    createFn: async (data) => {
      const { data: result, error } = await supabase
        .from("clients")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    updateFn: async (id, data) => {
      const { data: result, error } = await supabase
        .from("clients")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    deleteFn: async (id) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: {
      delete: "Client deleted successfully",
    },
    errorMessages: {
      delete: "Failed to delete client",
    },
  });

  const toggleExpand = async (clientId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
      if (!contactsCache[clientId]) {
        const { data } = await supabase
          .from("contacts")
          .select("id, contact_name, designation, contact_number, email_id, is_primary")
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false })
          .order("contact_name");
        setContactsCache((prev) => ({ ...prev, [clientId]: data || [] }));
      }
    }
    setExpandedRows(newExpanded);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteClient(deleteId);
      setDeleteId(null);
      setClientToDelete(null);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === clients.length && clients.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Clients</h1>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowAssignmentDialog(true)}
                    variant="secondary"
                    size="icon"
                    className="relative"
                  >
                    <UserPlus className="h-4 w-4" />
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                      {selectedIds.size}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Assign selected clients</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {totalCount > 0 && (
            <Button
              onClick={() => setShowBulkAssignDialog(true)}
              variant="outline"
              className="gap-2"
              title="Bulk Select & Assign"
            >
              <Users className="h-4 w-4" />
              Bulk Assign
            </Button>
          )}
          <Button onClick={() => navigate("/clients/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by company, branch, industry..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading clients..." />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients found"
          description="Get started by adding your first client"
          actionLabel="Add Client"
          onAction={() => navigate("/clients/new")}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === clients.length && clients.length > 0}
                    onChange={handleSelectAll}
                    className="cursor-pointer h-4 w-4"
                    aria-label="Select all clients"
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Managed By</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <>
                  <TableRow key={client.id} className={selectedIds.has(client.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(client.id)}
                        onChange={() => handleSelectOne(client.id)}
                        className="cursor-pointer h-4 w-4"
                        aria-label={`Select ${client.company_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleExpand(client.id)}
                      >
                        {expandedRows.has(client.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {client.company_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.branches && client.branches.length > 0 ? (
                        <div className="space-y-0.5">
                          {client.branches.slice(0, 2).map((b) => (
                            <div key={b.id} className="flex items-center gap-1.5">
                              <span className="text-xs">{b.branch_name}</span>
                              {b.gst_number && (
                                <span className="text-[10px] text-muted-foreground">({b.gst_number})</span>
                              )}
                              {b.is_primary && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1">Primary</Badge>
                              )}
                            </div>
                          ))}
                          {client.branches.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{client.branches.length - 2} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{client.industry || "-"}</TableCell>
                    <TableCell>
                      {client.website ? (
                        <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm truncate max-w-[150px] block">
                          {client.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {client.assigned_to_name ? (
                        <Badge variant="outline" className="text-xs">
                          {client.assigned_to_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{client.managed_by_name || "-"}</TableCell>
                    <TableCell>
                      {new Date(client.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {permissions.canDeleteClients && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteId(client.id);
                            setClientToDelete(client);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(client.id) && (
                    <TableRow key={`${client.id}-contacts`}>
                      <TableCell colSpan={10} className="bg-muted/30 p-0">
                        <div className="px-8 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              Contacts
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => navigate(`/contacts/new?clientId=${client.id}`)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Contact
                            </Button>
                          </div>
                          {!contactsCache[client.id] ? (
                            <p className="text-sm text-muted-foreground">Loading...</p>
                          ) : contactsCache[client.id].length === 0 ? (
                            <p className="text-sm text-muted-foreground">No contacts yet</p>
                          ) : (
                            <div className="space-y-1">
                              {contactsCache[client.id].map((contact) => (
                                <div
                                  key={contact.id}
                                  className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium">{contact.contact_name}</span>
                                    {contact.is_primary && (
                                      <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-0">Primary</Badge>
                                    )}
                                    {contact.designation && (
                                      <span className="text-xs text-muted-foreground">{contact.designation}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {contact.contact_number && <span>{contact.contact_number}</span>}
                                    {contact.email_id && <span>{contact.email_id}</span>}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => navigate(`/contacts/${contact.id}`)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </>
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setClientToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        itemName={clientToDelete?.company_name}
        isLoading={isDeleting}
      />

      <ClientAssignmentDialog
        open={showAssignmentDialog}
        onOpenChange={setShowAssignmentDialog}
        selectedIds={Array.from(selectedIds)}
        onAssignmentComplete={() => {
          setSelectedIds(new Set());
          refetch();
        }}
      />

      <ClientBulkAssignDialog
        open={showBulkAssignDialog}
        onOpenChange={setShowBulkAssignDialog}
        totalCount={totalCount}
        itemsPerPage={itemsPerPage}
        searchQuery={searchQuery}
        onAssignmentComplete={() => {
          setSelectedIds(new Set());
          refetch();
        }}
      />
    </div>
  );
};

export default Clients;
