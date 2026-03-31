import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { logError, getSupabaseErrorMessage, getCurrentUserId } from "@/lib/errorLogger";
import { ArrowLeft } from "lucide-react";

type ClientFormData = {
  mobile_numb: string;
  name: string;
  designation?: string;
  deppt?: string;
  job_level_updated?: string;
  linkedin?: string;
  mobile2?: string;
  official?: string;
  personal_email_id?: string;
  generic_email_id?: string;
  industry_type?: string;
  sub_industry?: string;
  company_name?: string;
  address?: string;
  location?: string;
  city?: string;
  state?: string;
  zone?: string;
  tier?: string;
  pincode?: string;
  website?: string;
  turnover?: string;
  emp_size?: string;
  erp_name?: string;
  erp_vendor?: string;
};

export default function MasterForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const form = useForm<ClientFormData>({
    defaultValues: {
      mobile_numb: "",
      name: "",
      designation: "",
      deppt: "",
      job_level_updated: "",
      linkedin: "",
      mobile2: "",
      official: "",
      personal_email_id: "",
      generic_email_id: "",
      industry_type: "",
      sub_industry: "",
      company_name: "",
      address: "",
      location: "",
      city: "",
      state: "",
      zone: "",
      tier: "",
      pincode: "",
      website: "",
      turnover: "",
      emp_size: "",
      erp_name: "",
      erp_vendor: "",
    },
  });

  const { data: client } = useQuery({
    queryKey: ["master", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("master" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (client) {
      form.reset(client);
    }
  }, [client, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const userId = await getCurrentUserId(supabase);
      
      if (isEditing) {
        const { error } = await supabase
          .from("master" as any)
          .update({ ...data, created_by: userId })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("master" as any)
          .insert([{ ...data, created_by: userId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master"] });
      toast({ title: `Master record ${isEditing ? "updated" : "created"} successfully` });
      navigate("/master");
    },
    onError: async (error: Error) => {
      logError(error, {
        component: "MasterForm",
        operation: isEditing ? "UPDATE_DATA" : "CREATE_DATA",
        userId: await getCurrentUserId(supabase),
      });
      toast({
        title: `Error ${isEditing ? "updating" : "creating"} master record`,
        description: getSupabaseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClientFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-4xl font-bold">
            {isEditing ? "Edit Master Record" : "New Master Record"}
          </h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Contact Information Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="mobile_numb"
                  rules={{ required: "Mobile number is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number *</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isEditing} placeholder="Enter mobile number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mobile2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number 2</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter alternate mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="official"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Official Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="official@company.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="personal_email_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="personal@email.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="generic_email_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generic Email ID</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="info@company.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkedin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://linkedin.com/in/..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter designation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deppt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter department" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="job_level_updated"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Level</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter job level" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Company Information Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Company Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter company name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://company.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry Type</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter industry type" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sub_industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub Industry</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter sub industry" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="turnover"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turnover</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter turnover" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emp_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee Size</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter employee count" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="erp_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ERP Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter ERP name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="erp_vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ERP Vendor</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter ERP vendor" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Location Information Section */}
            <div className="bg-card p-6 rounded-lg border space-y-4">
              <h2 className="text-xl font-semibold mb-4">Location Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Enter full address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter zone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tier</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter tier" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter pincode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/master")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Master Record"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
