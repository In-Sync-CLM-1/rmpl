import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const CSV_COLUMNS = [
  "Official Email",
  "Employee Code",
  "Title (Salutation)",
  "Gender",
  "D.O.B.",
  "Marital Status",
  "Contact No.",
  "Mobile No. 2",
  "Passport No.",
  "PAN No.",
  "Aadhar No.",
  "Father's Name",
  "Mother's Name",
  "Emergency Contact No.",
  "Emergency Contact Person Name",
  "Personal Email",
  "Employee Type",
  "Date of Joining",
  "Date of Confirmation",
  "ESI Number",
  "Location (City)",
  "Present Address",
  "Permanent Address",
  "UAN No.",
  "PF No.",
  "Blood Group",
  "Branch",
  "Department",
  "Resignation Date",
  "Last Working Date",
  "Basic Salary",
  "HRA",
  "Conveyance Allowance",
  "Medical Allowance",
  "Special Allowance",
  "Other Allowance",
  "EPF %",
  "ESIC %",
  "Professional Tax",
];

interface ImportRow {
  [key: string]: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface EmployeeDataImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDataImportDialog({ open, onOpenChange }: EmployeeDataImportDialogProps) {
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleDownloadTemplate = () => {
    const csv = Papa.unparse({ fields: CSV_COLUMNS, data: [] });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee-data-template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as ImportRow[];
        if (data.length === 0) {
          toast.error("CSV file is empty");
          return;
        }
        // Validate that "Official Email" column exists
        if (!data[0]?.["Official Email"] && !data[0]?.["Official Email"]) {
          toast.error("CSV must contain an 'Official Email' column");
          return;
        }
        setParsedData(data);
        toast.success(`Parsed ${data.length} rows`);
      },
      error: () => toast.error("Failed to parse CSV file"),
    });
  };

  const parseDateField = (value: string): string | null => {
    if (!value || value === "-") return null;
    // Try dd/MM/yyyy
    const parts = value.split("/");
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      const d = new Date(`${yyyy}-${mm}-${dd}`);
      if (!isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`;
    }
    // Try yyyy-MM-dd directly
    const d = new Date(value);
    if (!isNaN(d.getTime())) return value;
    return null;
  };

  const clean = (v: string | undefined): string | null => {
    if (!v || v.trim() === "" || v.trim() === "-") return null;
    return v.trim();
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setImporting(true);
    setProgress(0);
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const email = clean(row["Official Email"]);
      if (!email) {
        errors.push(`Row ${i + 1}: Missing Official Email`);
        setProgress(Math.round(((i + 1) / parsedData.length) * 100));
        continue;
      }

      try {
        // Look up profile by email
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (profileErr) throw profileErr;
        if (!profile) {
          errors.push(`Row ${i + 1}: No employee found with email ${email}`);
          setProgress(Math.round(((i + 1) / parsedData.length) * 100));
          continue;
        }

        const userId = profile.id;

        // Update profiles (phone, location)
        const profileUpdate: Record<string, string> = {};
        if (clean(row["Contact No."])) profileUpdate.phone = clean(row["Contact No."])!;
        if (clean(row["Branch"])) profileUpdate.location = clean(row["Branch"])!;
        if (Object.keys(profileUpdate).length > 0) {
          await supabase.from("profiles").update(profileUpdate).eq("id", userId);
        }

        // Upsert employee_personal_details
        const personalData: Record<string, string | null> = {
          user_id: userId,
          title: clean(row["Title (Salutation)"]),
          gender: clean(row["Gender"]),
          date_of_birth: parseDateField(row["D.O.B."] || ""),
          marital_status: clean(row["Marital Status"]),
          mobile_number_2: clean(row["Mobile No. 2"]),
          passport_number: clean(row["Passport No."]),
          aadhar_number: clean(row["Aadhar No."]),
          father_name: clean(row["Father's Name"]),
          mother_name: clean(row["Mother's Name"]),
          emergency_contact_number: clean(row["Emergency Contact No."]),
          emergency_contact_person_name: clean(row["Emergency Contact Person Name"]),
          personal_email: clean(row["Personal Email"]),
          present_address: clean(row["Present Address"]),
          permanent_address: clean(row["Permanent Address"]),
          blood_group: clean(row["Blood Group"]),
        };
        // Remove null values so we don't overwrite existing data
        const personalFiltered = Object.fromEntries(
          Object.entries(personalData).filter(([k, v]) => k === "user_id" || v !== null)
        );

        const { data: existingPersonal } = await supabase
          .from("employee_personal_details")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingPersonal) {
          const { user_id, ...rest } = personalFiltered;
          if (Object.keys(rest).length > 0) {
            await supabase.from("employee_personal_details").update(rest).eq("user_id", userId);
          }
        } else if (Object.keys(personalFiltered).length > 1) {
          await supabase.from("employee_personal_details").insert(personalFiltered as any);
        }

        // Upsert employee_salary_details
        const parseNum = (v: string | undefined): number | null => {
          const c = clean(v);
          if (!c) return null;
          const n = parseFloat(c.replace(/,/g, ""));
          return isNaN(n) ? null : n;
        };

        const salaryData: Record<string, string | number | null> = {
          user_id: userId,
          employee_code: clean(row["Employee Code"]),
          employee_type: clean(row["Employee Type"]),
          date_of_joining: parseDateField(row["Date of Joining"] || ""),
          date_of_confirmation: parseDateField(row["Date of Confirmation"] || ""),
          esi_number: clean(row["ESI Number"]),
          location_city: clean(row["Location (City)"]),
          resignation_date: parseDateField(row["Resignation Date"] || ""),
          last_working_date: parseDateField(row["Last Working Date"] || ""),
          pan_number: clean(row["PAN No."]),
          uan_number: clean(row["UAN No."]),
          pf_number: clean(row["PF No."]),
          department: clean(row["Department"]),
          basic_salary: parseNum(row["Basic Salary"]),
          hra: parseNum(row["HRA"]),
          conveyance_allowance: parseNum(row["Conveyance Allowance"]),
          medical_allowance: parseNum(row["Medical Allowance"]),
          special_allowance: parseNum(row["Special Allowance"]),
          other_allowance: parseNum(row["Other Allowance"]),
          epf_percentage: parseNum(row["EPF %"]),
          esic_percentage: parseNum(row["ESIC %"]),
          professional_tax: parseNum(row["Professional Tax"]),
        };
        const salaryFiltered = Object.fromEntries(
          Object.entries(salaryData).filter(([k, v]) => k === "user_id" || v !== null)
        );

        const { data: existingSalary } = await supabase
          .from("employee_salary_details")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingSalary) {
          const { user_id, ...rest } = salaryFiltered;
          if (Object.keys(rest).length > 0) {
            await supabase.from("employee_salary_details").update(rest).eq("user_id", userId);
          }
        } else if (Object.keys(salaryFiltered).length > 1) {
          await supabase.from("employee_salary_details").insert(salaryFiltered as any);
        }

        success++;
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${email}): ${err.message || "Unknown error"}`);
      }

      setProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    setResult({ success, failed: errors.length, errors });
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["employee-directory"] });
    if (success > 0) toast.success(`Successfully imported ${success} employee records`);
    if (errors.length > 0) toast.error(`${errors.length} rows failed`);
  };

  const handleClose = () => {
    setParsedData([]);
    setResult(null);
    setProgress(0);
    setImporting(false);
    onOpenChange(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Employee Data
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk-update employee records. Use "Official Email" to match employees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <p className="text-sm font-medium">Step 1: Download the CSV template</p>
              <p className="text-xs text-muted-foreground">Contains all field headers. Fill in data and re-upload.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* Step 2: Upload CSV */}
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <p className="text-sm font-medium">Step 2: Upload your filled CSV</p>
              <p className="text-xs text-muted-foreground">Only non-empty fields will be updated (existing data preserved).</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Preview */}
          {parsedData.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Preview ({parsedData.length} rows)</p>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importing..." : `Import ${parsedData.length} Records`}
                </Button>
              </div>

              {importing && <Progress value={progress} className="h-2" />}

              <ScrollArea className="h-[300px] rounded-md border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs whitespace-nowrap">#</TableHead>
                        {CSV_COLUMNS.map((col) => (
                          <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          {CSV_COLUMNS.map((col) => (
                            <TableCell key={col} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                              {row[col] || "-"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
              {parsedData.length > 50 && (
                <p className="text-xs text-muted-foreground">Showing first 50 of {parsedData.length} rows</p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {result.success} Imported
                </Badge>
                {result.failed > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {result.failed} Failed
                  </Badge>
                )}
              </div>
              {result.errors.length > 0 && (
                <ScrollArea className="h-[200px] rounded-md border p-3">
                  <div className="space-y-1">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
