import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Mail, MessageSquare, LogOut, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import rmplLogo from "@/assets/rmpl-logo.png";
import { useAuthCheck } from "@/hooks/useAuthCheck";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
}

interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  category: string | null;
  is_active: boolean;
  character_count: number | null;
  created_at: string;
}

export default function Templates() {
  const navigate = useNavigate();
  useAuthCheck();

  const {
    data: emailTemplates,
    totalCount: emailCount,
    totalPages: emailTotalPages,
    currentPage: emailPage,
    itemsPerPage: emailPerPage,
    isLoading: emailLoading,
    handlePageChange: handleEmailPageChange,
    handleItemsPerPageChange: handleEmailPerPageChange,
    refetch: refetchEmail,
  } = usePaginatedQuery<EmailTemplate>({
    queryKey: ["email_templates"],
    queryFn: async (from, to) => {
      const { data, error, count } = await supabase
        .from("email_templates")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data, count, error };
    },
  });

  const {
    data: smsTemplates,
    totalCount: smsCount,
    totalPages: smsTotalPages,
    currentPage: smsPage,
    itemsPerPage: smsPerPage,
    isLoading: smsLoading,
    handlePageChange: handleSmsPageChange,
    handleItemsPerPageChange: handleSmsPerPageChange,
    refetch: refetchSms,
  } = usePaginatedQuery<SMSTemplate>({
    queryKey: ["sms_templates"],
    queryFn: async (from, to) => {
      const { data, error, count } = await supabase
        .from("sms_templates")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data, count, error };
    },
  });

  const handleDeleteEmailTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;

      toast.success("Email template deleted");
      refetchEmail();
    } catch (error: any) {
      toast.error("Failed to delete email template");
    }
  };

  const handleDeleteSMSTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase.from("sms_templates").delete().eq("id", id);
      if (error) throw error;

      toast.success("SMS template deleted");
      refetchSms();
    } catch (error: any) {
      toast.error("Failed to delete SMS template");
    }
  };

  const emailColumns: DataTableColumn<EmailTemplate>[] = [
    {
      header: "Name",
      cell: (template) => <span className="font-medium">{template.name}</span>,
    },
    {
      header: "Subject",
      accessorKey: "subject",
    },
    {
      header: "Category",
      cell: (template) => template.category || "—",
    },
    {
      header: "Version",
      cell: (template) => `v${template.version}`,
    },
    {
      header: "Status",
      cell: (template) => (
        <Badge variant={template.is_active ? "default" : "outline"}>
          {template.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const smsColumns: DataTableColumn<SMSTemplate>[] = [
    {
      header: "Name",
      cell: (template) => <span className="font-medium">{template.name}</span>,
    },
    {
      header: "Message Preview",
      cell: (template) => <span className="max-w-xs truncate">{template.body}</span>,
    },
    {
      header: "Category",
      cell: (template) => template.category || "—",
    },
    {
      header: "Characters",
      cell: (template) => template.character_count || template.body.length,
    },
    {
      header: "Status",
      cell: (template) => (
        <Badge variant={template.is_active ? "default" : "outline"}>
          {template.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/5 via-healthcare-teal/5 to-accent-purple/5">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={rmplLogo} alt="RMPL" className="h-12 w-auto" />
            <div>
              <h1 className="font-bold text-xl">RMPL OPM</h1>
              <p className="text-sm text-muted-foreground">Template Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Templates</h2>
          <p className="text-muted-foreground">
            Create and manage email and SMS templates for your campaigns
          </p>
        </div>

        <Tabs defaultValue="email" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Templates
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Templates
            </TabsTrigger>
          </TabsList>

          {/* Email Templates Tab */}
          <TabsContent value="email">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Email Templates ({emailTemplates.length})</CardTitle>
                  <CardDescription>
                    Design beautiful email templates with merge tags
                  </CardDescription>
                </div>
                <Button onClick={() => navigate("/templates/email/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Email Template
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={emailTemplates}
                  columns={emailColumns}
                  isLoading={emailLoading}
                  getRowKey={(template) => template.id}
                  emptyState={{
                    icon: Mail,
                    title: "No email templates found",
                    description: "Get started by creating your first email template",
                    actionLabel: "New Email Template",
                    onAction: () => navigate("/templates/email/new"),
                  }}
                  pagination={{
                    currentPage: emailPage,
                    totalPages: emailTotalPages,
                    totalItems: emailCount,
                    itemsPerPage: emailPerPage,
                    onPageChange: handleEmailPageChange,
                    onItemsPerPageChange: handleEmailPerPageChange,
                  }}
                  actions={(template) => (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/templates/email/${template.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEmailTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS Templates Tab */}
          <TabsContent value="sms">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>SMS Templates ({smsTemplates.length})</CardTitle>
                  <CardDescription>
                    Create concise SMS templates with merge tags
                  </CardDescription>
                </div>
                <Button onClick={() => navigate("/templates/sms/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New SMS Template
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={smsTemplates}
                  columns={smsColumns}
                  isLoading={smsLoading}
                  getRowKey={(template) => template.id}
                  emptyState={{
                    icon: MessageSquare,
                    title: "No SMS templates found",
                    description: "Get started by creating your first SMS template",
                    actionLabel: "New SMS Template",
                    onAction: () => navigate("/templates/sms/new"),
                  }}
                  pagination={{
                    currentPage: smsPage,
                    totalPages: smsTotalPages,
                    totalItems: smsCount,
                    itemsPerPage: smsPerPage,
                    onPageChange: handleSmsPageChange,
                    onItemsPerPageChange: handleSmsPerPageChange,
                  }}
                  actions={(template) => (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/templates/sms/${template.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSMSTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}