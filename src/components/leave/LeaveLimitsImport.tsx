import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface LeaveLimitsImportProps {
  year: number;
  onClose: () => void;
}

export function LeaveLimitsImport({ year, onClose }: LeaveLimitsImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);

    Papa.parse(selectedFile, {
      header: true,
      complete: (results) => {
        const data = results.data.filter((row: any) => row.email);
        setPreview(data.slice(0, 5));
        
        // Validate required columns
        const requiredCols = ["email"];
        const missingCols = requiredCols.filter(col => !results.meta.fields?.includes(col));
        if (missingCols.length > 0) {
          setErrors([`Missing required columns: ${missingCols.join(", ")}`]);
        }
      },
      error: (error) => {
        setErrors([`Failed to parse CSV: ${error.message}`]);
      },
    });
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      return new Promise<{ success: number; failed: number }>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: async (results) => {
            const data = results.data.filter((row: any) => row.email);
            let success = 0;
            let failed = 0;

            for (const row of data as any[]) {
              try {
                // Find user by email
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("email", row.email.toLowerCase().trim())
                  .maybeSingle();

                if (!profile) {
                  failed++;
                  continue;
                }

                // Update limits
                const { error } = await supabase
                  .from("leave_balances")
                   .update({
                    casual_leave_limit: row.casual_leave_limit ? Number(row.casual_leave_limit) : undefined,
                    earned_leave_limit: row.earned_leave_limit ? Number(row.earned_leave_limit) : undefined,
                    compensatory_off_limit: row.compensatory_off_limit ? Number(row.compensatory_off_limit) : undefined,
                    maternity_leave_limit: row.maternity_leave_limit ? Number(row.maternity_leave_limit) : undefined,
                    paternity_leave_limit: row.paternity_leave_limit ? Number(row.paternity_leave_limit) : undefined,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("user_id", profile.id)
                  .eq("year", year);

                if (error) {
                  failed++;
                } else {
                  success++;
                }
              } catch {
                failed++;
              }
            }

            resolve({ success, failed });
          },
          error: (error) => {
            reject(new Error(`CSV parse error: ${error.message}`));
          },
        });
      });
    },
    onSuccess: ({ success, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances-admin"] });
      toast.success(`Import complete: ${success} updated, ${failed} failed`);
      onClose();
    },
    onError: (error: Error) => {
      toast.error("Import failed: " + error.message);
    },
  });

  const downloadTemplate = () => {
    const csv = `email,casual_leave_limit,earned_leave_limit,compensatory_off_limit,maternity_leave_limit,paternity_leave_limit
example@company.com,12,15,0,180,3`;
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leave_limits_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Upload a CSV file to update leave limits for multiple employees.
        </p>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Template
        </Button>
      </div>

      <Input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
      />

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.map((err, i) => <div key={i}>{err}</div>)}
          </AlertDescription>
        </Alert>
      )}

      {preview.length > 0 && errors.length === 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Preview: {preview.length} rows detected. Click Import to proceed.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => importMutation.mutate()}
          disabled={!file || errors.length > 0 || importMutation.isPending}
        >
          <Upload className="mr-2 h-4 w-4" />
          {importMutation.isPending ? "Importing..." : "Import"}
        </Button>
      </div>
    </div>
  );
}
