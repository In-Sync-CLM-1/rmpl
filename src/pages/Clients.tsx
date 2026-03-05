import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Building2, Download, Upload } from "lucide-react";
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
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  official_address: string | null;
  residence_address: string | null;
  contact_number: string | null;
  email_id: string | null;
  birthday_date: string | null;
  anniversary_date: string | null;
  company_linkedin_page: string | null;
  linkedin_id: string | null;
  created_at: string;
}

const Clients = () => {
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canBulkDelete, setCanBulkDelete] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const {
    data: clients,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePaginatedQuery<Client>({
    queryKey: ["clients"],
    queryFn: async (from, to) => {
      const { data, error, count } = await supabase
        .from("clients")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      return { data, count, error };
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

  const handleDownloadTemplate = () => {
    const headers = [
      'company_name',
      'contact_name',
      'official_address',
      'residence_address',
      'contact_number',
      'email_id',
      'birthday_date',
      'anniversary_date',
      'company_linkedin_page',
      'linkedin_id'
    ];
    const csvContent = headers.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'clients_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const checkPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = rolesData?.map(r => r.role) || [];
      const canDelete = roles.some(role => 
        ['platform_admin', 'super_admin', 'admin', 'manager'].includes(role)
      );
      
      setCanBulkDelete(canDelete);
    };
    
    checkPermissions();
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map(c => c.id)));
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

  const handleBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      
      const { data, error } = await supabase.functions.invoke('bulk-delete-clients', {
        body: { recordIds: Array.from(selectedIds) }
      });
      
      if (error) throw error;
      
      toast.success(`Successfully deleted ${data.successCount} client(s)`);
      if (data.errorCount > 0) {
        toast.error(`Failed to delete ${data.errorCount} client(s)`);
      }
      
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      window.location.reload();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete clients');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteClient(deleteId);
      setDeleteId(null);
      setClientToDelete(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Clients</h1>
        <div className="flex gap-2">
          <Button onClick={handleDownloadTemplate} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Button onClick={() => setShowBulkImport(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          {canBulkDelete && selectedIds.size > 0 && (
            <Button
              onClick={() => setShowBulkDeleteConfirm(true)}
              variant="destructive"
              title={`Delete ${selectedIds.size} selected client(s)`}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Button onClick={() => navigate("/clients/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
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
                {canBulkDelete && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === clients.length && clients.length > 0}
                      onChange={handleSelectAll}
                      className="cursor-pointer h-4 w-4"
                      aria-label="Select all clients"
                    />
                  </TableHead>
                )}
                <TableHead>Contact Name</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Number</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>LinkedIn ID</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow 
                  key={client.id}
                  className={selectedIds.has(client.id) ? 'bg-primary/5' : ''}
                >
                  {canBulkDelete && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(client.id)}
                        onChange={() => handleSelectOne(client.id)}
                        className="cursor-pointer h-4 w-4"
                        aria-label={`Select ${client.contact_name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{client.contact_name}</TableCell>
                  <TableCell>{client.company_name}</TableCell>
                  <TableCell>{client.contact_number || "-"}</TableCell>
                  <TableCell>{client.email_id || "-"}</TableCell>
                  <TableCell>{client.linkedin_id || "-"}</TableCell>
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

      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        tableName="clients"
        tableLabel="Clients"
        requiredColumns={['company_name', 'contact_name']}
        templateColumns={[
          'company_name',
          'contact_name',
          'official_address',
          'residence_address',
          'contact_number',
          'email_id',
          'birthday_date',
          'anniversary_date',
          'company_linkedin_page',
          'linkedin_id'
        ]}
        onImportComplete={() => {
          window.location.reload();
        }}
      />

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Client(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected clients. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Client(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;
