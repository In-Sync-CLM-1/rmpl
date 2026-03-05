import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Printer, Calendar, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface SalarySlip {
  id: string;
  user_id: string;
  month: number;
  year: number;
  paid_days: number;
  loss_of_pay_days: number;
  basic_salary: number;
  hra: number;
  conveyance_allowance: number;
  medical_allowance: number;
  special_allowance: number;
  other_allowance: number;
  incentive: number;
  bonus: number;
  total_earnings: number;
  epf: number;
  esic: number;
  tds: number;
  professional_tax: number;
  health_insurance: number;
  salary_advance: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  net_pay_words: string | null;
  is_published: boolean;
  generated_at: string;
  remarks: string | null;
}

interface EmployeeDetails {
  id: string;
  user_id: string;
  employee_code: string | null;
  department: string | null;
  designation: string | null;
  date_of_joining: string | null;
  pf_number: string | null;
  esi_number: string | null;
  uan_number: string | null;
  pan_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SalarySlips() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { permissions } = useUserPermissions();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: employeeDetails } = useQuery({
    queryKey: ["employee-details", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("employee_salary_details")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as EmployeeDetails | null;
    },
    enabled: !!user?.id,
  });

  const { data: salarySlips = [], isLoading } = useQuery({
    queryKey: ["salary-slips", user?.id, selectedYear],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("salary_slips")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", selectedYear)
        .eq("is_published", true)
        .order("month", { ascending: false });

      if (error) throw error;
      return data as SalarySlip[];
    },
    enabled: !!user?.id,
  });

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const handleViewSlip = (slip: SalarySlip) => {
    setSelectedSlip(slip);
    setViewDialogOpen(true);
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open("", "", "width=800,height=600");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Salary Slip - ${MONTHS[(selectedSlip?.month || 1) - 1]} ${selectedSlip?.year}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; }
                .header { text-align: center; margin-bottom: 20px; }
                .company-name { font-size: 24px; font-weight: bold; }
                .slip-title { font-size: 18px; margin-top: 10px; }
                .section-title { background-color: #e5e5e5; padding: 8px; font-weight: bold; }
                .net-pay { font-size: 18px; font-weight: bold; background-color: #e8f5e9; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const numberToWords = (num: number): string => {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    if (num === 0) return "Zero";
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + numberToWords(num % 100) : "");
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + numberToWords(num % 1000) : "");
    if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + numberToWords(num % 100000) : "");
    return numberToWords(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + numberToWords(num % 10000000) : "");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Salary Slips</h1>
          <p className="text-muted-foreground">View and download your salary slips</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Employee Info Card */}
      {employeeDetails && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Employee Code:</span>
                <p className="font-medium">{employeeDetails.employee_code || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Department:</span>
                <p className="font-medium">{employeeDetails.department || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">PF Number:</span>
                <p className="font-medium">{employeeDetails.pf_number || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">UAN:</span>
                <p className="font-medium">{employeeDetails.uan_number || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Salary Slips Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : salarySlips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No salary slips available for {selectedYear}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {salarySlips.map((slip) => (
            <Card key={slip.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {MONTHS[slip.month - 1]} {slip.year}
                  </span>
                  <Badge variant="outline">Published</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Paid Days:</span>
                    <p className="font-medium">{slip.paid_days}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LOP Days:</span>
                    <p className="font-medium">{slip.loss_of_pay_days}</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Earnings:</span>
                    <span className="text-green-600">{formatCurrency(slip.total_earnings)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Deductions:</span>
                    <span className="text-red-600">-{formatCurrency(slip.total_deductions)}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                    <span>Net Pay:</span>
                    <span className="text-primary">{formatCurrency(slip.net_pay)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleViewSlip(slip)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      handleViewSlip(slip);
                      setTimeout(handlePrint, 100);
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Salary Slip Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Salary Slip - {selectedSlip && `${MONTHS[selectedSlip.month - 1]} ${selectedSlip.year}`}
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Print / Download
              </Button>
            </DialogTitle>
          </DialogHeader>

          {selectedSlip && (
            <div ref={printRef} className="space-y-4">
              {/* Header */}
              <div className="header text-center border-b pb-4">
                <div className="company-name text-2xl font-bold">REDEFINE MARCOM PVT LTD</div>
                <div className="text-sm text-muted-foreground">
                  Salary Slip for {MONTHS[selectedSlip.month - 1]} {selectedSlip.year}
                </div>
              </div>

              {/* Employee Details */}
              <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded">
                <div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Employee Name:</span>
                    <span className="font-medium">{profile?.full_name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Employee Code:</span>
                    <span className="font-medium">{employeeDetails?.employee_code || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{employeeDetails?.department || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Designation:</span>
                    <span className="font-medium">{employeeDetails?.designation || "N/A"}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">PF Number:</span>
                    <span className="font-medium">{employeeDetails?.pf_number || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">UAN:</span>
                    <span className="font-medium">{employeeDetails?.uan_number || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Paid Days:</span>
                    <span className="font-medium">{selectedSlip.paid_days}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">LOP Days:</span>
                    <span className="font-medium">{selectedSlip.loss_of_pay_days}</span>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions */}
              <div className="grid grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="border rounded">
                  <div className="section-title bg-green-50 dark:bg-green-950 p-2 font-semibold text-green-800 dark:text-green-200">
                    Earnings
                  </div>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>Basic Salary</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.basic_salary)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>HRA</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.hra)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Conveyance</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.conveyance_allowance)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Medical Allowance</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.medical_allowance)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Special Allowance</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.special_allowance)}</TableCell>
                      </TableRow>
                      {selectedSlip.incentive > 0 && (
                        <TableRow>
                          <TableCell>Incentive</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSlip.incentive)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="font-bold bg-green-50 dark:bg-green-950">
                        <TableCell>Total Earnings</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(selectedSlip.total_earnings)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Deductions */}
                <div className="border rounded">
                  <div className="section-title bg-red-50 dark:bg-red-950 p-2 font-semibold text-red-800 dark:text-red-200">
                    Deductions
                  </div>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>EPF</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.epf)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>ESIC</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.esic)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Professional Tax</TableCell>
                        <TableCell className="text-right">{formatCurrency(selectedSlip.professional_tax)}</TableCell>
                      </TableRow>
                      {selectedSlip.tds > 0 && (
                        <TableRow>
                          <TableCell>TDS</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSlip.tds)}</TableCell>
                        </TableRow>
                      )}
                      {selectedSlip.health_insurance > 0 && (
                        <TableRow>
                          <TableCell>Health Insurance</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSlip.health_insurance)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="font-bold bg-red-50 dark:bg-red-950">
                        <TableCell>Total Deductions</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(selectedSlip.total_deductions)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Net Pay */}
              <div className="net-pay border rounded p-4 bg-primary/5">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-muted-foreground">Net Pay</div>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(selectedSlip.net_pay)}</div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {selectedSlip.net_pay_words || numberToWords(Math.round(selectedSlip.net_pay))} Rupees Only
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="footer text-center text-xs text-muted-foreground pt-4 border-t">
                This is a computer-generated document. No signature required.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
