import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  FileText, Search, CheckCircle, Clock, Loader2, Download, 
  User, Filter, ChevronDown, ChevronRight, Eye
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const DOCUMENT_TYPES = [
  { value: "aadhar", label: "Aadhar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "passport", label: "Passport" },
  { value: "education_certificate", label: "Education Certificate" },
  { value: "experience_letter", label: "Experience Letter" },
  { value: "offer_letter", label: "Offer Letter (Previous)" },
  { value: "relieving_letter", label: "Relieving Letter" },
  { value: "payslip", label: "Last 3 Payslips" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "photo", label: "Passport Photo" },
  { value: "address_proof", label: "Address Proof" },
  { value: "other", label: "Other Document" },
];

interface EmployeeWithDocs {
  id: string;
  full_name: string;
  email: string;
  documents: any[];
}

export default function HRDocuments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["all-employee-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(doc => ({
        ...doc,
        user: profileMap.get(doc.user_id),
      }));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("employee_documents")
        .update({
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", docId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-employee-documents"] });
      toast.success("Document verified successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to verify document: " + error.message);
    },
  });

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error("Failed to download document: " + error.message);
    }
  };

  const handlePreview = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-documents")
        .createSignedUrl(doc.file_path, 300);

      if (error) throw error;

      setPreviewDoc({ ...doc, previewUrl: data.signedUrl });
    } catch (error: any) {
      toast.error("Failed to preview document: " + error.message);
    }
  };

  const getDocumentTypeLabel = (value: string) => {
    return DOCUMENT_TYPES.find(t => t.value === value)?.label || value;
  };

  const toggleUser = (userId: string) => {
    const newSet = new Set(expandedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setExpandedUsers(newSet);
  };

  // Group documents by user
  const groupedByUser = documents?.reduce((acc, doc) => {
    const userId = doc.user?.id;
    if (!userId) return acc;
    
    if (!acc[userId]) {
      acc[userId] = {
        id: userId,
        full_name: doc.user.full_name || doc.user.email,
        email: doc.user.email,
        documents: [],
      };
    }
    acc[userId].documents.push(doc);
    return acc;
  }, {} as Record<string, EmployeeWithDocs>) || {};

  // Filter users and documents
  const filteredUsers = Object.values(groupedByUser).filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Filter documents within user
    user.documents = user.documents.filter((doc: any) => {
      const matchesType = filterType === "all" || doc.document_type === filterType;
      const matchesStatus = 
        filterStatus === "all" ||
        (filterStatus === "verified" && doc.verified_at) ||
        (filterStatus === "pending" && !doc.verified_at);
      return matchesType && matchesStatus;
    });

    return user.documents.length > 0;
  });

  // Calculate stats
  const stats = {
    total: documents?.length || 0,
    verified: documents?.filter(d => d.verified_at)?.length || 0,
    pending: documents?.filter(d => !d.verified_at)?.length || 0,
    employees: Object.keys(groupedByUser).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Documents</h1>
          <p className="text-muted-foreground">View and verify employee documents</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.employees}</div>
            <p className="text-sm text-muted-foreground">Employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
            <p className="text-sm text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Pending Verification</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCUMENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents by Employee */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleUser(user.id)}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedUsers.has(user.id) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <User className="h-5 w-5" />
                    <div>
                      <span className="text-lg">{user.full_name}</span>
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({user.email})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {user.documents.length} document{user.documents.length !== 1 ? "s" : ""}
                    </Badge>
                    {user.documents.some((d: any) => !d.verified_at) && (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {user.documents.filter((d: any) => !d.verified_at).length} pending
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              {expandedUsers.has(user.id) && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {user.documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-6 w-6 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {getDocumentTypeLabel(doc.document_type)}
                              </span>
                              {doc.verified_at ? (
                                <Badge variant="default" className="shrink-0">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="shrink-0">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.document_name} • Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(doc);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(doc.file_path, doc.document_name);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {!doc.verified_at && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                verifyMutation.mutate(doc.id);
                              }}
                              disabled={verifyMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Verify
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No documents found</p>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewDoc?.document_name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewDoc?.previewUrl && (
              <div className="flex flex-col items-center gap-4">
                {previewDoc.document_name.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={previewDoc.previewUrl}
                    className="w-full h-[60vh] border rounded"
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={previewDoc.previewUrl}
                    alt="Document Preview"
                    className="max-w-full max-h-[60vh] object-contain rounded"
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(previewDoc.file_path, previewDoc.document_name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  {!previewDoc.verified_at && (
                    <Button
                      variant="default"
                      onClick={() => {
                        verifyMutation.mutate(previewDoc.id);
                        setPreviewDoc(null);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify Document
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
