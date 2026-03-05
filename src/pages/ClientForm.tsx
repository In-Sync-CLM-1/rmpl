import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

interface ClientFormData {
  company_name: string;
  contact_name: string;
  official_address: string;
  residence_address: string;
  contact_number: string;
  email_id: string;
  birthday_date: string;
  anniversary_date: string;
  company_linkedin_page: string;
  linkedin_id: string;
}

const ClientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormData>();

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
        contact_name: client.contact_name,
        official_address: client.official_address || "",
        residence_address: client.residence_address || "",
        contact_number: client.contact_number || "",
        email_id: client.email_id || "",
        birthday_date: client.birthday_date || "",
        anniversary_date: client.anniversary_date || "",
        company_linkedin_page: client.company_linkedin_page || "",
        linkedin_id: client.linkedin_id || "",
      });
    }
  }, [client, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate email format if provided
      if (data.email_id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email_id)) {
        throw new Error("Invalid email format");
      }

      // Validate URL format for LinkedIn page if provided
      if (data.company_linkedin_page && !/^https?:\/\/.+/.test(data.company_linkedin_page)) {
        throw new Error("Company LinkedIn Page must be a valid URL (starting with http:// or https://)");
      }

      // Transform empty date strings to null for database compatibility
      const clientData = {
        ...data,
        birthday_date: data.birthday_date || null,
        anniversary_date: data.anniversary_date || null,
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
          <CardTitle>{isEditMode ? "Edit Client" : "Add Client"}</CardTitle>
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
                <Label htmlFor="contact_name">Contact Name *</Label>
                <Input
                  id="contact_name"
                  {...register("contact_name", { required: "Contact name is required" })}
                  placeholder="Enter full name"
                />
                {errors.contact_name && (
                  <p className="text-sm text-destructive mt-1">{errors.contact_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  {...register("contact_number")}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <Label htmlFor="email_id">Email ID</Label>
                <Input
                  id="email_id"
                  type="email"
                  {...register("email_id")}
                  placeholder="email@example.com"
                />
                {errors.email_id && (
                  <p className="text-sm text-destructive mt-1">{errors.email_id.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="linkedin_id">LinkedIn ID</Label>
                <Input
                  id="linkedin_id"
                  {...register("linkedin_id")}
                  placeholder="LinkedIn profile username"
                />
              </div>

              <div>
                <Label htmlFor="company_linkedin_page">Company LinkedIn Page</Label>
                <Input
                  id="company_linkedin_page"
                  {...register("company_linkedin_page")}
                  placeholder="https://linkedin.com/company/..."
                />
                {errors.company_linkedin_page && (
                  <p className="text-sm text-destructive mt-1">{errors.company_linkedin_page.message}</p>
                )}
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
                <Label htmlFor="residence_address">Residence Address</Label>
                <Input
                  id="residence_address"
                  {...register("residence_address")}
                  placeholder="Enter residence address"
                />
              </div>

              <div>
                <Label htmlFor="birthday_date">Birthday Date</Label>
                <Input
                  id="birthday_date"
                  type="date"
                  {...register("birthday_date")}
                />
              </div>

              <div>
                <Label htmlFor="anniversary_date">Anniversary Date</Label>
                <Input
                  id="anniversary_date"
                  type="date"
                  {...register("anniversary_date")}
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
