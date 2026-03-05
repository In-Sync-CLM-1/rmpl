import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectLiveComEvents, type LiveComEvent } from "@/hooks/useProjectLiveComEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Star } from "lucide-react";

interface ProjectLiveComEventsProps {
  projectId: string;
}

export function ProjectLiveComEvents({ projectId }: ProjectLiveComEventsProps) {
  const { events, isLoading, createEvent, updateEvent, deleteEvent } =
    useProjectLiveComEvents(projectId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LiveComEvent | null>(null);
  const [formData, setFormData] = useState<Partial<LiveComEvent>>({});

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, vendor_name")
        .order("vendor_name");

      if (error) throw error;
      return data;
    },
  });

  const handleOpenDialog = (event?: LiveComEvent) => {
    if (event) {
      setEditingEvent(event);
      setFormData(event);
    } else {
      setEditingEvent(null);
      setFormData({});
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
    setFormData({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only include valid columns for update (exclude join data like vendor_hotel)
    const updateData: Record<string, any> = {};
    
    if (formData.vendor_hotel_id !== undefined) updateData.vendor_hotel_id = formData.vendor_hotel_id;
    if (formData.services !== undefined) updateData.services = formData.services;
    if (formData.internal_cost_exc_tax !== undefined) updateData.internal_cost_exc_tax = formData.internal_cost_exc_tax;
    if (formData.rating_by_livecom !== undefined) updateData.rating_by_livecom = formData.rating_by_livecom;
    if (formData.rating_by_csbd !== undefined) updateData.rating_by_csbd = formData.rating_by_csbd;
    if (formData.remarks_by_livecom !== undefined) updateData.remarks_by_livecom = formData.remarks_by_livecom;
    if (formData.remarks_by_csbd !== undefined) updateData.remarks_by_csbd = formData.remarks_by_csbd;
    
    try {
      if (editingEvent) {
        await updateEvent({ id: editingEvent.id, data: updateData });
      } else {
        createEvent(updateData);
      }
      handleCloseDialog();
    } catch (error) {
      console.error("Failed to save event:", error);
      // Don't close dialog on error
    }
  };

  const handleInputChange = (field: keyof LiveComEvent, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= rating ? "fill-yellow-500 text-yellow-500" : "fill-muted text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  const renderStarInput = (
    value: number | null,
    onChange: (value: number) => void,
    label: string
  ) => {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 transition-colors cursor-pointer ${
                  value && star <= value
                    ? "fill-yellow-500 text-yellow-500"
                    : "fill-muted stroke-2 text-muted-foreground hover:fill-yellow-300 hover:text-yellow-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">LiveCom Events</h3>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
              <TableHead className="text-primary-foreground">Vendor/Hotel</TableHead>
              <TableHead className="text-primary-foreground">Services</TableHead>
              <TableHead className="text-primary-foreground">Internal Cost (Exc Tax.)</TableHead>
              <TableHead className="text-primary-foreground">Rating by LiveCom</TableHead>
              <TableHead className="text-primary-foreground">Remarks by LiveCom</TableHead>
              <TableHead className="text-primary-foreground">Rating by CSBD</TableHead>
              <TableHead className="text-primary-foreground">Remarks by CSBD</TableHead>
              <TableHead className="text-primary-foreground w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No events added yet. Click "Add Event" to create one.
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.vendor_hotel?.vendor_name || "-"}</TableCell>
                  <TableCell>{event.services || "-"}</TableCell>
                  <TableCell>
                    {event.internal_cost_exc_tax
                      ? `₹${event.internal_cost_exc_tax.toLocaleString()}`
                      : "-"}
                  </TableCell>
                  <TableCell>{renderStars(event.rating_by_livecom)}</TableCell>
                  <TableCell className="max-w-xs">
                    {event.remarks_by_livecom ? (
                      <span className="text-sm line-clamp-2">{event.remarks_by_livecom}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{renderStars(event.rating_by_csbd)}</TableCell>
                  <TableCell className="max-w-xs">
                    {event.remarks_by_csbd ? (
                      <span className="text-sm line-clamp-2">{event.remarks_by_csbd}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(event)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEvent(event.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Edit Event" : "Add Event"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_hotel_id">Vendor/Hotel</Label>
                <Select
                  value={formData.vendor_hotel_id || ""}
                  onValueChange={(value) => handleInputChange("vendor_hotel_id", value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select vendor/hotel" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.vendor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="services">Services</Label>
                <Input
                  id="services"
                  value={formData.services || ""}
                  onChange={(e) => handleInputChange("services", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_cost_exc_tax">Internal Cost (Exc Tax.)</Label>
                <Input
                  id="internal_cost_exc_tax"
                  type="number"
                  step="0.01"
                  value={formData.internal_cost_exc_tax || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "internal_cost_exc_tax",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                />
              </div>
              {renderStarInput(
                formData.rating_by_livecom || null,
                (value) => handleInputChange("rating_by_livecom", value),
                "Rating by LiveCom"
              )}
              <div className="space-y-2">
                <Label htmlFor="remarks_by_livecom">Remarks by LiveCom</Label>
                <Input
                  id="remarks_by_livecom"
                  value={formData.remarks_by_livecom || ""}
                  onChange={(e) => handleInputChange("remarks_by_livecom", e.target.value)}
                  placeholder="Add remarks from LiveCom..."
                />
              </div>
              {renderStarInput(
                formData.rating_by_csbd || null,
                (value) => handleInputChange("rating_by_csbd", value),
                "Rating by CSBD"
              )}
              <div className="space-y-2">
                <Label htmlFor="remarks_by_csbd">Remarks by CSBD</Label>
                <Input
                  id="remarks_by_csbd"
                  value={formData.remarks_by_csbd || ""}
                  onChange={(e) => handleInputChange("remarks_by_csbd", e.target.value)}
                  placeholder="Add remarks from CSBD..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEvent ? "Update" : "Add"} Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
