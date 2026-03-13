import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, Eye, Users, Building2, Phone, Mail, Upload } from "lucide-react";
import { useEmployeeDirectory, EmployeeDirectoryRecord } from "@/hooks/useEmployeePersonalDetails";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { EmployeeDataImportDialog } from "@/components/EmployeeDataImportDialog";
import Papa from "papaparse";
import { toast } from "sonner";

export default function EmployeeDirectory() {
  const navigate = useNavigate();
  const { permissions, isLoading: permissionsLoading } = useUserPermissions();
  const { data: employees, isLoading } = useEmployeeDirectory();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDirectoryRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (!searchTerm) return employees;
    
    const term = searchTerm.toLowerCase();
    return employees.filter((emp) => {
      const empCode = emp.employee_salary_details?.[0]?.employee_code?.toLowerCase() || "";
      return (
        emp.full_name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        empCode.includes(term) ||
        emp.phone?.toLowerCase().includes(term)
      );
    });
  }, [employees, searchTerm]);

  // Access control (after all hooks)
  if (!permissionsLoading && !permissions?.canViewEmployeeDirectory) {
    navigate("/dashboard");
    return null;
  }

  const handleExportCSV = () => {
    if (!employees || employees.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvData = employees.map((emp) => {
      const personal = emp.employee_personal_details;
      const salary = emp.employee_salary_details?.[0];
      
      return {
        "Employee Code": salary?.employee_code || "-",
        "Employee Name": emp.full_name || "-",
        "Title (Salutation)": personal?.title || "-",
        "Gender": personal?.gender || "-",
        "D.O.B.": personal?.date_of_birth ? format(new Date(personal.date_of_birth), "dd/MM/yyyy") : "-",
        "Marital Status": personal?.marital_status || "-",
        "Contact No. (Self)": emp.phone || "-",
        "Mobile No. 2": personal?.mobile_number_2 || "-",
        "Passport No.": personal?.passport_number || "-",
        "PAN No.": salary?.pan_number || "-",
        "Aadhar No.": personal?.aadhar_number || "-",
        "Father's Name": personal?.father_name || "-",
        "Mother's Name": personal?.mother_name || "-",
        "Emergency Contact No.": personal?.emergency_contact_number || "-",
        "Emergency Contact Person Name": personal?.emergency_contact_person_name || "-",
        "Personal E-Mail Id": personal?.personal_email || "-",
        "Official E-Mail Id": emp.email || "-",
        "Employee Type": salary?.employee_type || "-",
        "Date of Joining": salary?.date_of_joining ? format(new Date(salary.date_of_joining), "dd/MM/yyyy") : "-",
        "Date of Confirmation": salary?.date_of_confirmation ? format(new Date(salary.date_of_confirmation), "dd/MM/yyyy") : "-",
        "ESI Number": salary?.esi_number || "-",
        "Location (City)": salary?.location_city || "-",
        "Present Address": personal?.present_address || "-",
        "Permanent Address": personal?.permanent_address || "-",
        "UAN NO.": salary?.uan_number || "-",
        "PF No.": salary?.pf_number || "-",
        "Blood Group": personal?.blood_group || "-",
        "Branch": emp.location || "-",
        "Department": salary?.department || "-",
        "Resignation Date": salary?.resignation_date ? format(new Date(salary.resignation_date), "dd/MM/yyyy") : "-",
        "Last Working Date": salary?.last_working_date ? format(new Date(salary.last_working_date), "dd/MM/yyyy") : "-",
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `employee-directory-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Employee directory exported successfully");
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="px-6 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Employee Directory
          </h2>
          <p className="text-sm text-muted-foreground">
            View and export comprehensive employee data
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              All Employees ({filteredEmployees.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Emp Code</TableHead>
                  <TableHead className="whitespace-nowrap">Employee Name</TableHead>
                  <TableHead className="whitespace-nowrap">Title</TableHead>
                  <TableHead className="whitespace-nowrap">Gender</TableHead>
                  <TableHead className="whitespace-nowrap">D.O.B.</TableHead>
                  <TableHead className="whitespace-nowrap">Marital Status</TableHead>
                  <TableHead className="whitespace-nowrap">Contact No.</TableHead>
                  <TableHead className="whitespace-nowrap">Mobile No. 2</TableHead>
                  <TableHead className="whitespace-nowrap">Passport No.</TableHead>
                  <TableHead className="whitespace-nowrap">PAN No.</TableHead>
                  <TableHead className="whitespace-nowrap">Aadhar No.</TableHead>
                  <TableHead className="whitespace-nowrap">Father's Name</TableHead>
                  <TableHead className="whitespace-nowrap">Mother's Name</TableHead>
                  <TableHead className="whitespace-nowrap">Emergency Contact</TableHead>
                  <TableHead className="whitespace-nowrap">Emergency Contact Person</TableHead>
                  <TableHead className="whitespace-nowrap">Personal Email</TableHead>
                  <TableHead className="whitespace-nowrap">Official Email</TableHead>
                  <TableHead className="whitespace-nowrap">Employee Type</TableHead>
                  <TableHead className="whitespace-nowrap">Date of Joining</TableHead>
                  <TableHead className="whitespace-nowrap">Date of Confirmation</TableHead>
                  <TableHead className="whitespace-nowrap">ESI Number</TableHead>
                  <TableHead className="whitespace-nowrap">Location (City)</TableHead>
                  <TableHead className="whitespace-nowrap">Present Address</TableHead>
                  <TableHead className="whitespace-nowrap">Permanent Address</TableHead>
                  <TableHead className="whitespace-nowrap">UAN No.</TableHead>
                  <TableHead className="whitespace-nowrap">PF No.</TableHead>
                  <TableHead className="whitespace-nowrap">Blood Group</TableHead>
                  <TableHead className="whitespace-nowrap">Branch</TableHead>
                  <TableHead className="whitespace-nowrap">Department</TableHead>
                  <TableHead className="whitespace-nowrap">Resignation Date</TableHead>
                  <TableHead className="whitespace-nowrap">Last Working Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={32} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No employees match your search" : "No employees found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => {
                    const salary = emp.employee_salary_details?.[0];
                    const personal = emp.employee_personal_details;
                    
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{salary?.employee_code || "-"}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{emp.full_name || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.title || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.gender || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.date_of_birth ? format(new Date(personal.date_of_birth), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.marital_status || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{emp.phone || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.mobile_number_2 || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.passport_number || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.pan_number || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.aadhar_number || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.father_name || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.mother_name || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.emergency_contact_number || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{personal?.emergency_contact_person_name || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{personal?.personal_email || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{emp.email}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.employee_type || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.date_of_joining ? format(new Date(salary.date_of_joining), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.date_of_confirmation ? format(new Date(salary.date_of_confirmation), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.esi_number || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.location_city || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={personal?.present_address || ""}>{personal?.present_address || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={personal?.permanent_address || ""}>{personal?.permanent_address || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.uan_number || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.pf_number || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {personal?.blood_group ? <Badge variant="secondary">{personal.blood_group}</Badge> : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {emp.location ? <Badge variant="outline">{emp.location}</Badge> : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.department || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.resignation_date ? format(new Date(salary.resignation_date), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{salary?.last_working_date ? format(new Date(salary.last_working_date), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(emp)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Detail Sheet */}
      <Sheet open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedEmployee?.full_name || "Employee Details"}
            </SheetTitle>
            <SheetDescription>
              Complete employee information
            </SheetDescription>
          </SheetHeader>

          {selectedEmployee && (
            <div className="mt-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Basic Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <DetailItem
                    label="Employee Code"
                    value={selectedEmployee.employee_salary_details?.[0]?.employee_code}
                  />
                  <DetailItem
                    label="Full Name"
                    value={selectedEmployee.full_name}
                  />
                  <DetailItem
                    label="Title (Salutation)"
                    value={selectedEmployee.employee_personal_details?.title}
                  />
                  <DetailItem
                    label="Gender"
                    value={selectedEmployee.employee_personal_details?.gender}
                  />
                  <DetailItem
                    label="D.O.B."
                    value={selectedEmployee.employee_personal_details?.date_of_birth
                      ? format(new Date(selectedEmployee.employee_personal_details.date_of_birth), "dd/MM/yyyy")
                      : null
                    }
                  />
                  <DetailItem
                    label="Marital Status"
                    value={selectedEmployee.employee_personal_details?.marital_status}
                  />
                  <DetailItem
                    label="Blood Group"
                    value={selectedEmployee.employee_personal_details?.blood_group}
                  />
                  <DetailItem
                    label="Passport No."
                    value={selectedEmployee.employee_personal_details?.passport_number}
                  />
                </div>
              </div>

              {/* Employment Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Employment Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <DetailItem
                    label="Employee Type"
                    value={selectedEmployee.employee_salary_details?.[0]?.employee_type}
                  />
                  <DetailItem
                    label="Department"
                    value={selectedEmployee.employee_salary_details?.[0]?.department}
                  />
                  <DetailItem
                    label="Branch"
                    value={selectedEmployee.location}
                  />
                  <DetailItem
                    label="Location (City)"
                    value={selectedEmployee.employee_salary_details?.[0]?.location_city}
                  />
                  <DetailItem
                    label="Date of Joining"
                    value={selectedEmployee.employee_salary_details?.[0]?.date_of_joining
                      ? format(new Date(selectedEmployee.employee_salary_details[0].date_of_joining), "dd/MM/yyyy")
                      : null
                    }
                  />
                  <DetailItem
                    label="Date of Confirmation"
                    value={selectedEmployee.employee_salary_details?.[0]?.date_of_confirmation
                      ? format(new Date(selectedEmployee.employee_salary_details[0].date_of_confirmation), "dd/MM/yyyy")
                      : null
                    }
                  />
                  <DetailItem
                    label="Resignation Date"
                    value={selectedEmployee.employee_salary_details?.[0]?.resignation_date
                      ? format(new Date(selectedEmployee.employee_salary_details[0].resignation_date), "dd/MM/yyyy")
                      : null
                    }
                  />
                  <DetailItem
                    label="Last Working Date"
                    value={selectedEmployee.employee_salary_details?.[0]?.last_working_date
                      ? format(new Date(selectedEmployee.employee_salary_details[0].last_working_date), "dd/MM/yyyy")
                      : null
                    }
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <DetailItem
                    label="Contact No. (Self)"
                    value={selectedEmployee.phone}
                    icon={<Phone className="h-3.5 w-3.5" />}
                  />
                  <DetailItem
                    label="Mobile No. 2"
                    value={selectedEmployee.employee_personal_details?.mobile_number_2}
                    icon={<Phone className="h-3.5 w-3.5" />}
                  />
                  <DetailItem
                    label="Emergency Contact No."
                    value={selectedEmployee.employee_personal_details?.emergency_contact_number}
                    icon={<Phone className="h-3.5 w-3.5" />}
                  />
                  <DetailItem
                    label="Emergency Contact Person"
                    value={selectedEmployee.employee_personal_details?.emergency_contact_person_name}
                  />
                  <DetailItem
                    label="Personal E-Mail"
                    value={selectedEmployee.employee_personal_details?.personal_email}
                    icon={<Mail className="h-3.5 w-3.5" />}
                  />
                  <DetailItem
                    label="Official E-Mail"
                    value={selectedEmployee.email}
                    icon={<Mail className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              {/* Family Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Family Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <DetailItem
                    label="Father's Name"
                    value={selectedEmployee.employee_personal_details?.father_name}
                  />
                  <DetailItem
                    label="Mother's Name"
                    value={selectedEmployee.employee_personal_details?.mother_name}
                  />
                </div>
              </div>

              {/* Statutory Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Statutory Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <DetailItem
                    label="PAN No."
                    value={selectedEmployee.employee_salary_details?.[0]?.pan_number}
                  />
                  <DetailItem
                    label="Aadhar No."
                    value={selectedEmployee.employee_personal_details?.aadhar_number}
                  />
                  <DetailItem
                    label="UAN No."
                    value={selectedEmployee.employee_salary_details?.[0]?.uan_number}
                  />
                  <DetailItem
                    label="PF No."
                    value={selectedEmployee.employee_salary_details?.[0]?.pf_number}
                  />
                  <DetailItem
                    label="ESI Number"
                    value={selectedEmployee.employee_salary_details?.[0]?.esi_number}
                  />
                </div>
              </div>

              {/* Address Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Address Information
                </h4>
                <div className="space-y-4 text-sm">
                  <DetailItem 
                    label="Present Address" 
                    value={selectedEmployee.employee_personal_details?.present_address} 
                    icon={<Building2 className="h-3.5 w-3.5" />}
                  />
                  <DetailItem 
                    label="Permanent Address" 
                    value={selectedEmployee.employee_personal_details?.permanent_address}
                    icon={<Building2 className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <EmployeeDataImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function DetailItem({ 
  label, 
  value, 
  icon 
}: { 
  label: string; 
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="flex items-center gap-2">
        {icon}
        <span className={value ? "" : "text-muted-foreground"}>
          {value || "Not provided"}
        </span>
      </p>
    </div>
  );
}
