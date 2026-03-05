import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Trash2, Eye, EyeOff, RefreshCw, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { WebhookFieldMapper, type FieldMapping } from "@/components/WebhookFieldMapper";

interface WebhookConnector {
  id: string;
  name: string;
  connector_type: string;
  webhook_token: string;
  is_active: boolean;
  target_table: string;
  rate_limit_per_minute: number;
  webhook_config: {
    source_name?: string;
    field_mappings?: FieldMapping[];
  };
  created_at: string;
}

export default function Webhooks() {
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<WebhookConnector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConnector | null>(null);
  const [viewingWebhook, setViewingWebhook] = useState<WebhookConnector | null>(null);
  const [showTokens, setShowTokens] = useState<Set<string>>(new Set());

  // Form state
  const [name, setName] = useState("");
  const [connectorType, setConnectorType] = useState("general");
  const [targetTable, setTargetTable] = useState("demandcom");
  const [rateLimit, setRateLimit] = useState("60");
  const [sourceName, setSourceName] = useState("");
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  useEffect(() => {
    checkAuthAndFetchWebhooks();
  }, []);

  const checkAuthAndFetchWebhooks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchWebhooks();
  };

  const fetchWebhooks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_connectors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWebhooks((data || []) as WebhookConnector[]);
    } catch (error: any) {
      toast.error("Failed to load webhooks");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const createWebhook = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!name.trim()) {
        toast.error("Please enter a webhook name");
        return;
      }

      if (fieldMappings.length === 0) {
        toast.error("Please add at least one field mapping");
        return;
      }

      // Validate all mappings have source fields
      const invalidMappings = fieldMappings.filter(m => !m.sourceField.trim());
      if (invalidMappings.length > 0) {
        toast.error("All mappings must have a source field");
        return;
      }

      // Generate unique webhook token
      const webhookToken = crypto.randomUUID();

      const { error } = await supabase
        .from("webhook_connectors")
        .insert([{
          name,
          connector_type: connectorType,
          webhook_token: webhookToken,
          target_table: targetTable,
          rate_limit_per_minute: parseInt(rateLimit),
          webhook_config: {
            source_name: sourceName || name,
            field_mappings: fieldMappings
          } as any,
          created_by: user.id,
          is_active: true
        }]);

      if (error) throw error;

      toast.success("Webhook connector created successfully");
      setIsDialogOpen(false);
      resetForm();
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error.message || "Failed to create webhook");
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook connector?")) return;

    try {
      const { error } = await supabase
        .from("webhook_connectors")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Webhook deleted");
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete webhook");
    }
  };

  const toggleWebhookStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("webhook_connectors")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Webhook ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update webhook");
    }
  };

  const copyWebhookUrl = (token: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-receiver/${token}`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
  };

  const toggleTokenVisibility = (id: string) => {
    setShowTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const openEditDialog = (webhook: WebhookConnector) => {
    setEditingWebhook(webhook);
    setName(webhook.name);
    setConnectorType(webhook.connector_type);
    setTargetTable(webhook.target_table);
    setRateLimit(webhook.rate_limit_per_minute.toString());
    setSourceName(webhook.webhook_config?.source_name || "");
    setFieldMappings(webhook.webhook_config?.field_mappings || []);
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (webhook: WebhookConnector) => {
    setViewingWebhook(webhook);
    setIsViewDialogOpen(true);
  };

  const updateWebhook = async () => {
    if (!editingWebhook) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!name.trim()) {
        toast.error("Please enter a webhook name");
        return;
      }

      if (fieldMappings.length === 0) {
        toast.error("Please add at least one field mapping");
        return;
      }

      // Validate all mappings have source fields
      const invalidMappings = fieldMappings.filter(m => !m.sourceField.trim());
      if (invalidMappings.length > 0) {
        toast.error("All mappings must have a source field");
        return;
      }

      const { error } = await supabase
        .from("webhook_connectors")
        .update({
          name,
          connector_type: connectorType,
          target_table: targetTable,
          rate_limit_per_minute: parseInt(rateLimit),
          webhook_config: {
            source_name: sourceName || name,
            field_mappings: fieldMappings
          } as any
        })
        .eq("id", editingWebhook.id);

      if (error) throw error;

      toast.success("Webhook updated successfully");
      setIsEditDialogOpen(false);
      setEditingWebhook(null);
      resetForm();
      fetchWebhooks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update webhook");
    }
  };

  const resetForm = () => {
    setName("");
    setConnectorType("general");
    setTargetTable("demandcom");
    setRateLimit("60");
    setSourceName("");
    setFieldMappings([]);
  };

  const getWebhookUrl = (token: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/webhook-receiver/${token}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Webhook Connectors</h1>
            <p className="text-muted-foreground">
              Manage external webhook integrations
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
            >
              Dashboard
            </Button>
            <Button
              onClick={fetchWebhooks}
              variant="outline"
              size="icon"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Webhook Connector</DialogTitle>
                  <DialogDescription>
                    Configure a new webhook endpoint to receive data from external sources
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      placeholder="My Webhook Connector"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Connector Type</Label>
                    <Select value={connectorType} onValueChange={setConnectorType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Target Table</Label>
                    <Select value={targetTable} onValueChange={setTargetTable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="demandcom">Participants</SelectItem>
                      <SelectItem value="projects">Projects</SelectItem>
                      <SelectItem value="master">Master</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Which table should the webhook data be inserted into?
                    </p>
                  </div>

                  <div>
                    <Label>Rate Limit (requests/minute)</Label>
                    <Input
                      type="number"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Source Name (optional)</Label>
                    <Input
                      placeholder="e.g., LinkedIn, Indeed, etc."
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                    />
                  </div>

                  <WebhookFieldMapper
                    mappings={fieldMappings}
                    onChange={setFieldMappings}
                    targetTable={targetTable}
                  />

                  <Button onClick={createWebhook} className="w-full">
                    Create Webhook
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                setEditingWebhook(null);
                resetForm();
              }
            }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Webhook Connector</DialogTitle>
                  <DialogDescription>
                    Update webhook endpoint configuration
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      placeholder="My Webhook Connector"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Connector Type</Label>
                    <Select value={connectorType} onValueChange={setConnectorType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Target Table</Label>
                    <Select value={targetTable} onValueChange={setTargetTable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                    <SelectItem value="demandcom">Participants</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                       </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Which table should the webhook data be inserted into?
                    </p>
                  </div>

                  <div>
                    <Label>Rate Limit (requests/minute)</Label>
                    <Input
                      type="number"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Source Name (optional)</Label>
                    <Input
                      placeholder="e.g., LinkedIn, Indeed, etc."
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                    />
                  </div>

                  <WebhookFieldMapper
                    mappings={fieldMappings}
                    onChange={setFieldMappings}
                    targetTable={targetTable}
                  />

                  <Button onClick={updateWebhook} className="w-full">
                    Update Webhook
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Webhooks Table */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Connectors</CardTitle>
            <CardDescription>
              {webhooks.length} connector{webhooks.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No webhook connectors yet. Create one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Webhook URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {webhook.connector_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>
                          {webhook.target_table}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-md">
                          <code className="text-xs bg-muted p-1 rounded flex-1 truncate">
                            {showTokens.has(webhook.id) 
                              ? getWebhookUrl(webhook.webhook_token)
                              : '••••••••••••••••••••••••'}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTokenVisibility(webhook.id)}
                          >
                            {showTokens.has(webhook.id) ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyWebhookUrl(webhook.webhook_token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={webhook.is_active ? "default" : "secondary"}>
                          {webhook.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewDialog(webhook)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(webhook)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleWebhookStatus(webhook.id, webhook.is_active)}
                          >
                            {webhook.is_active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteWebhook(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View Webhook Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) setViewingWebhook(null);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{viewingWebhook?.name}</DialogTitle>
              <DialogDescription>
                Webhook configuration and endpoint details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Webhook Endpoint Section */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Webhook Endpoint</h3>
                <p className="text-sm text-muted-foreground">
                  Send POST requests to this URL to create {viewingWebhook?.target_table === 'demandcom' ? 'participants' : viewingWebhook?.target_table}
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="text-sm flex-1 break-all">
                    {viewingWebhook && getWebhookUrl(viewingWebhook.webhook_token)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => viewingWebhook && copyWebhookUrl(viewingWebhook.webhook_token)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Configuration Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-medium">{viewingWebhook?.connector_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Target Table</Label>
                    <p className="font-medium">{viewingWebhook?.target_table}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Rate Limit</Label>
                    <p className="font-medium">{viewingWebhook?.rate_limit_per_minute} requests/min</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant={viewingWebhook?.is_active ? "default" : "secondary"}>
                      {viewingWebhook?.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Field Mappings */}
              {viewingWebhook?.webhook_config?.field_mappings && viewingWebhook.webhook_config.field_mappings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Field Mappings</h3>
                  <div className="space-y-2">
                    {viewingWebhook.webhook_config.field_mappings.map((mapping, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                        <code className="flex-1">{mapping.sourceField}</code>
                        <span>→</span>
                        <code className="flex-1">{mapping.targetField}</code>
                        {mapping.transform && (
                          <>
                            <span className="text-muted-foreground">|</span>
                            <Badge variant="outline" className="text-xs">{mapping.transform}</Badge>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Documentation Card */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Create a Webhook Connector</h3>
              <p className="text-sm text-muted-foreground">
                Click "New Webhook" and configure your connector with a name, target table, and optional field mappings.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Copy the Webhook URL</h3>
              <p className="text-sm text-muted-foreground">
                Each connector gets a unique URL. Copy it and configure it in your external service (e.g., LinkedIn, Indeed, etc.).
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Configure Field Mappings</h3>
              <p className="text-sm text-muted-foreground">
                Map incoming field names from the external service to your database field names. Supports nested JSON paths.
              </p>
              <div className="space-y-2 mt-2">
                <p className="text-xs font-medium">Flat fields:</p>
                <pre className="bg-muted p-2 rounded text-xs">
{`email → email
firstName → first_name
phone → phone`}
                </pre>
                <p className="text-xs font-medium mt-3">Nested JSON paths:</p>
                <pre className="bg-muted p-2 rounded text-xs">
{`user.email → email
contact.firstName → first_name
user.address.city → location_city
data[0].name → first_name`}
                </pre>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">4. Test the Webhook</h3>
              <p className="text-sm text-muted-foreground">
                Send a test payload to your webhook URL and check the webhook logs to verify it's working correctly.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}