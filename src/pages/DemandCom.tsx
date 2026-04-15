import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Mail, Phone, MapPin, LogOut, LayoutDashboard, Upload, Filter, Download, Send, X, Check, ChevronsUpDown, Users, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { CallButton } from "@/components/CallButton";
import { VapiCallButton } from "@/components/VapiCallButton";
import { CallHistory } from "@/components/CallHistory";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ClientSideExportDialog } from "@/components/ClientSideExportDialog";
import { DemandComAssignmentDialog } from "@/components/DemandComAssignmentDialog";
import { BulkSelectAssignDialog } from "@/components/BulkSelectAssignDialog";
import { DeleteActivityDialog } from "@/components/DeleteActivityDialog";
import { SendWhatsAppDialog } from "@/components/whatsapp/SendWhatsAppDialog";
import { WhatsAppHistory } from "@/components/whatsapp/WhatsAppHistory";
import { SendEmailDialog } from "@/components/email/SendEmailDialog";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import rmplLogo from "@/assets/rmpl-logo.png";

interface DemandCom {
  id: string;
  name: string;
  salutation?: string;
  mobile_numb: string;
  mobile2?: string;
  designation?: string;
  deppt?: string;
  job_level_updated?: string;
  linkedin?: string;
  official?: string;
  personal_email_id?: string;
  generic_email_id?: string;
  industry_type?: string;
  sub_industry?: string;
  company_name?: string;
  company_linkedin_url?: string;
  associated_member_linkedin?: string;
  address?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  zone?: string;
  tier?: string;
  pincode?: string;
  website?: string;
  turnover?: string;
  turnover_link?: string;
  emp_size?: string;
  erp_name?: string;
  erp_vendor?: string;
  activity_name?: string;
  latest_disposition?: string;
  latest_subdisposition?: string;
  next_call_date?: string;
  last_call_date?: string;
  remarks?: string;
  source?: string;
  source_1?: string;
  extra?: string;
  extra_1?: string;
  extra_2?: string;
  created_at: string;
  created_by: string | null;
  updated_at?: string;
  creator_name?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
}

