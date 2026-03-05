import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CallDispositionFormDialog } from "@/components/CallDispositionFormDialog";

interface Disposition {
  id: string;
  disposition: string;
  subdispositions: string[];
  is_active: boolean;
  created_at: string;
}

export default function CallDispositions() {
  const navigate = useNavigate();
  const [selectedDisposition, setSelectedDisposition] = useState<Disposition | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: dispositions, isLoading } = useQuery({
    queryKey: ['call-dispositions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_dispositions')
        .select('*')
        .order('disposition');
      
      if (error) throw error;
      return data as Disposition[];
    },
  });

  const handleEdit = (disposition: Disposition) => {
    setSelectedDisposition(disposition);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedDisposition(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedDisposition(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Call Dispositions</h1>
            <p className="text-muted-foreground">Manage disposition and sub-disposition hierarchy</p>
          </div>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Disposition
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading dispositions...</p>
        </Card>
      ) : !dispositions || dispositions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No dispositions found</p>
        </Card>
      ) : (
        <Card className="p-6">
          <Accordion type="multiple" className="w-full">
            {dispositions.map((disposition) => (
              <AccordionItem key={disposition.id} value={disposition.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-semibold text-lg">{disposition.disposition}</span>
                    <Badge variant={disposition.is_active ? "default" : "secondary"}>
                      {disposition.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="ml-auto mr-4">
                      {disposition.subdispositions.length} sub-dispositions
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4 pb-2">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(disposition)}
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="pl-6 space-y-2">
                      {disposition.subdispositions.map((sub, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 py-2 px-4 bg-muted/50 rounded-md"
                        >
                          <span className="text-muted-foreground text-sm font-mono mr-2">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="text-sm">{sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}

      <CallDispositionFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        disposition={selectedDisposition}
        onSuccess={handleCloseForm}
      />
    </div>
  );
}
