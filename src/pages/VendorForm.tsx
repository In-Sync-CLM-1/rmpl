import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
}

interface VendorFormData {
  vendor_name: string;
  vendor_type: string;
  service_type: string;
  contact_person: string;
  contact_no: string;
  email_id: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  gst: string;
  department: string;
}

export default function VendorForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormData>();

  const vendorType = watch("vendor_type");
  const department = watch("department");

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (isEditing) {
      loadVendor();
    }
  }, [id]);

  const loadTeams = async () => {
    try {
      setIsLoadingTeams(true);
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error loading teams:", error);
      toast.error("Failed to load teams");
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const loadVendor = async () => {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        Object.keys(data).forEach((key) => {
          setValue(key as keyof VendorFormData, data[key] || "");
        });
      }
    } catch (error) {
      console.error("Error loading vendor:", error);
      toast.error("Failed to load vendor");
      navigate("/vendors");
    }
  };

  const onSubmit = async (data: VendorFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const vendorData = {
        vendor_name: data.vendor_name.trim(),
        vendor_type: data.vendor_type,
        service_type: data.service_type?.trim() || null,
        contact_person: data.contact_person?.trim() || null,
        contact_no: data.contact_no?.replace(/\s/g, "") || null,
        email_id: data.email_id?.trim().toLowerCase() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        pin_code: data.pin_code?.replace(/\s/g, "") || null,
        gst: data.gst?.trim().toUpperCase() || null,
        department: data.department?.trim() || null,
        created_by: user.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("vendors")
          .update(vendorData)
          .eq("id", id);

        if (error) throw error;
        toast.success("Vendor updated successfully");
      } else {
        const { error } = await supabase.from("vendors").insert([vendorData]);

        if (error) throw error;
        toast.success("Vendor created successfully");
      }

      navigate("/vendors");
    } catch (error) {
      console.error("Error saving vendor:", error);
      toast.error(isEditing ? "Failed to update vendor" : "Failed to create vendor");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/vendors")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Vendors
        </Button>
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">
              {isEditing ? "Edit Vendor" : "Add New Vendor"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? "Update vendor information" : "Create a new vendor record"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_name">
                  Vendor Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vendor_name"
                  {...register("vendor_name", {
                    required: "Vendor name is required",
                    maxLength: { value: 200, message: "Max 200 characters" },
                  })}
                  placeholder="Enter vendor name"
                />
                {errors.vendor_name && (
                  <p className="text-sm text-destructive">{errors.vendor_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor_type">
                  Vendor Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={vendorType}
                  onValueChange={(value) => setValue("vendor_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="HRAF">HRAF</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
                {errors.vendor_type && (
                  <p className="text-sm text-destructive">{errors.vendor_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_type">Service Type</Label>
                <Input
                  id="service_type"
                  {...register("service_type", {
                    maxLength: { value: 200, message: "Max 200 characters" },
                  })}
                  placeholder="Enter service type"
                />
                {errors.service_type && (
                  <p className="text-sm text-destructive">{errors.service_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  {...register("contact_person")}
                  placeholder="Enter contact person name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_no">Contact No.</Label>
                <Input
                  id="contact_no"
                  {...register("contact_no", {
                    pattern: {
                      value: /^\d{10,15}$/,
                      message: "Contact number must be 10-15 digits",
                    },
                  })}
                  placeholder="Enter contact number (10-15 digits)"
                />
                {errors.contact_no && (
                  <p className="text-sm text-destructive">{errors.contact_no.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email_id">Email Id</Label>
                <Input
                  id="email_id"
                  type="email"
                  {...register("email_id", {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Invalid email format",
                    },
                  })}
                  placeholder="Enter email address"
                />
                {errors.email_id && (
                  <p className="text-sm text-destructive">{errors.email_id.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...register("address")}
                placeholder="Enter full address"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder="Enter city"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  {...register("state")}
                  placeholder="Enter state"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin_code">Pin Code</Label>
                <Input
                  id="pin_code"
                  {...register("pin_code", {
                    pattern: {
                      value: /^\d{6}$/,
                      message: "Pin code must be exactly 6 digits",
                    },
                  })}
                  placeholder="Enter 6-digit pin code"
                  maxLength={6}
                />
                {errors.pin_code && (
                  <p className="text-sm text-destructive">{errors.pin_code.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gst">GST</Label>
                <Input
                  id="gst"
                  {...register("gst", {
                    pattern: {
                      value: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                      message: "Invalid GST format (e.g., 27AABCU9603R1Z5)",
                    },
                  })}
                  placeholder="Enter GST number"
                  maxLength={15}
                />
                {errors.gst && (
                  <p className="text-sm text-destructive">{errors.gst.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={department}
                  onValueChange={(value) => setValue("department", value)}
                  disabled={isLoadingTeams}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={isLoadingTeams ? "Loading teams..." : "Select department"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.name}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/vendors")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : isEditing
              ? "Update Vendor"
              : "Save Vendor"}
          </Button>
        </div>
      </form>
    </div>
  );
}
