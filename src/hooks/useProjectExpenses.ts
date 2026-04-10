import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const EXPENSE_CATEGORIES = [
  "Venue & Infrastructure",
  "Food & Beverage",
  "Travel & Accommodation",
  "Audio Visual & Tech",
  "Creative & Printing",
  "Staffing & Labour",
  "Gifting & Merchandise",
  "Miscellaneous",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface InvoiceFile {
  url: string;
  name: string;
  size: number;
}

export interface VendorDiscount {
  vendor: string;
  amount: number;
  percentage?: number;
  notes?: string;
}

export interface LoyaltyPoint {
  provider: string;       // e.g. "Marriott Bonvoy", "Air India"
  points: number;
  est_value_inr?: number;
  notes?: string;
}

export interface ExpenseSubmission {
  id: string;
  project_id: string;
  expense_category: string;
  excel_url: string | null;
  excel_filename: string | null;
  invoice_urls: InvoiceFile[];
  ai_summary: AISummary | null;
  total_amount: number | null;
  submitted_by: string | null;
  created_at: string;
  discounts_received: boolean;
  vendor_discounts: VendorDiscount[];
  points_received: boolean;
  loyalty_points: LoyaltyPoint[];
}

export interface AISummaryItem {
  description: string;
  vendor?: string;
  amount: number;
}

export interface AISummaryCategory {
  name: string;
  items: AISummaryItem[];
  subtotal: number;
}

export interface AISummary {
  categories: AISummaryCategory[];
  grand_total: number;
  narrative: string;
  currency: string;
}

export function useProjectExpenseSubmissions(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-expense-submissions", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase as any)
        .from("project_expense_submissions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExpenseSubmission[];
    },
    enabled: !!projectId,
  });
}

export function useCreateExpenseSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      projectId: string;
      category: string;
      excelFile: File | null;
      invoiceFiles: File[];
      userId: string;
      discountsReceived: boolean;
      vendorDiscounts: VendorDiscount[];
      pointsReceived: boolean;
      loyaltyPoints: LoyaltyPoint[];
    }) => {
      const { projectId, category, excelFile, invoiceFiles, userId, discountsReceived, vendorDiscounts, pointsReceived, loyaltyPoints } = payload;

      // Upload excel
      let excelUrl: string | null = null;
      let excelFilename: string | null = null;
      if (excelFile) {
        const path = `expenses/${projectId}/excel_${Date.now()}_${excelFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, excelFile, { upsert: false });
        if (upErr) throw new Error("Excel upload failed: " + upErr.message);
        const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(path);
        excelUrl = urlData.publicUrl;
        excelFilename = excelFile.name;
      }

      // Upload invoices
      const invoiceUrls: InvoiceFile[] = [];
      for (const file of invoiceFiles) {
        const path = `expenses/${projectId}/inv_${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, file, { upsert: false });
        if (upErr) throw new Error(`Invoice upload failed (${file.name}): ` + upErr.message);
        const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(path);
        invoiceUrls.push({ url: urlData.publicUrl, name: file.name, size: file.size });
      }

      // Insert submission record
      const { data: submission, error: insErr } = await (supabase as any)
        .from("project_expense_submissions")
        .insert({
          project_id: projectId,
          expense_category: category,
          excel_url: excelUrl,
          excel_filename: excelFilename,
          invoice_urls: invoiceUrls,
          submitted_by: userId,
          discounts_received: discountsReceived,
          vendor_discounts: vendorDiscounts,
          points_received: pointsReceived,
          loyalty_points: loyaltyPoints,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      return submission as ExpenseSubmission;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-expense-submissions", vars.projectId] });
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useAnalyzeExpenses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submission: ExpenseSubmission) => {
      const { data, error } = await supabase.functions.invoke("analyze-project-expenses", {
        body: {
          submissionId: submission.id,
          excelUrl: submission.excel_url,
          invoiceUrls: submission.invoice_urls,
          category: submission.expense_category,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Analysis failed");
      return data.summary as AISummary;
    },
    onSuccess: (_, submission) => {
      qc.invalidateQueries({ queryKey: ["project-expense-submissions", submission.project_id] });
      toast.success("AI analysis complete!");
    },
    onError: (err: any) => toast.error("Analysis failed: " + err.message),
  });
}
