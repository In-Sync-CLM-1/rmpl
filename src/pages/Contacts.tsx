import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Contact2, Search } from "lucide-react";
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

interface ContactRow {
  id: string;
  client_id: string;
  contact_name: string;
  designation: string | null;
  department: string | null;
  contact_number: string | null;
  email_id: string | null;
  is_primary: boolean | null;
  birthday_date: string | null;
  anniversary_date: string | null;
  created_at: string;
  company_name?: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<ContactRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: contacts,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePaginatedQuery<ContactRow>({
    queryKey: ["contacts", searchQuery],
    queryFn: async (from, to) => {
      let query = supabase
        .from("contacts")
        .select("*, client:client_id(company_name)", { count: "exact" });

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(
          `contact_name.ilike.${term},email_id.ilike.${term},contact_number.ilike.${term},designation.ilike.${term}`
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      const mapped = data?.map((c: any) => ({
        ...c,
        company_name: c.client?.company_name || null,
      })) || null;

      return { data: mapped, count, error };
    },
  });

  const { delete: deleteContact, isDeleting } = useCrudMutation<ContactRow>({
    queryKey: ["contacts"],
    createFn: async (data) => {
      const { data: result, error } = await supabase
        .from("contacts")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    updateFn: async (id, data) => {
      const { data: result, error } = await supabase
        .from("contacts")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    deleteFn: async (id) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: {
      delete: "Contact deleted successfully",
    },
    errorMessages: {
      delete: "Failed to delete contact",
    },
  });

  const handleDelete = async () => {
    if (deleteId) {
      await deleteContact(deleteId);
      setDeleteId(null);
      setContactToDelete(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <Button onClick={() => navigate("/contacts/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name, email, phone, designation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading contacts..." />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Contact2}
          title="No contacts found"
          description="Get started by adding your first contact"
          actionLabel="Add Contact"
          onAction={() => navigate("/contacts/new")}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Primary</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.contact_name}</TableCell>
                  <TableCell>{contact.company_name || "-"}</TableCell>
                  <TableCell>{contact.designation || "-"}</TableCell>
                  <TableCell>{contact.contact_number || "-"}</TableCell>
                  <TableCell>{contact.email_id || "-"}</TableCell>
                  <TableCell>
                    {contact.is_primary && (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-0">Primary</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(contact.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {permissions.canDeleteClients && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteId(contact.id);
                          setContactToDelete(contact);
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
            setContactToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        itemName={contactToDelete?.contact_name}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Contacts;
