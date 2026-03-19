 import { useState } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Skeleton } from "@/components/ui/skeleton";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from "@/components/ui/alert-dialog";
 import { FileText, CheckCircle2, Clock, XCircle, RefreshCw, Plus, Loader2, Trash2 } from "lucide-react";
 import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
 import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
 import { CreateTemplateDialog } from "./CreateTemplateDialog";
 import { format } from "date-fns";

 const statusConfig: Record<string, { icon: React.ElementType; color: string; variant: "default" | "secondary" | "destructive" }> = {
   approved: { icon: CheckCircle2, color: "text-green-500", variant: "default" },
   pending: { icon: Clock, color: "text-yellow-500", variant: "secondary" },
   rejected: { icon: XCircle, color: "text-red-500", variant: "destructive" },
 };

 export function WhatsAppTemplateList() {
   const { templates, isLoading, deleteTemplate, isDeleting } = useWhatsAppTemplates();
   const { syncTemplates, isSyncing } = useWhatsAppSettings();
   const [showCreate, setShowCreate] = useState(false);
   const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

   if (isLoading) {
     return (
       <Card>
         <CardHeader>
           <CardTitle>WhatsApp Templates</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-4">
             {[1, 2, 3].map((i) => (
               <Skeleton key={i} className="h-24 w-full" />
             ))}
           </div>
         </CardContent>
       </Card>
     );
   }

   return (
     <>
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle className="flex items-center gap-2">
                 <FileText className="h-5 w-5" />
                 WhatsApp Templates
               </CardTitle>
               <CardDescription>
                 {templates.length} template{templates.length !== 1 ? "s" : ""} created from this portal
               </CardDescription>
             </div>
             <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" onClick={() => syncTemplates()} disabled={isSyncing}>
                 {isSyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                 Sync Status
               </Button>
               <Button onClick={() => setShowCreate(true)} size="sm">
                 <Plus className="h-4 w-4 mr-1" />
                 Create Template
               </Button>
             </div>
           </div>
         </CardHeader>
         <CardContent>
           {templates.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
               <RefreshCw className="h-12 w-12 mb-3 opacity-50" />
               <p className="text-sm">No templates created yet</p>
               <p className="text-xs">Click "Create Template" to submit one for WhatsApp approval</p>
             </div>
           ) : (
             <ScrollArea className="h-[400px] pr-4">
               <div className="space-y-4">
                 {templates.map((template) => {
                   const statusInfo = statusConfig[template.status] || statusConfig.pending;
                   const StatusIcon = statusInfo.icon;

                   return (
                     <div
                       key={template.id}
                       className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                     >
                       <div className="flex items-start justify-between mb-2">
                         <div>
                           <h4 className="font-medium">{template.template_name}</h4>
                           <div className="flex items-center gap-2 mt-1">
                             <Badge variant="outline" className="text-xs">
                               {template.category || "UTILITY"}
                             </Badge>
                             <Badge variant="outline" className="text-xs">
                               {template.language.toUpperCase()}
                             </Badge>
                             <Badge variant={statusInfo.variant} className="text-xs">
                               <StatusIcon className="h-3 w-3 mr-1" />
                               {template.status}
                             </Badge>
                           </div>
                         </div>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 w-8 text-muted-foreground hover:text-destructive"
                           onClick={() => setDeleteTarget({ id: template.id, name: template.template_name })}
                           disabled={isDeleting}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>

                       {template.header_content && (
                         <p className="text-sm font-semibold mt-2">{template.header_content}</p>
                       )}

                       <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">
                         {template.content}
                       </p>

                       {template.footer_text && (
                         <p className="text-xs text-muted-foreground mt-1 italic">{template.footer_text}</p>
                       )}

                       {template.variables.length > 0 && (
                         <div className="flex flex-wrap gap-1 mt-2">
                           {template.variables.map((v) => (
                             <Badge key={v.index} variant="secondary" className="text-xs">
                               {v.placeholder}
                             </Badge>
                           ))}
                         </div>
                       )}

                       {template.last_synced_at && (
                         <p className="text-xs text-muted-foreground mt-2">
                           Last synced: {format(new Date(template.last_synced_at), "PPp")}
                         </p>
                       )}

                       {template.rejection_reason && (
                         <p className="text-xs text-red-500 mt-2">
                           Rejection reason: {template.rejection_reason}
                         </p>
                       )}
                     </div>
                   );
                 })}
               </div>
             </ScrollArea>
           )}
         </CardContent>
       </Card>

       <CreateTemplateDialog open={showCreate} onOpenChange={setShowCreate} />

       <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Template</AlertDialogTitle>
             <AlertDialogDescription>
               Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
               onClick={() => {
                 if (deleteTarget) {
                   deleteTemplate(deleteTarget.id);
                   setDeleteTarget(null);
                 }
               }}
             >
               Delete
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </>
   );
 }
