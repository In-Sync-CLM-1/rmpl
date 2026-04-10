import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPENSE_CATEGORIES,
  useProjectExpenseSubmissions,
  useCreateExpenseSubmission,
  useAnalyzeExpenses,
  type ExpenseSubmission,
  type AISummary,
} from "@/hooks/useProjectExpenses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileSpreadsheet, FileText, Image as ImageIcon, Upload, Loader2, Sparkles,
  ChevronDown, ChevronUp, X, IndianRupee, Receipt, Plus,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

export function ProjectExpensesTab({ projectId }: Props) {
  const { data: submissions = [], isLoading } = useProjectExpenseSubmissions(projectId);
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const createSubmission = useCreateExpenseSubmission();
  const analyzeExpenses = useAnalyzeExpenses();

  const [category, setCategory] = useState<string>("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = category && (excelFile || invoiceFiles.length > 0);

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!ok) { toast.error("Only Excel (.xlsx, .xls) or CSV files allowed"); return; }
    setExcelFile(file);
    e.target.value = "";
  };

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      const ok = /\.(pdf|jpg|jpeg|png|webp)$/i.test(f.name);
      if (!ok) toast.error(`${f.name}: only PDF or image files`);
      return ok;
    });
    setInvoiceFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  };

  const removeInvoice = (i: number) => setInvoiceFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!user?.id) { toast.error("Not authenticated"); return; }
    await createSubmission.mutateAsync({
      projectId,
      category,
      excelFile,
      invoiceFiles,
      userId: user.id,
    });
    setCategory("");
    setExcelFile(null);
    setInvoiceFiles([]);
    toast.success("Expense submission saved!");
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5" />
            Submit Project Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Category */}
          <div className="space-y-2">
            <Label>Expense Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Excel Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Expense Summary Sheet
              </Label>
              <p className="text-xs text-muted-foreground">.xlsx, .xls, or .csv</p>
              {excelFile ? (
                <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-green-50 dark:bg-green-950/20 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="truncate flex-1">{excelFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExcelFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelChange} />
                  <Button type="button" variant="outline" className="w-full" onClick={() => excelInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Choose File
                  </Button>
                </>
              )}
            </div>

            {/* Invoice Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-600" />
                Vendor Invoices
              </Label>
              <p className="text-xs text-muted-foreground">PDF or images (multiple allowed)</p>
              {invoiceFiles.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {invoiceFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded text-xs bg-blue-50 dark:bg-blue-950/20">
                      {f.name.endsWith(".pdf") ? (
                        <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="truncate flex-1">{f.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeInvoice(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={invoiceInputRef} type="file" accept=".pdf,image/*" multiple className="hidden" onChange={handleInvoiceChange} />
              <Button type="button" variant="outline" className="w-full" onClick={() => invoiceInputRef.current?.click()}>
                <Plus className="h-4 w-4 mr-2" /> Add Invoices
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || createSubmission.isPending}
            className="w-full"
          >
            {createSubmission.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Submit Expenses</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Past Submissions */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : submissions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past Submissions</h3>
          {submissions.map((sub) => (
            <SubmissionCard
              key={sub.id}
              submission={sub}
              expanded={expandedId === sub.id}
              onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              onAnalyze={() => analyzeExpenses.mutate(sub)}
              analyzing={analyzeExpenses.isPending && analyzeExpenses.variables?.id === sub.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SubmissionCard({
  submission, expanded, onToggle, onAnalyze, analyzing,
}: {
  submission: ExpenseSubmission;
  expanded: boolean;
  onToggle: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  const invCount = submission.invoice_urls?.length || 0;
  const summary = submission.ai_summary as AISummary | null;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="secondary">{submission.expense_category}</Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(submission.created_at), "dd MMM yyyy, h:mm a")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {submission.excel_filename && (
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                  {submission.excel_filename}
                </span>
              )}
              {invCount > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  {invCount} invoice{invCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {summary ? (
              <>
                <span className="font-bold text-lg flex items-center gap-0.5">
                  <IndianRupee className="h-4 w-4" />
                  {summary.grand_total.toLocaleString("en-IN")}
                </span>
                <Button variant="ghost" size="sm" onClick={onToggle}>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={onAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analysing...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Analyse with AI</>
                )}
              </Button>
            )}
          </div>
        </div>

        {expanded && summary && (
          <>
            <Separator className="my-3" />
            <AISummaryView summary={summary} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AISummaryView({ summary }: { summary: AISummary }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground italic">{summary.narrative}</p>
      <div className="space-y-3">
        {summary.categories.map((cat) => (
          <div key={cat.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold">{cat.name}</span>
              <span className="text-sm font-semibold">₹{cat.subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="space-y-1 pl-3">
              {cat.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex-1 truncate">
                    {item.description}{item.vendor ? ` — ${item.vendor}` : ""}
                  </span>
                  <span className="ml-2 shrink-0">₹{item.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="flex items-center justify-between font-bold">
        <span>Grand Total</span>
        <span className="text-lg flex items-center gap-0.5">
          <IndianRupee className="h-4 w-4" />
          {summary.grand_total.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}
