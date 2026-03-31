import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ExpenseItem {
  id?: string;
  claim_id?: string;
  expense_type: string;
  description: string;
  amount: number;
  expense_date: string;
  receipt_url?: string | null;
  receipt_name?: string | null;
  approved_amount?: number | null;
  item_status?: string;
  remarks?: string | null;
  created_at?: string;
}

export interface ExpenseClaim {
  id: string;
  user_id: string;
  trip_title: string;
  trip_start_date: string;
  trip_end_date: string;
  destination: string | null;
  purpose: string | null;
  project_id: string | null;
  total_amount: number;
  approved_amount: number | null;
  currency: string;
  status: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  reimbursed_at: string | null;
  proof_urls: ProofFile[];
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string } | null;
  approver?: { full_name: string } | null;
  projects?: { project_name: string } | null;
  items?: ExpenseItem[];
}

export interface ProofFile {
  url: string;
  name: string;
  size: number;
}

export const EXPENSE_TYPES = [
  { value: "airfare", label: "Airfare", icon: "Plane" },
  { value: "train", label: "Train", icon: "Train" },
  { value: "bus", label: "Bus", icon: "Bus" },
  { value: "cab", label: "Cab/Taxi", icon: "Car" },
  { value: "auto", label: "Auto", icon: "Bike" },
  { value: "fuel", label: "Fuel", icon: "Fuel" },
  { value: "hotel", label: "Hotel", icon: "Hotel" },
  { value: "food", label: "Food & Meals", icon: "UtensilsCrossed" },
  { value: "communication", label: "Communication", icon: "Phone" },
  { value: "visa", label: "Visa/Passport", icon: "FileText" },
  { value: "miscellaneous", label: "Miscellaneous", icon: "Package" },
] as const;

export const getExpenseTypeLabel = (type: string) =>
  EXPENSE_TYPES.find((t) => t.value === type)?.label || type;

export const getStatusColor = (status: string) => {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    submitted: "secondary",
    approved: "default",
    partially_approved: "default",
    rejected: "destructive",
    reimbursed: "default",
  };
  return map[status] || "outline";
};

export const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    draft: "Draft",
    submitted: "Pending Approval",
    approved: "Approved",
    partially_approved: "Partially Approved",
    rejected: "Rejected",
    reimbursed: "Reimbursed",
  };
  return map[status] || status;
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
}

export function useExpenseClaims(userId?: string) {
  return useQuery({
    queryKey: ["expense-claims", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("travel_expense_claims" as any)
        .select("*, profiles:user_id(full_name, email), projects:project_id(project_name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ExpenseClaim[];
    },
    enabled: !!userId,
  });
}

export function useExpenseClaimDetail(claimId?: string) {
  return useQuery({
    queryKey: ["expense-claim-detail", claimId],
    queryFn: async () => {
      if (!claimId) return null;
      const { data: claim, error } = await supabase
        .from("travel_expense_claims" as any)
        .select("*, profiles:user_id(full_name, email), approver:approved_by(full_name), projects:project_id(project_name)")
        .eq("id", claimId)
        .single();
      if (error) throw error;

      const { data: items, error: itemsError } = await supabase
        .from("travel_expense_items" as any)
        .select("*")
        .eq("claim_id", claimId)
        .order("expense_date", { ascending: true });
      if (itemsError) throw itemsError;

      return { ...(claim as any), items: items || [] } as ExpenseClaim;
    },
    enabled: !!claimId,
  });
}

export function usePendingApprovals(managerId?: string) {
  return useQuery({
    queryKey: ["expense-approvals-pending", managerId],
    queryFn: async () => {
      if (!managerId) return [];

      // Get subordinate IDs
      const { data: subordinates } = await supabase
        .from("profiles")
        .select("id")
        .eq("reports_to", managerId);

      const subIds = subordinates?.map((s) => s.id) || [];
      if (subIds.length === 0) return [];

      const { data, error } = await supabase
        .from("travel_expense_claims" as any)
        .select("*, profiles:user_id(full_name, email), projects:project_id(project_name)")
        .in("user_id", subIds)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true });
      if (error) throw error;

      // Fetch items for each claim
      const claimIds = (data || []).map((c: any) => c.id);
      if (claimIds.length === 0) return [];

      const { data: allItems } = await supabase
        .from("travel_expense_items" as any)
        .select("*")
        .in("claim_id", claimIds)
        .order("expense_date", { ascending: true });

      return (data || []).map((claim: any) => ({
        ...claim,
        items: (allItems || []).filter((item: any) => item.claim_id === claim.id),
      })) as ExpenseClaim[];
    },
    enabled: !!managerId,
  });
}

