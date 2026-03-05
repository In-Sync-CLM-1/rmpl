 import { useState, useEffect } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
 import { Badge } from "@/components/ui/badge";
 import { Loader2, Save, RefreshCw, MessageCircle, Phone, Key, Globe, CheckCircle2 } from "lucide-react";
 import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
 
 export function WhatsAppSettingsForm() {
   const { settings, isLoading, saveSettings, isSaving, syncTemplates, isSyncing } = useWhatsAppSettings();
 
   const [formData, setFormData] = useState({
     whatsapp_source_number: "",
     waba_id: "",
     exotel_subdomain: "api.exotel.com",
     is_active: false,
   });
 
   useEffect(() => {
     if (settings) {
       setFormData({
         whatsapp_source_number: settings.whatsapp_source_number || "",
         waba_id: settings.waba_id || "",
         exotel_subdomain: settings.exotel_subdomain || "api.exotel.com",
         is_active: settings.is_active || false,
       });
     }
   }, [settings]);
 
   const handleSave = () => {
     saveSettings(formData);
   };
 
   const handleSyncTemplates = () => {
     syncTemplates();
   };
 
   if (isLoading) {
     return (
       <Card>
         <CardContent className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-6">
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle className="flex items-center gap-2">
                 <MessageCircle className="h-5 w-5 text-green-500" />
                 WhatsApp Business Configuration
               </CardTitle>
               <CardDescription>
                 Configure your WhatsApp Business API integration with Exotel
               </CardDescription>
             </div>
             {settings?.is_active && (
               <Badge variant="default" className="bg-green-500">
                 <CheckCircle2 className="h-3 w-3 mr-1" />
                 Active
               </Badge>
             )}
           </div>
         </CardHeader>
         <CardContent className="space-y-6">
           <div className="grid gap-4 md:grid-cols-2">
             <div className="space-y-2">
               <Label htmlFor="whatsapp_number" className="flex items-center gap-2">
                 <Phone className="h-4 w-4" />
                 WhatsApp Business Number
               </Label>
               <Input
                 id="whatsapp_number"
                 value={formData.whatsapp_source_number}
                 onChange={(e) =>
                   setFormData((prev) => ({ ...prev, whatsapp_source_number: e.target.value }))
                 }
                 placeholder="+919876543210"
               />
               <p className="text-xs text-muted-foreground">
                 Your registered WhatsApp Business number with country code
               </p>
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="waba_id" className="flex items-center gap-2">
                 <Key className="h-4 w-4" />
                 WABA ID
               </Label>
               <Input
                 id="waba_id"
                 value={formData.waba_id}
                 onChange={(e) =>
                   setFormData((prev) => ({ ...prev, waba_id: e.target.value }))
                 }
                 placeholder="Enter your WABA ID"
               />
               <p className="text-xs text-muted-foreground">
                 WhatsApp Business Account ID from Exotel dashboard
               </p>
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="subdomain" className="flex items-center gap-2">
                 <Globe className="h-4 w-4" />
                 Exotel Subdomain
               </Label>
               <Input
                 id="subdomain"
                 value={formData.exotel_subdomain}
                 onChange={(e) =>
                   setFormData((prev) => ({ ...prev, exotel_subdomain: e.target.value }))
                 }
                 placeholder="api.exotel.com"
               />
               <p className="text-xs text-muted-foreground">
                 Regional API subdomain (default: api.exotel.com)
               </p>
             </div>
 
             <div className="space-y-2">
               <Label className="flex items-center gap-2">Enable WhatsApp</Label>
               <div className="flex items-center space-x-2 pt-2">
                 <Switch
                   checked={formData.is_active}
                   onCheckedChange={(checked) =>
                     setFormData((prev) => ({ ...prev, is_active: checked }))
                   }
                 />
                 <Label className="text-sm text-muted-foreground">
                   {formData.is_active ? "WhatsApp messaging is enabled" : "WhatsApp messaging is disabled"}
                 </Label>
               </div>
             </div>
           </div>
 
           <div className="flex items-center gap-3 pt-4 border-t">
             <Button onClick={handleSave} disabled={isSaving}>
               {isSaving ? (
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Saving...
                 </>
               ) : (
                 <>
                   <Save className="h-4 w-4 mr-2" />
                   Save Settings
                 </>
               )}
             </Button>
 
             <Button
               variant="outline"
               onClick={handleSyncTemplates}
               disabled={isSyncing || !settings?.is_active}
             >
               {isSyncing ? (
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Syncing...
                 </>
               ) : (
                 <>
                   <RefreshCw className="h-4 w-4 mr-2" />
                   Sync Templates
                 </>
               )}
             </Button>
           </div>
         </CardContent>
       </Card>
 
       <Card>
         <CardHeader>
           <CardTitle className="text-base">API Credentials</CardTitle>
           <CardDescription>
             Exotel API credentials are configured via environment variables
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="grid gap-4 md:grid-cols-3">
             <div className="p-3 bg-muted rounded-lg">
               <p className="text-xs text-muted-foreground">EXOTEL_SID</p>
               <p className="font-mono text-sm">••••••••</p>
             </div>
             <div className="p-3 bg-muted rounded-lg">
               <p className="text-xs text-muted-foreground">EXOTEL_API_KEY</p>
               <p className="font-mono text-sm">••••••••</p>
             </div>
             <div className="p-3 bg-muted rounded-lg">
               <p className="text-xs text-muted-foreground">EXOTEL_API_TOKEN</p>
               <p className="font-mono text-sm">••••••••</p>
             </div>
           </div>
           <p className="text-xs text-muted-foreground mt-3">
             These credentials are securely stored and not editable here. Contact admin to update.
           </p>
         </CardContent>
       </Card>
     </div>
   );
 }