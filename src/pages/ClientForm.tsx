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
import { ArrowLeft } from "lucide-react";

interface ClientFormData {
  company_name: string;
  branch: string;
  official_address: string;
  company_linkedin_page: string;
  industry: string;
  gst_number: string;
  website: string;
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

  useEffect(() => {
    if (client) {
      reset({
        company_name: client.company_name,
        branch: client.branch || "",
        official_address: client.official_address || "",
        company_linkedin_page: client.company_linkedin_page || "",
        industry: client.industry || "",
        gst_number: client.gst_number || "",
        website: client.website || "",
      });
      setManagedBy(client.managed_by || "");
      setAssignedTo(client.assigned_to || "");
    }
  }, [client, reset]);

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

      const clientData = {
        company_name: data.company_name,
        branch: data.branch || null,
        official_address: data.official_address || null,
        company_linkedin_page: data.company_linkedin_page || null,
        industry: data.industry || null,
        gst_number: data.gst_number || null,
        website: data.website || null,
        managed_by: managedBy || null,
        assigned_to: assignedTo || null,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clients")
          .insert([{ ...clientData, created_by: user.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
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
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  {...register("branch")}
                  placeholder="Enter branch"
                />
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
                <Label htmlFor="gst_number">GST Number</Label>
                <Input
                  id="gst_number"
                  {...register("gst_number")}
                  placeholder="e.g. 22AAAAA0000A1Z5"
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
                <Label htmlFor="official_address">Official Address</Label>
                <Input
                  id="official_address"
                  {...register("official_address")}
                  placeholder="Enter official address"
                />
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  {...register("website")}
                  placeholder="https://example.com"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="company_linkedin_page">Company LinkedIn Page</Label>
                <Input
                  id="company_linkedin_page"
                  {...register("company_linkedin_page")}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/clients")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Client"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientForm;