export function useAllApprovals(userId?: string, isAdmin?: boolean) {
  return useQuery({
    queryKey: ["expense-all-approvals", userId, isAdmin],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("travel_expense_claims" as any)
        .select("*, profiles:user_id(full_name, email), approver:approved_by(full_name), projects:project_id(project_name)")
        .neq("status", "draft")
        .order("submitted_at", { ascending: false })
        .limit(100);

      if (!isAdmin) {
        const { data: subordinates } = await supabase
          .from("profiles")
          .select("id")
          .eq("reports_to", userId);
        const subIds = subordinates?.map((s) => s.id) || [];
        if (subIds.length === 0) return [];
        query = query.in("user_id", subIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ExpenseClaim[];
    },
    enabled: !!userId,
  });
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claim: {
      user_id: string;
      trip_title: string;
      trip_start_date: string;
      trip_end_date: string;
      destination?: string;
      purpose?: string;
      project_id?: string | null;
      items: Omit<ExpenseItem, "id" | "claim_id" | "created_at">[];
    }) => {
      const { items, ...claimData } = claim;
      const { data: newClaim, error } = await supabase
        .from("travel_expense_claims" as any)
        .insert(claimData)
        .select("id")
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const itemsWithClaim = items.map((item) => ({
          ...item,
          claim_id: (newClaim as any).id,
        }));
        const { error: itemsError } = await supabase
          .from("travel_expense_items" as any)
          .insert(itemsWithClaim);
        if (itemsError) throw itemsError;
      }

      return (newClaim as any).id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      toast.success("Expense claim created!");
    },
    onError: (err: Error) => {
      toast.error("Failed to create claim: " + err.message);
    },
  });
}

export function useSubmitClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from("travel_expense_claims" as any)
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", claimId);
      if (error) throw error;
      return claimId;
    },
    onSuccess: async (claimId) => {
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      queryClient.invalidateQueries({ queryKey: ["expense-claim-detail"] });
      toast.success("Claim submitted for approval!");

      // Send WhatsApp notification to manager
      try {
        await supabase.functions.invoke("send-approval-email", {
          body: { request_type: "expense", request_id: claimId },
        });
      } catch (err) {
        console.error("Failed to send expense approval notification:", err);
      }
    },
    onError: (err: Error) => {
      toast.error("Failed to submit: " + err.message);
    },
  });
}

export function useApproveClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, approverId, approvedAmount }: { claimId: string; approverId: string; approvedAmount?: number }) => {
      const { error } = await supabase
        .from("travel_expense_claims" as any)
        .update({
          status: "approved",
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          approved_amount: approvedAmount,
        })
        .eq("id", claimId)
        .eq("status", "submitted");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-approvals-pending"] });
      queryClient.invalidateQueries({ queryKey: ["expense-all-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["expense-claim-detail"] });
      toast.success("Expense claim approved!");
    },
    onError: (err: Error) => {
      toast.error("Failed to approve: " + err.message);
    },
  });
}

export function useRejectClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, approverId, reason }: { claimId: string; approverId: string; reason: string }) => {
      const { error } = await supabase
        .from("travel_expense_claims" as any)
        .update({
          status: "rejected",
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", claimId)
        .eq("status", "submitted");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-approvals-pending"] });
      queryClient.invalidateQueries({ queryKey: ["expense-all-approvals"] });
      toast.success("Expense claim rejected.");
    },
    onError: (err: Error) => {
      toast.error("Failed to reject: " + err.message);
    },
  });
}

export function useDeleteClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string) => {
      // Items cascade-delete with claim
      const { error } = await supabase
        .from("travel_expense_claims" as any)
        .delete()
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      toast.success("Draft claim deleted.");
    },
    onError: (err: Error) => {
      toast.error("Failed to delete: " + err.message);
    },
  });
}

export async function uploadReceipt(file: File, userId: string, claimId: string): Promise<{ url: string; name: string }> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${claimId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("expense-receipts").upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from("expense-receipts").getPublicUrl(path);
  // Use signed URL since bucket is private
  const { data: signedData } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
  return { url: signedData?.signedUrl || data.publicUrl, name: file.name };
}

const MAX_PROOF_FILES = 6;
const MAX_PROOF_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export function validateProofFile(file: File): string | null {
  if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported file type. Only images and PDFs are allowed.`;
  }
  if (file.size > MAX_PROOF_SIZE_BYTES) {
    return `"${file.name}" exceeds 1 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB).`;
  }
  return null;
}

export async function uploadProofFiles(
  files: File[],
  userId: string,
  claimId: string
): Promise<ProofFile[]> {
  const results: ProofFile[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${claimId}/proofs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("expense-receipts").upload(path, file);
    if (error) throw error;
    const { data: signedData } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
    results.push({
      url: signedData?.signedUrl || "",
      name: file.name,
      size: file.size,
    });
  }
  return results;
}

export { MAX_PROOF_FILES, MAX_PROOF_SIZE_BYTES, ALLOWED_PROOF_TYPES };
