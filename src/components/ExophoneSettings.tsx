import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, Trash2, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ExophoneConfig {
  id: string;
  exophone: string;
  display_name: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export function ExophoneSettings() {
  const [exophones, setExophones] = useState<ExophoneConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newExophone, setNewExophone] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchExophones();
  }, []);

  const fetchExophones = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("exotel_config")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching exophones:", error);
      toast.error("Failed to load EXOPhone numbers");
    } else {
      setExophones(data || []);
    }
    setIsLoading(false);
  };

  const handleAddExophone = async () => {
    if (!newExophone.trim()) {
      toast.error("EXOPhone number is required");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from("exotel_config").insert({
      exophone: newExophone.trim(),
      display_name: newDisplayName.trim() || null,
      is_default: exophones.length === 0, // First one is default
      is_active: true,
    });

    if (error) {
      console.error("Error adding exophone:", error);
      toast.error("Failed to add EXOPhone number");
    } else {
      toast.success("EXOPhone number added");
      setNewExophone("");
      setNewDisplayName("");
      setIsAddDialogOpen(false);
      fetchExophones();
    }
    setIsSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    const { error } = await supabase
      .from("exotel_config")
      .update({ is_default: true })
      .eq("id", id);

    if (error) {
      console.error("Error setting default:", error);
      toast.error("Failed to set default");
    } else {
      toast.success("Default EXOPhone updated");
      fetchExophones();
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from("exotel_config")
      .update({ is_active: !currentState })
      .eq("id", id);

    if (error) {
      console.error("Error toggling status:", error);
      toast.error("Failed to update status");
    } else {
      fetchExophones();
    }
  };

  const handleDelete = async (id: string) => {
    const exophone = exophones.find((e) => e.id === id);
    if (exophone?.is_default) {
      toast.error("Cannot delete the default EXOPhone number");
      return;
    }

    const { error } = await supabase.from("exotel_config").delete().eq("id", id);

    if (error) {
      console.error("Error deleting exophone:", error);
      toast.error("Failed to delete EXOPhone number");
    } else {
      toast.success("EXOPhone number deleted");
      fetchExophones();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              EXOPhone Numbers (Caller ID)
            </CardTitle>
            <CardDescription className="mt-1">
              Manage Exotel virtual numbers used as Caller ID for outbound calls
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add EXOPhone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add EXOPhone Number</DialogTitle>
                <DialogDescription>
                  Add a new Exotel virtual number to use as Caller ID
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="exophone">EXOPhone Number *</Label>
                  <Input
                    id="exophone"
                    placeholder="e.g., 08047104850"
                    value={newExophone}
                    onChange={(e) => setNewExophone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name (Optional)</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g., Sales Line"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddExophone} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Number
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : exophones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No EXOPhone numbers configured</p>
            <p className="text-sm mt-1">
              Add your first Exotel virtual number to enable calling
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>EXOPhone Number</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exophones.map((exophone) => (
                <TableRow key={exophone.id}>
                  <TableCell className="font-mono">{exophone.exophone}</TableCell>
                  <TableCell>{exophone.display_name || "-"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={exophone.is_active}
                      onCheckedChange={() =>
                        handleToggleActive(exophone.id, exophone.is_active)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {exophone.is_default ? (
                      <Badge variant="default" className="gap-1">
                        <Star className="h-3 w-3" /> Default
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(exophone.id)}
                        disabled={!exophone.is_active}
                      >
                        Set Default
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(exophone.id)}
                      disabled={exophone.is_default}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
