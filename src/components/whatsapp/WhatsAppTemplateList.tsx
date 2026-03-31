 import { useState } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Skeleton } from "@/components/ui/skeleton";
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from "@/components/ui/table";
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
 import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
 } from "@/components/ui/tooltip";
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
               <Skeleton key={i} className="h-12 w-full" />
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
             <div className="overflow-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="w-[200px]">Name</TableHead>
                     <TableHead>Content</TableHead>
                     <TableHead className="w-[100px]">Category</TableHead>
                     <TableHead className="w-[100px]">Status</TableHead>
                     <TableHead className="w-[80px]">Vars</TableHead>
                     <TableHead className="w-[50px]"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {templates.map((template) => {
                     const statusInfo = statusConfig[template.status] || statusConfig.pending;
                     const StatusIcon = statusInfo.icon;

                     return (
                       <TableRow key={template.id}>
                         <TableCell className="font-medium text-sm">
                           {template.template_name}
                           <div className="text-xs text-muted-foreground mt-0.5">
                             {template.language.toUpperCase()}
                           </div>
                         </TableCell>
                         <TableCell>
                           <TooltipProvider>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <p className="text-sm text-muted-foreground truncate max-w-[400px] cursor-default">
                                   {template.content}
                                 </p>
                               </TooltipTrigger>
                               <TooltipContent side="bottom" className="max-w-[500px] whitespace-pre-wrap">
                                 <p className="text-sm">{template.content}</p>
                                 {template.rejection_reason && (
                                   <p className="text-xs text-red-400 mt-2">
                                     Rejection: {template.rejection_reason}
                                   </p>
                                 )}
                               </TooltipContent>
                             </Tooltip>
                           </TooltipProvider>
                         </TableCell>
                         <TableCell>
                           <Badge variant="outline" className="text-xs">
                             {template.category || "UTILITY"}
                           </Badge>
                         </TableCell>
                         <TableCell>
                           <Badge variant={statusInfo.variant} className="text-xs">
                             <StatusIcon className="h-3 w-3 mr-1" />
                             {template.status}
                           </Badge>
                         </TableCell>
                         <TableCell className="text-center text-sm text-muted-foreground">
                           {template.variables.length || "-"}
                         </TableCell>
                         <TableCell>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-7 w-7 text-muted-foreground hover:text-destructive"
                             onClick={() => setDeleteTarget({ id: template.id, name: template.template_name })}
                             disabled={isDeleting}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                 </TableBody>
               </Table>
             </div>
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
