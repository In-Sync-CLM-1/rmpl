import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { ArrowLeft, Package2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Vendor {
  id: string;
  vendor_name: string;
}

interface InventoryFormData {
  date_of_purchase: any;
  vendor_name: string;
  vendor_id: string | null;
  invoice_date: any;
  invoice_no: string;
  items: string;
  brand: string;
  model: string;
  item_description: string;
  quantity: number;
  rate: number;
  units: string;
  gst_slab: number;
  payment_status: string;
  category: string;
  invoice_file?: FileList;
}

const UNITS = ["Count", "Kg", "Liter", "Box", "Pack", "Dozen", "Meter", "Piece", "Set", "Carton", "Bag", "Roll"];
const GST_SLABS = [0, 5, 12, 18, 28, 40];
const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];
const CATEGORY_OPTIONS = [
  { value: "Operations", label: "Operations" },
  { value: "IT", label: "IT" },
];

export default function InventoryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  const formInstance = useForm<InventoryFormData>({
    defaultValues: {
      gst_slab: 18,
      quantity: 1,
      rate: 0,
      payment_status: "pending",
      category: "Operations",
    },
  });

  const { register, handleSubmit, watch, setValue, setError, clearErrors } = formInstance;
  const errors = formInstance.formState.errors;

  const quantity = watch("quantity") || 0;
  const rate = watch("rate") || 0;
  const gstSlab = watch("gst_slab") || 18;
  const dateOfPurchase = watch("date_of_purchase");
  const invoiceDate = watch("invoice_date");
  const selectedVendor = watch("vendor_name");
  const units = watch("units");
  const paymentStatus = watch("payment_status");
  const category = watch("category");

  // Calculate values
  const totalPrice = quantity * rate;
  const gstAmount = totalPrice * (gstSlab / 100);
  const totalCost = totalPrice + gstAmount;

  useEffect(() => {
    loadVendors();
    if (isEditing) {
      loadInventoryItem();
    }
  }, [id]);

  const loadVendors = async () => {
    try {
      setIsLoadingVendors(true);
      const result = await (supabase as any)
        .from("vendors")
        .select("id, vendor_name")
        .order("vendor_name");

      if (result.error) throw result.error;
      setVendors(result.data || []);
    } catch (error) {
      console.error("Error loading vendors:", error);
      toast.error("Failed to load vendors");
    } finally {
      setIsLoadingVendors(false);
    }
  };

  const loadInventoryItem = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setValue("date_of_purchase", new Date(data.date_of_purchase));
        setValue("vendor_name", data.vendor_name);
        setValue("vendor_id", data.vendor_id);
        setValue("invoice_date", new Date(data.invoice_date));
        setValue("invoice_no", data.invoice_no);
        setValue("items", data.items);
        setValue("brand", data.brand || "");
        setValue("model", data.model || "");
        setValue("item_description", data.item_description || "");
        setValue("quantity", data.quantity);
        setValue("rate", data.rate);
        setValue("units", data.units);
        setValue("gst_slab", data.gst_slab);
        setValue("payment_status", data.payment_status || "pending");
        setValue("category", data.category || "Operations");
        if (data.invoice_file_url) {
          setUploadedFileName("Existing file");
        }
      }
    } catch (error) {
      console.error("Error loading inventory item:", error);
      toast.error("Failed to load inventory item");
      navigate("/inventory");
    }
  };

  const checkInvoiceNoUniqueness = async (invoiceNo: string) => {
    if (!invoiceNo || isEditing) return true;

    const { data } = await supabase
      .from("inventory_items")
      .select("invoice_no")
      .eq("invoice_no", invoiceNo)
      .maybeSingle();

    if (data) {
      setError("invoice_no", {
        type: "manual",
        message: "Invoice number already exists",
      });
      return false;
    }

    clearErrors("invoice_no");
    return true;
  };

  const uploadInvoiceFile = async (file: File, invoiceNo: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const fileExt = file.name.split(".").pop();
    const fileName = `${invoiceNo}_${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("inventory-invoices")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("inventory-invoices")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const onSubmit = async (data: InventoryFormData) => {
    try {
      setIsSubmitting(true);

      // Check invoice number uniqueness
      if (!isEditing) {
        const isUnique = await checkInvoiceNoUniqueness(data.invoice_no);
        if (!isUnique) {
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find vendor_id from vendor_name
      const vendor = vendors.find(v => v.vendor_name === data.vendor_name);

      let invoiceFileUrl: string | undefined = undefined;

      // Upload file if provided
      if (data.invoice_file && data.invoice_file.length > 0) {
        const file = data.invoice_file[0];

        // Validate file
        if (file.size > 10 * 1024 * 1024) {
          toast.error("File size must be less than 10MB");
          return;
        }

        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
        if (!allowedTypes.includes(file.type)) {
          toast.error("Only PDF, JPG, and PNG files are allowed");
          return;
        }

        invoiceFileUrl = await uploadInvoiceFile(file, data.invoice_no);
      }

      const baseInventoryData = {
        invoice_no: data.invoice_no,
        date_of_purchase: format(data.date_of_purchase, "yyyy-MM-dd"),
        vendor_name: data.vendor_name,
        vendor_id: vendor?.id || null,
        invoice_date: format(data.invoice_date, "yyyy-MM-dd"),
        items: data.items,
        brand: data.brand || null,
        model: data.model || null,
        item_description: data.item_description || null,
        rate: Number(data.rate),
        units: data.units,
        gst_slab: Number(data.gst_slab),
        payment_status: data.payment_status,
        category: data.category,
        invoice_file_url: invoiceFileUrl,
        created_by: user.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("inventory_items")
          .update({ ...baseInventoryData, quantity: Number(data.quantity) })
          .eq("id", id);

        if (error) throw error;
        toast.success("Inventory item updated successfully");
      } else {
        // For IT category with quantity > 1, create individual line items
        if (data.category === "IT" && Number(data.quantity) > 1) {
          const itemsToInsert = [];
          for (let i = 1; i <= Number(data.quantity); i++) {
            itemsToInsert.push({
              ...baseInventoryData,
              quantity: 1,
              line_number: i,
            });
          }
          
          const { error } = await supabase
            .from("inventory_items")
            .insert(itemsToInsert);

          if (error) throw error;
          toast.success(`${data.quantity} individual IT items created successfully`);
        } else {
          const { error } = await supabase
            .from("inventory_items")
            .insert([{ ...baseInventoryData, quantity: Number(data.quantity) }]);

          if (error) throw error;
          toast.success("Inventory item added successfully");
        }
      }

      navigate("/inventory");
    } catch (error) {
      console.error("Error saving inventory item:", error);
      toast.error("Failed to save inventory item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/inventory")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inventory
        </Button>
        <div className="flex items-center gap-2">
          <Package2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Inventory Item" : "Add Inventory Item"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Purchase Information */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_of_purchase">
                  Date of Purchase <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
                        !dateOfPurchase && "text-muted-foreground"
                      )}
                    >
                      {dateOfPurchase ? format(dateOfPurchase, "dd/MM/yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50">
                    <Calendar
                      mode="single"
                      selected={dateOfPurchase}
                      onSelect={(date) => setValue("date_of_purchase", date!)}
                    />
                  </PopoverContent>
                </Popover>
                {errors.date_of_purchase && (
                  <p className="text-sm text-destructive">{errors.date_of_purchase?.message as string}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor_name">
                  Vendor Name <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedVendor}
                  onValueChange={(value) => setValue("vendor_name", value)}
                  disabled={isLoadingVendors}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={isLoadingVendors ? "Loading vendors..." : "Select vendor"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.vendor_name}>
                        {vendor.vendor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.vendor_name && (
                  <p className="text-sm text-destructive">{errors.vendor_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_date">
                  Invoice Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
                        !invoiceDate && "text-muted-foreground"
                      )}
                    >
                      {invoiceDate ? format(invoiceDate, "dd/MM/yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50">
                    <Calendar
                      mode="single"
                      selected={invoiceDate}
                      onSelect={(date) => setValue("invoice_date", date!)}
                    />
                  </PopoverContent>
                </Popover>
                {errors.invoice_date && (
                  <p className="text-sm text-destructive">{errors.invoice_date?.message as string}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_no">
                  Invoice No. <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice_no"
                  {...register("invoice_no", { required: "Invoice number is required" })}
                  onBlur={(e) => checkInvoiceNoUniqueness(e.target.value)}
                  placeholder="Enter invoice number"
                />
                {errors.invoice_no && (
                  <p className="text-sm text-destructive">{errors.invoice_no.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Item Details */}
        <Card>
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => setValue("category", value)}
                  disabled={isEditing}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {category === "IT" && Number(quantity) > 1 && !isEditing && (
                  <p className="text-sm text-blue-600">
                    This will create {quantity} individual items for tracking
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="items">
                  Items <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="items"
                  {...register("items", { required: "Items is required" })}
                  placeholder="Enter item name"
                />
                {errors.items && (
                  <p className="text-sm text-destructive">{errors.items.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  {...register("brand")}
                  placeholder="Enter brand"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  {...register("model")}
                  placeholder="Enter model"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item_description">Item Description</Label>
              <Textarea
                id="item_description"
                {...register("item_description")}
                placeholder="Enter item description"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing Information */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  {...register("quantity", {
                    required: "Quantity is required",
                    min: { value: 1, message: "Quantity must be at least 1" },
                  })}
                  placeholder="Enter quantity"
                />
                {errors.quantity && (
                  <p className="text-sm text-destructive">{errors.quantity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">
                  Rate (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("rate", {
                    required: "Rate is required",
                    min: { value: 0, message: "Rate must be at least 0" },
                  })}
                  placeholder="Enter rate"
                />
                {errors.rate && (
                  <p className="text-sm text-destructive">{errors.rate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="units">
                  Units <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={units}
                  onValueChange={(value) => setValue("units", value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.units && (
                  <p className="text-sm text-destructive">{errors.units.message}</p>
                )}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-lg">
                <span className="font-medium">Total Price:</span>
                <span className="font-semibold">{formatCurrency(totalPrice)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst_slab">
                  GST Slab <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={gstSlab.toString()}
                  onValueChange={(value) => setValue("gst_slab", Number(value))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {GST_SLABS.map((slab) => (
                      <SelectItem key={slab} value={slab.toString()}>
                        {slab}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between text-lg">
                <span className="font-medium">GST Amount ({gstSlab}%):</span>
                <span className="font-semibold">{formatCurrency(gstAmount)}</span>
              </div>

              <div className="flex justify-between text-xl border-t pt-3">
                <span className="font-bold">Total Cost:</span>
                <span className="font-bold text-primary">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Upload (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_file">Invoice Soft Copy</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="invoice_file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("invoice_file")}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setUploadedFileName(e.target.files[0].name);
                    }
                  }}
                  className="bg-background"
                />
                {uploadedFileName && (
                  <span className="text-sm text-muted-foreground">{uploadedFileName}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Max 10MB, PDF/JPG/PNG only
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="payment_status">
                Payment Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={paymentStatus}
                onValueChange={(value) => setValue("payment_status", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/inventory")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEditing ? "Update Inventory Item" : "Save Inventory Item"}
          </Button>
        </div>
      </form>
    </div>
  );
}
