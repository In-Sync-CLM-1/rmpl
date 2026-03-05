import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormDialog } from "@/components/forms/FormDialog";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DistributionFormData, OperationsDistribution } from "@/hooks/useOperationsDistribution";
import { MultiImageUploader } from "./MultiImageUploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DistributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DistributionFormData) => Promise<void>;
  initialData?: OperationsDistribution;
}

export function DistributionDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: DistributionDialogProps) {
  const [formData, setFormData] = useState<DistributionFormData>({
    project_id: "",
    client_name: "",
    inventory_item_id: "",
    distribution_type: "gift",
    quantity_dispatched: 1,
    despatch_date: new Date().toISOString().split('T')[0],
    despatched_to: "",
    location: "",
    dispatch_mode: "by_hand",
    awb_number: "",
    usage_count: 0,
    damaged_lost_count: 0,
    return_location: "",
    notes: "",
    images: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects-for-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, project_number, client_id")
        .order("project_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory-items-for-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, items, brand, model, quantity, status")
        .eq("status", "Available")
        .eq("category", "Operations")
        .order("items");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        project_id: initialData.project_id || "",
        client_name: initialData.client_name || "",
        inventory_item_id: initialData.inventory_item_id,
        distribution_type: initialData.distribution_type,
        quantity_dispatched: initialData.quantity_dispatched,
        despatch_date: initialData.despatch_date,
        despatched_to: initialData.despatched_to,
        location: initialData.location || "",
        dispatch_mode: initialData.dispatch_mode,
        awb_number: initialData.awb_number || "",
        usage_count: initialData.usage_count,
        damaged_lost_count: initialData.damaged_lost_count,
        return_location: initialData.return_location || "",
        notes: initialData.notes || "",
        images: initialData.images || [],
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProject = projects?.find(p => p.id === formData.project_id);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Edit Distribution" : "Add Distribution"}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel={initialData ? "Update" : "Create"}
    >
      <Tabs defaultValue="dispatch" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dispatch">Dispatch Info</TabsTrigger>
          <TabsTrigger value="usage">Usage Update</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>

        <TabsContent value="dispatch" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Project / Client" htmlFor="project_id" required>
              <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectSearchOpen}
                    className="w-full justify-between bg-background"
                  >
                    {formData.project_id
                      ? projects?.find((p) => p.id === formData.project_id)
                          ? `${projects.find((p) => p.id === formData.project_id)?.project_number} - ${projects.find((p) => p.id === formData.project_id)?.project_name}`
                          : "Select project"
                      : "Select project"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-popover z-50">
                  <Command>
                    <CommandInput 
                      placeholder="Search projects..." 
                      value={projectSearch}
                      onValueChange={setProjectSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No project found.</CommandEmpty>
                      <CommandGroup>
                        {projects
                          ?.filter((project) => {
                            const searchLower = projectSearch.toLowerCase();
                            return (
                              project.project_name.toLowerCase().includes(searchLower) ||
                              project.project_number.toLowerCase().includes(searchLower)
                            );
                          })
                          .map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.id}
                              onSelect={() => {
                                setFormData({
                                  ...formData,
                                  project_id: project.id,
                                  client_name: project.client_id || "",
                                });
                                setProjectSearchOpen(false);
                                setProjectSearch("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.project_id === project.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {project.project_number} - {project.project_name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FormField>

            <FormField label="Inventory Item" htmlFor="inventory_item_id" required>
              <Select
                value={formData.inventory_item_id}
                onValueChange={(value) => setFormData({ ...formData, inventory_item_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.items} {item.brand && `- ${item.brand}`} {item.model && `(${item.model})`} - Qty: {item.quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Distribution Type" htmlFor="distribution_type" required>
              <Select
                value={formData.distribution_type}
                onValueChange={(value) => setFormData({ ...formData, distribution_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gift">Gift</SelectItem>
                  <SelectItem value="event_item">Event Item</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Quantity Dispatched" htmlFor="quantity_dispatched" required>
              <Input
                id="quantity_dispatched"
                type="number"
                min="1"
                value={formData.quantity_dispatched}
                onChange={(e) => setFormData({ ...formData, quantity_dispatched: parseInt(e.target.value) || 1 })}
              />
            </FormField>

            <FormField label="Despatch Date" htmlFor="despatch_date" required>
              <Input
                id="despatch_date"
                type="date"
                value={formData.despatch_date}
                onChange={(e) => setFormData({ ...formData, despatch_date: e.target.value })}
              />
            </FormField>

            <FormField label="Despatched To" htmlFor="despatched_to" required>
              <Input
                id="despatched_to"
                value={formData.despatched_to}
                onChange={(e) => setFormData({ ...formData, despatched_to: e.target.value })}
                placeholder="Recipient name"
              />
            </FormField>

            <FormField label="Location" htmlFor="location" required>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Destination location"
                required
              />
            </FormField>

            <FormField label="Dispatch Mode" htmlFor="dispatch_mode" required>
              <Select
                value={formData.dispatch_mode}
                onValueChange={(value) => setFormData({ ...formData, dispatch_mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="by_hand">By Hand</SelectItem>
                  <SelectItem value="courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {formData.dispatch_mode === "courier" && (
              <FormField label="AWB Number" htmlFor="awb_number">
                <Input
                  id="awb_number"
                  value={formData.awb_number}
                  onChange={(e) => setFormData({ ...formData, awb_number: e.target.value })}
                  placeholder="Air Waybill number"
                />
              </FormField>
            )}
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Usage" htmlFor="usage_count">
              <Input
                id="usage_count"
                type="number"
                min="0"
                value={formData.usage_count}
                onChange={(e) => setFormData({ ...formData, usage_count: parseInt(e.target.value) || 0 })}
              />
            </FormField>

            <FormField label="Damaged/Lost/Used" htmlFor="damaged_lost_count">
              <Input
                id="damaged_lost_count"
                type="number"
                min="0"
                value={formData.damaged_lost_count}
                onChange={(e) => setFormData({ ...formData, damaged_lost_count: parseInt(e.target.value) || 0 })}
              />
            </FormField>

            <FormField label="Return Location" htmlFor="return_location">
              <Input
                id="return_location"
                value={formData.return_location}
                onChange={(e) => setFormData({ ...formData, return_location: e.target.value })}
                placeholder="Where items were returned"
              />
            </FormField>

            <FormField label="Balance" htmlFor="balance">
              <Input
                id="balance"
                type="number"
                value={formData.quantity_dispatched - (formData.usage_count || 0) - (formData.damaged_lost_count || 0)}
                disabled
                className="bg-muted"
              />
            </FormField>
          </div>

          <div className="col-span-3">
            <FormField label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes"
                rows={3}
              />
            </FormField>
          </div>
        </TabsContent>

        <TabsContent value="images" className="space-y-4 mt-4">
          <MultiImageUploader
            images={formData.images || []}
            onChange={(images) => setFormData({ ...formData, images })}
          />
        </TabsContent>
      </Tabs>
    </FormDialog>
  );
}
