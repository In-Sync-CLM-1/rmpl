import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";

interface ContactFormData {
  contact_name: string;
  designation: string;
  department: string;
  contact_number: string;
  email_id: string;
  residence_address: string;
  birthday_date: string;
  anniversary_date: string;
  linkedin_id: string;
}

interface ClientOption {
  id: string;
  company_name: string;
}

const ContactForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!id;
  const [clientId, setClientId] = useState<string>(searchParams.get("clientId") || "");
  const [isPrimary, setIsPrimary] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormData>();

  // Fetch all clients for the dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .order("company_name");
      if (error) throw error;
      return data as ClientOption[];
    },
  });

  const { data: contact } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditMode,
  });

  useEffect(() => {
    if (contact) {
      reset({
        contact_name: contact.contact_name,
        designation: contact.designation || "",
        department: contact.department || "",
        contact_number: contact.contact_number || "",
        email_id: contact.email_id || "",
        residence_address: contact.residence_address || "",
        birthday_date: contact.birthday_date || "",
        anniversary_date: contact.anniversary_date || "",
        linkedin_id: contact.linkedin_id || "",
      });
      setClientId(contact.client_id);
      setIsPrimary(contact.is_primary || false);
    }
  }, [contact, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!clientId) throw new Error("Please select a company");

      if (data.email_id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email_id)) {
        throw new Error("Invalid email format");
      }

      const contactData = {
        client_id: clientId,
        contact_name: data.contact_name,
        designation: data.designation || null,
        department: data.department || null,
        contact_number: data.contact_number || null,
        email_id: data.email_id || null,
        residence_address: data.residence_address || null,
        birthday_date: data.birthday_date || null,
        anniversary_date: data.anniversary_date || null,
        linkedin_id: data.linkedin_id || null,
        is_primary: isPrimary,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contacts")
          .insert([{ ...contactData, created_by: user.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({
        title: "Success",
        description: `Contact ${isEditMode ? "updated" : "created"} successfully`,
      });
      navigate("/contacts");
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
        <h1 className="text-3xl font-bold">{isEditMode ? "Edit Contact" : "Add Contact"}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client_id">Company *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  {...register("designation")}
                  placeholder="e.g. CEO, Manager, Director"
                />
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  {...register("department")}
                  placeholder="e.g. Marketing, Finance, IT"
                />
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
                <Label htmlFor="residence_address">Address</Label>
                <Input
                  id="residence_address"
                  {...register("residence_address")}
                  placeholder="Enter address"
                />
              </div>

              <div>
                <Label htmlFor="birthday_date">Birthday</Label>
                <Input
                  id="birthday_date"
                  type="date"
                  {...register("birthday_date")}
                />
              </div>

              <div>
                <Label htmlFor="anniversary_date">Anniversary</Label>
                <Input
                  id="anniversary_date"
                  type="date"
                  {...register("anniversary_date")}
                />
              </div>

              <div className="flex items-center gap-2 col-span-2">
                <Checkbox
                  id="is_primary"
                  checked={isPrimary}
                  onCheckedChange={(checked) => setIsPrimary(checked === true)}
                />
                <Label htmlFor="is_primary" className="cursor-pointer">
                  Primary contact for this company
                </Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Contact"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactForm;