export default function DemandCom() {
  const navigate = useNavigate();
  const [demandComRecords, setDemandComRecords] = useState<DemandCom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameEmailFilter, setNameEmailFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [activityNameFilter, setActivityNameFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState<string[]>([]);
  const [subdispositionFilter, setSubdispositionFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [availableDispositions, setAvailableDispositions] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [dispositionData, setDispositionData] = useState<Array<{
    disposition: string;
    subdispositions: string[];
  }>>([]);
  const [appliedFilters, setAppliedFilters] = useState<{
    nameEmail: string;
    city: string;
    activityName: string;
    assignedTo: string;
    disposition: string[];
    subdisposition: string[];
  }>({
    nameEmail: "",
    city: "",
    activityName: "",
    assignedTo: "",
    disposition: [],
    subdisposition: []
  });
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canBulkDelete, setCanBulkDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [whatsappContact, setWhatsappContact] = useState<DemandCom | null>(null);
  const [showWhatsappSend, setShowWhatsappSend] = useState(false);
  const [emailContact, setEmailContact] = useState<DemandCom | null>(null);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [canAssign, setCanAssign] = useState(false);
  const [canBulkAssign, setCanBulkAssign] = useState(false);
  const [availableActivityNames, setAvailableActivityNames] = useState<string[]>([]);
  const [activityNameOpen, setActivityNameOpen] = useState(false);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteActivityDialog, setShowDeleteActivityDialog] = useState(false);

  useEffect(() => {
    checkAuthAndFetchDemandCom();
  }, [currentPage, itemsPerPage, appliedFilters]);

  useEffect(() => {
    const fetchDispositionsAndUsers = async () => {
      const { data: dispositionsData } = await supabase
        .from('call_dispositions')
        .select('disposition, subdispositions')
        .eq('is_active', true)
        .order('disposition');
      
      if (dispositionsData) {
        setDispositionData(dispositionsData);
        const dispositions = dispositionsData.map(d => d.disposition);
        setAvailableDispositions(["No Disposition", ...dispositions]);
      }

      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      
      if (usersData) {
        setAvailableUsers(usersData);
      }

      // Fetch all distinct activity names using security definer function
      const { data: activityData } = await supabase.rpc('get_activity_names_with_counts');

      if (activityData) {
        setAvailableActivityNames(activityData.map((d: { activity_name: string }) => d.activity_name));
      }
    };
    
    fetchDispositionsAndUsers();
  }, []);

  // Compute filtered subdispositions based on selected dispositions
  const filteredSubdispositions = useMemo(() => {
    // If no dispositions are selected, show all subdispositions
    if (dispositionFilter.length === 0) {
      return Array.from(
        new Set(dispositionData.flatMap(d => d.subdispositions || []))
      ).sort();
    }
    
    // If dispositions are selected, only show their subdispositions
    const filtered = dispositionData
      .filter(d => dispositionFilter.includes(d.disposition))
      .flatMap(d => d.subdispositions || []);
    
    return Array.from(new Set(filtered)).sort();
  }, [dispositionFilter, dispositionData]);

  // Clear subdisposition selections that are no longer valid
  useEffect(() => {
    if (subdispositionFilter.length > 0) {
      const validSubdispositions = subdispositionFilter.filter(sub => 
        filteredSubdispositions.includes(sub)
      );
      if (validSubdispositions.length !== subdispositionFilter.length) {
        setSubdispositionFilter(validSubdispositions);
      }
    }
  }, [filteredSubdispositions]);

  useEffect(() => {
    const checkPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // All authenticated users can assign records
      setCanAssign(true);
      
      // Check if special user
      if (user.email === 'jatinder.mahajan@redefine.in') {
        setCanBulkDelete(true);
        setCanBulkAssign(true);
        return;
      }
      
      // Check roles for deletion and bulk assign permission
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const roles = rolesData?.map(r => r.role) || [];
      const isAdmin = roles.some(role => 
        ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'].includes(role)
      );
      
      setCanBulkDelete(isAdmin);
      
      // Check if user has bulk assign permission (TL, Manager, Admin roles, or has subordinates)
      const canBulkAssignRoles = roles.some(role => 
        ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin', 'manager', 'team_leader'].includes(role)
      );
      
      if (canBulkAssignRoles) {
        setCanBulkAssign(true);
      } else {
        // Check if user has any subordinates (anyone reporting to them)
        const { data: subordinates, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('reports_to', user.id)
          .limit(1);
        
        if (!error && subordinates && subordinates.length > 0) {
          setCanBulkAssign(true);
        }
      }
    };
    
    checkPermissions();
  }, []);

  const checkAuthAndFetchDemandCom = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await fetchDemandCom({
      nameEmail: appliedFilters.nameEmail,
      city: appliedFilters.city,
      activityName: appliedFilters.activityName,
      assignedTo: appliedFilters.assignedTo,
      disposition: appliedFilters.disposition,
      subdisposition: appliedFilters.subdisposition
    });
  };

  const fetchDemandCom = async (filters?: {
    nameEmail?: string;
    city?: string;
    activityName?: string;
    assignedTo?: string;
    disposition?: string[];
    subdisposition?: string[];
  }) => {
    try {
      setIsLoading(true);
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let dataQuery = supabase
        .from("demandcom" as any)
        .select("*");

      let countQuery = supabase
        .from("demandcom" as any)
        .select("*", { count: "exact", head: true });

      // No default date filter - data cleanup is handled at ops level

      // Apply field-specific filters to both queries BEFORE pagination
      if (filters?.nameEmail) {
        const filterPattern = `%${filters.nameEmail}%`;
        const orFilter = `name.ilike.${filterPattern},personal_email_id.ilike.${filterPattern},generic_email_id.ilike.${filterPattern},mobile_numb.ilike.${filterPattern}`;
        dataQuery = dataQuery.or(orFilter);
        countQuery = countQuery.or(orFilter);
      }

      if (filters?.city) {
        dataQuery = dataQuery.ilike("city", `%${filters.city}%`);
        countQuery = countQuery.ilike("city", `%${filters.city}%`);
      }

      if (filters?.activityName) {
        dataQuery = dataQuery.ilike("activity_name", `%${filters.activityName}%`);
        countQuery = countQuery.ilike("activity_name", `%${filters.activityName}%`);
      }

      if (filters?.assignedTo && filters.assignedTo !== "all") {
        if (filters.assignedTo === "unassigned") {
          dataQuery = dataQuery.is("assigned_to", null);
          countQuery = countQuery.is("assigned_to", null);
        } else {
          dataQuery = dataQuery.eq("assigned_to", filters.assignedTo);
          countQuery = countQuery.eq("assigned_to", filters.assignedTo);
        }
      }

      if (filters?.disposition && filters.disposition.length > 0) {
        const hasNoDisposition = filters.disposition.includes("No Disposition");
        const realDispositions = filters.disposition.filter(d => d !== "No Disposition");
        if (hasNoDisposition && realDispositions.length > 0) {
          dataQuery = dataQuery.or(`latest_disposition.is.null,latest_disposition.in.(${realDispositions.join(",")})`);
          countQuery = countQuery.or(`latest_disposition.is.null,latest_disposition.in.(${realDispositions.join(",")})`);
        } else if (hasNoDisposition) {
          dataQuery = dataQuery.is("latest_disposition", null);
          countQuery = countQuery.is("latest_disposition", null);
        } else {
          dataQuery = dataQuery.in("latest_disposition", realDispositions);
          countQuery = countQuery.in("latest_disposition", realDispositions);
        }
      }

      if (filters?.subdisposition && filters.subdisposition.length > 0) {
        dataQuery = dataQuery.in("latest_subdisposition", filters.subdisposition);
        countQuery = countQuery.in("latest_subdisposition", filters.subdisposition);
      }

      // Now apply pagination to data query
      dataQuery = dataQuery
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

      const [dataResult, countResult] = await Promise.all([
        dataQuery,
        countQuery
      ]);

      if (dataResult.error) throw dataResult.error;
      if (countResult.error) throw countResult.error;

      // Fetch creator names and assigned user names for DemandCom records
      const demandComData = (dataResult.data || []) as any as DemandCom[];
      const creatorIds = [...new Set(demandComData.map(dc => dc.created_by).filter(Boolean))] as string[];
      const assignedIds = [...new Set(demandComData.map(dc => dc.assigned_to).filter(Boolean))] as string[];
      const allUserIds = [...new Set([...creatorIds, ...assignedIds])];
      
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .neq("email", "a@in-sync.co.in")
          .in("id", allUserIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        
        demandComData.forEach((dc: any) => {
          dc.creator_name = dc.created_by ? profilesMap.get(dc.created_by) : null;
          dc.assigned_to_name = dc.assigned_to ? profilesMap.get(dc.assigned_to) : null;
        });
      }

      setDemandComRecords(demandComData);
      setTotalCount(countResult.count || 0);
    } catch (error: any) {
      console.error("DemandCom fetch error:", error);
      
      // Better error messages
      if (error.message?.includes("timeout") || error.code === "PGRST116") {
        toast.error("Query timeout - Please apply filters to narrow your search (e.g., date range, city, disposition)");
      } else if (error.message?.includes("statement timeout")) {
        toast.error("Too many records to load. Please use filters to reduce the result set.");
      } else {
        toast.error(error.message || "Failed to load DemandCom records");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    setAppliedFilters({
      nameEmail: nameEmailFilter,
      city: cityFilter,
      activityName: activityNameFilter,
      assignedTo: assignedToFilter,
      disposition: dispositionFilter,
      subdisposition: subdispositionFilter
    });
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setNameEmailFilter("");
    setCityFilter("");
    setActivityNameFilter("");
    setAssignedToFilter("");
    setDispositionFilter([]);
    setSubdispositionFilter([]);
    
    setAppliedFilters({
      nameEmail: "",
      city: "",
      activityName: "",
      assignedTo: "",
      disposition: [],
      subdisposition: []
    });
    
    setCurrentPage(1);
    
    toast.success("Filters cleared");
  };

  const filteredDemandCom = demandComRecords;


  const handleSelectAll = () => {
    if (selectedIds.size === filteredDemandCom.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDemandCom.map(r => r.id)));
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
      setIsDeleting(true);
      
      const ids = Array.from(selectedIds);
      let totalDeleted = 0;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.rpc('bulk_delete_demandcom_batch', {
          p_record_ids: ids,
          p_batch_size: 500,
          p_offset: offset,
        });
        if (error) throw error;
        const batch = data?.[0] || { deleted_count: 0, has_more: false, next_offset: 0 };
        totalDeleted += Number(batch.deleted_count);
        hasMore = batch.has_more;
        offset = Number(batch.next_offset);
      }

      toast.success(`Successfully deleted ${totalDeleted} record(s)`);
      
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      await checkAuthAndFetchDemandCom();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete records');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'name',
      'mobile_numb',
      'mobile2',
      'official',
      'personal_email_id',
      'generic_email_id',
      'linkedin',
      'company_linkedin_url',
      'associated_member_linkedin',
      'designation',
      'deppt',
      'job_level_updated',
      'company_name',
      'industry_type',
      'sub_industry',
      'website',
      'emp_size',
      'turnover',
      'turnover_link',
      'erp_name',
      'erp_vendor',
      'address',
      'location',
      'head_office_location',
      'city',
      'state',
      'zone',
      'tier',
      'pincode',
      'activity_name',
      'source_1',
      'extra',
      'extra_1',
      'extra_2',
      'assigned_to'
    ];
    
    const csvContent = headers.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'demandcom_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/5 via-success-green/5 to-accent-purple/5">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">DemandCom</h2>
            <p className="text-muted-foreground">
              Manage your professional database
            </p>
          </div>
          <div className="flex gap-2">
            {canAssign && selectedIds.size > 0 && (
              <Button
                onClick={() => setShowAssignmentDialog(true)}
                variant="secondary"
                size="icon"
                className="shadow-elegant relative"
                title="Assign selected records"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <line x1="19" y1="8" x2="19" y2="14"></line>
                  <line x1="22" y1="11" x2="16" y2="11"></line>
                </svg>
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {selectedIds.size}
                </Badge>
              </Button>
            )}
            {canBulkAssign && totalCount > 0 && (
              <Button
                onClick={() => setShowBulkAssignDialog(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-elegant gap-2"
                title="Bulk Select & Assign - Select by All, First N, Page Range, or Record Range"
              >
                <Users className="h-4 w-4" />
                <span>Bulk Assign</span>
              </Button>
            )}
            <Button
              onClick={() => setShowBulkEmail(true)}
              variant="outline"
              size="icon"
              className="shadow-elegant"
              title="Send email to filtered contacts"
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setShowExportDialog(true)}
              variant="outline"
              size="icon"
              className="shadow-elegant"
              title="Export filtered data"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => setShowBulkImport(true)}
              variant="outline"
              size="icon"
              className="shadow-elegant"
              title="Bulk Upload CSV"
            >
              <Upload className="h-4 w-4" />
            </Button>
            {canBulkDelete && selectedIds.size > 0 && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="destructive"
                size="icon"
                className="shadow-elegant relative"
                title="Delete selected records"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground">
                  {selectedIds.size}
                </Badge>
              </Button>
            )}
            {canBulkDelete && (
              <Button
                onClick={() => setShowDeleteActivityDialog(true)}
                variant="outline"
                size="icon"
                className="shadow-elegant border-destructive/50 text-destructive hover:bg-destructive/10"
                title="Delete all records for an activity"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button 
              onClick={() => navigate("/demandcom/new")} 
              size="icon"
              className="shadow-elegant"
              title="Add Participant"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 mb-6">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <Input
                    type="search"
                    placeholder="Name, Email or Mobile"
                    value={nameEmailFilter}
                    onChange={(e) => setNameEmailFilter(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Input
                    type="search"
                    placeholder="City"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Popover open={activityNameOpen} onOpenChange={setActivityNameOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={activityNameOpen}
                        className="flex-1 justify-between font-normal"
                      >
                        {activityNameFilter || "Activity Name"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0">
                      <Command>
                        <CommandInput placeholder="Search activity..." />
                        <CommandList>
                          <CommandEmpty>No activity found.</CommandEmpty>
                          <CommandGroup>
                            {activityNameFilter && (
                              <CommandItem
                                onSelect={() => {
                                  setActivityNameFilter("");
                                  setActivityNameOpen(false);
                                }}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Clear
                              </CommandItem>
                            )}
                            {availableActivityNames.map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={() => {
                                  setActivityNameFilter(name);
                                  setActivityNameOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    activityNameFilter === name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex gap-2 items-center">
                  <Select
                    value={assignedToFilter}
                    onValueChange={setAssignedToFilter}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Assigned To" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {availableUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || 'Unnamed User'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 items-center">
                  <MultiSelectFilter
                    options={availableDispositions}
                    selected={dispositionFilter}
                    onChange={setDispositionFilter}
                    placeholder="Search dispositions..."
                    triggerLabel="Disposition"
                  />
                  <MultiSelectFilter
                    options={filteredSubdispositions}
                    selected={subdispositionFilter}
                    onChange={setSubdispositionFilter}
                    placeholder="Search subdispositions..."
                    triggerLabel="Subdisposition"
                  />
                  <div className="flex gap-2 ml-auto">
                    <Button onClick={handleSearch} size="icon" className="h-10 w-10 shrink-0">
                      <Filter className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={clearAllFilters} 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 shrink-0"
                      title="Clear all filters"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        <Card>
          <CardHeader>
            <CardTitle>DemandCom Database</CardTitle>
              <CardDescription>
                {appliedFilters.nameEmail || appliedFilters.city || appliedFilters.activityName || appliedFilters.assignedTo || appliedFilters.disposition.length > 0 || appliedFilters.subdisposition.length > 0
                  ? `Filtered: ${totalCount} results • Showing page ${currentPage} of ${Math.ceil(totalCount / itemsPerPage)}`
                  : `Total: ${totalCount} records • Showing page ${currentPage} of ${Math.ceil(totalCount / itemsPerPage)}`
                }
              </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="list" className="w-full">
              <TabsList>
                <TabsTrigger value="list">
                  Participants ({totalCount})
                </TabsTrigger>
                <TabsTrigger value="call-history">
                  Call History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredDemandCom.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No records found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canAssign && (
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === filteredDemandCom.length && filteredDemandCom.length > 0}
                            onChange={handleSelectAll}
                            className="cursor-pointer h-4 w-4"
                            aria-label="Select all records"
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Latest Disposition</TableHead>
                      <TableHead>Latest Sub-Disposition</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDemandCom.map((demandCom) => (
                      <TableRow 
                        key={demandCom.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(demandCom.id) ? 'bg-primary/5' : ''}`}
                        onClick={() => navigate(`/demandcom/${demandCom.id}`)}
                      >
                        {canAssign && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(demandCom.id)}
                              onChange={() => handleSelectOne(demandCom.id)}
                              className="cursor-pointer h-4 w-4"
                              aria-label={`Select ${demandCom.name}`}
                            />
                          </TableCell>
                        )}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <CallButton
                              phoneNumber={demandCom.mobile_numb}
                              demandcomId={demandCom.id}
                              demandcomName={demandCom.name}
                              demandcomData={demandCom}
                              variant="ghost"
                              size="icon"
                              showLabel={false}
                            />
                            <VapiCallButton
                              phoneNumber={demandCom.mobile_numb}
                              contactName={demandCom.name}
                              demandcomId={demandCom.id}
                              variant="ghost"
                              size="icon"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setWhatsappContact(demandCom)}
                              title="WhatsApp"
                            >
                              <MessageSquare className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEmailContact(demandCom)}
                              title="Send Email"
                            >
                              <Mail className="h-4 w-4 text-blue-500" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{demandCom.name}</TableCell>
                        <TableCell>{demandCom.mobile_numb || '-'}</TableCell>
                        <TableCell>{demandCom.designation || '-'}</TableCell>
                        <TableCell>{demandCom.company_name || '-'}</TableCell>
                        <TableCell>{demandCom.city || '-'}</TableCell>
                        <TableCell>{demandCom.latest_disposition || '-'}</TableCell>
                        <TableCell>{demandCom.latest_subdisposition || '-'}</TableCell>
                        <TableCell>{demandCom.assigned_to_name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalCount / itemsPerPage)}
                    totalItems={totalCount}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(value) => {
                      setItemsPerPage(value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </>
            )}
              </TabsContent>

              <TabsContent value="call-history" className="mt-4">
                <CallHistory />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        tableName="demandcom"
        tableLabel="DemandCom"
        requiredColumns={['name', 'mobile_numb']}
        templateColumns={[
          'name',
          'mobile_numb',
          'assigned_to',
          'mobile2',
          'official',
          'personal_email_id',
          'generic_email_id',
          'linkedin',
          'designation',
          'deppt',
          'job_level_updated',
          'company_name',
          'industry_type',
          'sub_industry',
          'website',
          'emp_size',
          'turnover',
          'erp_name',
          'erp_vendor',
          'address',
          'location',
          'city',
          'state',
          'zone',
          'tier',
          'pincode',
          'activity_name',
          'country',
          'source',
          'source_1',
          'extra',
          'extra_1',
          'extra_2',
          'user_id',
          'salutation',
          'turnover_link',
          'company_linkedin_url',
          'associated_member_linkedin',
          'latest_disposition',
          'latest_subdisposition',
          'updated_at',
          'assigned_by'
        ]}
        onImportComplete={() => {
          checkAuthAndFetchDemandCom();
          setShowBulkImport(false);
        }}
      />

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Delete Selected Records</DialogTitle>
            <DialogDescription>
              You are about to delete <strong>{selectedIds.size}</strong> record(s). This will also delete:
              <ul className="list-disc ml-6 mt-2">
                <li>All call logs for these participants</li>
                <li>All AI recommendations</li>
                <li>Pipeline history</li>
                <li>Engagement summaries</li>
              </ul>
              <br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                `Delete ${selectedIds.size} Record(s)`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DemandComAssignmentDialog
        open={showAssignmentDialog}
        onOpenChange={setShowAssignmentDialog}
        selectedIds={Array.from(selectedIds)}
        onAssignmentComplete={() => {
          checkAuthAndFetchDemandCom();
          setSelectedIds(new Set());
        }}
      />

      <BulkSelectAssignDialog
        open={showBulkAssignDialog}
        onOpenChange={setShowBulkAssignDialog}
        totalCount={totalCount}
        itemsPerPage={itemsPerPage}
        appliedFilters={appliedFilters}
        onAssignmentComplete={() => {
          checkAuthAndFetchDemandCom();
        }}
      />

      <ClientSideExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        tableName="demandcom"
        filenamePrefix="demandcom-export"
        filters={appliedFilters}
        filteredCount={totalCount}
      />

      <DeleteActivityDialog
        open={showDeleteActivityDialog}
        onOpenChange={setShowDeleteActivityDialog}
        onSuccess={checkAuthAndFetchDemandCom}
      />

      {/* WhatsApp Conversation Dialog */}
      <Dialog open={!!whatsappContact} onOpenChange={(open) => { if (!open) setWhatsappContact(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          {whatsappContact && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                  WhatsApp — {whatsappContact.name}
                </DialogTitle>
                <DialogDescription>{whatsappContact.mobile_numb}</DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0">
                <WhatsAppHistory
                  demandcomId={whatsappContact.id}
                  phoneNumber={whatsappContact.mobile_numb}
                  maxHeight="400px"
                />
              </div>
              <div className="flex justify-end pt-2 border-t">
                <Button
                  size="sm"
                  onClick={() => {
                    const contact = whatsappContact;
                    setWhatsappContact(null);
                    setTimeout(() => {
                      setWhatsappContact(contact);
                      setShowWhatsappSend(true);
                    }, 150);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Send Dialog */}
      {whatsappContact && (
        <SendWhatsAppDialog
          open={showWhatsappSend}
          onOpenChange={(open) => {
            setShowWhatsappSend(open);
            if (!open) setWhatsappContact(null);
          }}
          demandcomId={whatsappContact.id}
          contactName={whatsappContact.name}
          phoneNumber={whatsappContact.mobile_numb}
        />
      )}

      {/* Individual Email Dialog */}
      {emailContact && (
        <SendEmailDialog
          open={!!emailContact}
          onOpenChange={(open) => { if (!open) setEmailContact(null); }}
          demandcomId={emailContact.id}
          contactName={emailContact.name}
          contactEmail={emailContact.personal_email_id || emailContact.generic_email_id || undefined}
        />
      )}

      {/* Bulk Email Dialog */}
      <SendEmailDialog
        open={showBulkEmail}
        onOpenChange={setShowBulkEmail}
        isBulk
        appliedFilters={appliedFilters}
        totalCount={totalCount}
      />

    </div>
  );
}
