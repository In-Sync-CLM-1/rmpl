import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ClientFormData {
  company_name: string;
  company_linkedin_page: string;
  industry: string;
  website: string;
}

interface Branch {
  id?: string;
  branch_name: string;
  branch_address: string;
  gst_number: string;
  is_primary: boolean;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

const ClientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!id;
  const [managedBy, setManagedBy] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [branches, setBranches] = useState<Branch[]>([
    { branch_name: "Head Office", branch_address: "", gst_number: "", is_primary: true },
  ]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormData>();

  // Fetch all active users for Assigned To dropdown
  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return (data || []).filter((u: any) => u.id && u.full_name) as ProfileOption[];
    },
  });

  // Fetch CSBD team members for the Managed By dropdown
  const { data: csbdMembers = [] } = useQuery({
    queryKey: ["csbd-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, full_name)")
        .eq("role", "csbd");
      if (error) throw error;
      return (data || [])
        .map((r: any) => ({ id: r.profiles?.id, full_name: r.profiles?.full_name }))
        .filter((m: any) => m.id && m.full_name)
        .sort((a: ProfileOption, b: ProfileOption) => a.full_name.localeCompare(b.full_name)) as ProfileOption[];
    },
  });

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditMode,
  });

  // Fetch branches for this client
  const { data: existingBranches } = useQuery({
    queryKey: ["client-branches", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("client_branches")
        .select("*")
        .eq("client_id", id)
        .order("is_primary", { ascending: false })
        .order("branch_name");
      if (error) throw error;
      return data || [];
    },
    enabled: isEditMode,
  });

  useEffect(() => {
    if (client) {
      reset({
        company_name: client.company_name,
        company_linkedin_page: client.company_linkedin_page || "",
        industry: client.industry || "",
        website: client.website || "",
      });
      setManagedBy(client.managed_by || "");
      setAssignedTo(client.assigned_to || "");
    }
  }, [client, reset]);

  useEffect(() => {
    if (existingBranches && existingBranches.length > 0) {
      setBranches(existingBranches.map((b: any) => ({
        id: b.id,
        branch_name: b.branch_name,
        branch_address: b.branch_address || "",
        gst_number: b.gst_number || "",
        is_primary: b.is_primary || false,
      })));
    }
  }, [existingBranches]);

  const addBranch = () => {
    setBranches([...branches, { branch_name: "", branch_address: "", gst_number: "", is_primary: false }]);
  };

  const removeBranch = (index: number) => {
    if (branches.length <= 1) return;
    const newBranches = branches.filter((_, i) => i !== index);
    // If we removed the primary, make the first one primary
    if (branches[index].is_primary && newBranches.length > 0) {
      newBranches[0].is_primary = true;
    }
    setBranches(newBranches);
  };

  const updateBranch = (index: number, field: keyof Branch, value: string | boolean) => {
    const newBranches = [...branches];
    if (field === "is_primary" && value === true) {
      // Only one primary
      newBranches.forEach((b, i) => { b.is_primary = i === index; });
    } else {
      (newBranches[index] as any)[field] = value;
    }
    setBranches(newBranches);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (data.company_linkedin_page && !/^https?:\/\/.+/.test(data.company_linkedin_page)) {
        throw new Error("Company LinkedIn Page must be a valid URL (starting with http:// or https://)");
      }

      if (data.website && !/^https?:\/\/.+/.test(data.website)) {
        throw new Error("Website must be a valid URL (starting with http:// or https://)");
      }

      // Validate at least one branch has a name
      const validBranches = branches.filter(b => b.branch_name.trim());
      if (validBranches.length === 0) {
        throw new Error("At least one branch with a name is required");
      }

      const clientData = {
        company_name: data.company_name,
        company_linkedin_page: data.company_linkedin_page || null,
        industry: data.industry || null,
        website: data.website || null,
        managed_by: managedBy || null,
        assigned_to: assignedTo || null,
        // Keep legacy fields in sync with primary branch for backward compatibility
        branch: validBranches.find(b => b.is_primary)?.branch_name || validBranches[0].branch_name || null,
        official_address: validBranches.find(b => b.is_primary)?.branch_address || validBranches[0].branch_address || null,
        gst_number: validBranches.find(b => b.is_primary)?.gst_number || validBranches[0].gst_number || null,
      };

      let clientId = id;

      if (isEditMode) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data: newClient, error } = await supabase
          .from("clients")
          .insert([{ ...clientData, created_by: user.id }])
          .select("id")
          .single();
        if (error) throw error;
        clientId = newClient.id;
      }

      // Save branches: delete existing and re-insert
      if (clientId) {
        await supabase.from("client_branches").delete().eq("client_id", clientId);

        const branchData = validBranches.map(b => ({
          client_id: clientId!,
          branch_name: b.branch_name.trim(),
          branch_address: b.branch_address.trim() || null,
          gst_number: b.gst_number.trim() || null,
          is_primary: b.is_primary,
        }));

        if (branchData.length > 0) {
          const { error: branchError } = await supabase
            .from("client_branches")
            .insert(branchData);
          if (branchError) throw branchError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-branches"] });
      toast({
        title: "Success",
        description: `Client ${isEditMode ? "updated" : "created"} successfully`,
      });
      navigate("/clients");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">{isEditMode ? "Edit Client" : "Add Client"}</h1>
      </div>

      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  {...register("company_name", { required: "Company name is required" })}
                  placeholder="Enter company name"
                />
                {errors.company_name && (
                  <p className="text-sm text-destructive mt-1">{errors.company_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  {...register("industry")}
                  placeholder="e.g. IT, Manufacturing, Healthcare"
                />
              </div>

              <div>
                <Label htmlFor="assigned_to">Assigned To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="managed_by">Managed By (CSBD)</Label>
                <Select value={managedBy} onValueChange={setManagedBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select CSBD member" />
                  </SelectTrigger>
                  <SelectContent>
                    {csbdMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  {...register("website")}
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <Label htmlFor="company_linkedin_page">Company LinkedIn Page</Label>
                <Input
                  id="company_linkedin_page"
                  {...register("company_linkedin_page")}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Branches</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addBranch}>
                <Plus className="h-4 w-4 mr-1" />
                Add Branch
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {branches.map((branch, index) => (
              <div
                key={index}
                className={`rounded-lg border p-4 space-y-3 ${branch.is_primary ? "border-primary/50 bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Branch {index + 1}
                    </span>
                    {branch.is_primary && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        <Star className="h-3 w-3 fill-primary" /> Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!branch.is_primary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => updateBranch(index, "is_primary", true)}
                      >
                        Set as Primary
                      </Button>
                    )}
                    {branches.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeBranch(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Branch Name *</Label>
                    <Input
                      value={branch.branch_name}
                      onChange={(e) => updateBranch(index, "branch_name", e.target.value)}
                      placeholder="e.g. Head Office, Mumbai Branch"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">GST Number</Label>
                    <Input
                      value={branch.gst_number}
                      onChange={(e) => updateBranch(index, "gst_number", e.target.value)}
                      placeholder="e.g. 22AAAAA0000A1Z5"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Branch Address</Label>
                    <Input
                      value={branch.branch_address}
                      onChange={(e) => updateBranch(index, "branch_address", e.target.value)}
                      placeholder="Full address"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/clients")}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Client"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ClientForm;
