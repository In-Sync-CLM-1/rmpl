 import { useState, useEffect } from "react";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Badge } from "@/components/ui/badge";
 import { Loader2, Send, FileText, MessageSquare } from "lucide-react";
 import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
 import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
 
 interface SendWhatsAppDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   demandcomId?: string;
   contactName?: string;
   phoneNumber: string;
   onMessageSent?: () => void;
 }
 
 export function SendWhatsAppDialog({
   open,
   onOpenChange,
   demandcomId,
   contactName,
   phoneNumber,
   onMessageSent,
 }: SendWhatsAppDialogProps) {
   const [messageType, setMessageType] = useState<"template" | "text">("template");
   const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
   const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
   const [customMessage, setCustomMessage] = useState("");
 
   const { templates, isLoading: templatesLoading } = useWhatsAppTemplates(true);
   const { sendMessage, isSending } = useWhatsAppMessages(demandcomId, phoneNumber);
 
   const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
 
   // Reset form when dialog opens
   useEffect(() => {
     if (open) {
       setMessageType("template");
       setSelectedTemplateId("");
       setTemplateVariables({});
       setCustomMessage("");
     }
   }, [open]);
 
   // Extract variables from template content when template changes
   useEffect(() => {
     if (selectedTemplate) {
       const vars: Record<string, string> = {};
       selectedTemplate.variables.forEach((v) => {
         vars[String(v.index)] = "";
       });
       setTemplateVariables(vars);
     }
   }, [selectedTemplate]);
 
   const handleSend = () => {
     if (messageType === "template" && selectedTemplateId) {
       // Build template components
       const bodyParams = Object.values(templateVariables).map((value) => ({
         type: "text" as const,
         text: value,
       }));
 
       sendMessage(
         {
           phoneNumber,
           demandcomId,
           templateId: selectedTemplateId,
           templateVariables,
           templateComponents:
             bodyParams.length > 0
               ? [{ type: "body", parameters: bodyParams }]
               : undefined,
         },
         {
           onSuccess: () => {
             onOpenChange(false);
             onMessageSent?.();
           },
         }
       );
     } else if (messageType === "text" && customMessage.trim()) {
       sendMessage(
         {
           phoneNumber,
           demandcomId,
           message: customMessage.trim(),
         },
         {
           onSuccess: () => {
             onOpenChange(false);
             onMessageSent?.();
           },
         }
       );
     }
   };
 
   const canSend =
     (messageType === "template" && selectedTemplateId) ||
     (messageType === "text" && customMessage.trim());
 
   const getPreviewContent = () => {
     if (!selectedTemplate) return "";
     let preview = selectedTemplate.content;
     Object.entries(templateVariables).forEach(([key, value]) => {
       preview = preview.replace(`{{${key}}}`, value || `{{${key}}}`);
     });
     return preview;
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-[700px]">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <MessageSquare className="h-5 w-5 text-green-500" />
             Send WhatsApp Message
           </DialogTitle>
           <DialogDescription>
             {contactName ? `To: ${contactName} (${phoneNumber})` : `To: ${phoneNumber}`}
           </DialogDescription>
         </DialogHeader>
 
         <Tabs value={messageType} onValueChange={(v) => setMessageType(v as "template" | "text")}>
           <TabsList className="grid w-full grid-cols-2">
             <TabsTrigger value="template" className="flex items-center gap-2">
               <FileText className="h-4 w-4" />
               Template
             </TabsTrigger>
             <TabsTrigger value="text" className="flex items-center gap-2">
               <MessageSquare className="h-4 w-4" />
               Custom Text
             </TabsTrigger>
           </TabsList>
 
           <TabsContent value="template" className="space-y-4 mt-4">
             <div className="space-y-2">
               <Label>Select Template</Label>
               <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                 <SelectTrigger>
                   <SelectValue placeholder={templatesLoading ? "Loading..." : "Choose a template"} />
                 </SelectTrigger>
                 <SelectContent>
                   {templates.map((template) => (
                     <SelectItem key={template.id} value={template.id}>
                       <div className="flex items-center gap-2">
                         <span>{template.template_name}</span>
                         <Badge variant="outline" className="text-xs">
                           {template.category}
                         </Badge>
                       </div>
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {selectedTemplate && selectedTemplate.variables.length > 0 && (
               <div className="space-y-3">
                 <Label>Template Variables</Label>
                 {selectedTemplate.variables.map((variable) => (
                   <div key={variable.index} className="space-y-1">
                     <Label className="text-xs text-muted-foreground">
                       Variable {variable.index} ({variable.placeholder})
                     </Label>
                     <Input
                       value={templateVariables[String(variable.index)] || ""}
                       onChange={(e) =>
                         setTemplateVariables((prev) => ({
                           ...prev,
                           [String(variable.index)]: e.target.value,
                         }))
                       }
                       placeholder={`Enter value for ${variable.placeholder}`}
                     />
                   </div>
                 ))}
               </div>
             )}
 
             {selectedTemplate && (
               <div className="space-y-2">
                 <Label>Preview</Label>
                 <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap break-words overflow-hidden">
                   {getPreviewContent()}
                 </div>
               </div>
             )}
           </TabsContent>
 
           <TabsContent value="text" className="space-y-4 mt-4">
             <div className="space-y-2">
               <Label>Message</Label>
               <Textarea
                 value={customMessage}
                 onChange={(e) => setCustomMessage(e.target.value)}
                 placeholder="Type your message here..."
                 rows={4}
               />
               <p className="text-xs text-muted-foreground">
                 Note: Custom text messages require a 24-hour conversation window with the recipient.
               </p>
             </div>
           </TabsContent>
         </Tabs>
 
         <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Cancel
           </Button>
           <Button onClick={handleSend} disabled={!canSend || isSending}>
             {isSending ? (
               <>
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 Sending...
               </>
             ) : (
               <>
                 <Send className="h-4 w-4 mr-2" />
                 Send Message
               </>
             )}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }