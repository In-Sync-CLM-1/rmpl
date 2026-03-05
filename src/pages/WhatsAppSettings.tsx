 import { PageHeader } from "@/components/ui/page-header";
 import { WhatsAppSettingsForm } from "@/components/whatsapp/WhatsAppSettingsForm";
 import { WhatsAppTemplateList } from "@/components/whatsapp/WhatsAppTemplateList";
 import { MessageCircle } from "lucide-react";
 
 export default function WhatsAppSettings() {
   return (
     <div className="container mx-auto py-6 space-y-6">
       <PageHeader
         title="WhatsApp Settings"
         subtitle="Configure your WhatsApp Business API integration"
         icon={MessageCircle}
       />
 
       <div className="grid gap-6 lg:grid-cols-2">
         <div className="space-y-6">
           <WhatsAppSettingsForm />
         </div>
         <div>
           <WhatsAppTemplateList />
         </div>
       </div>
     </div>
   );
 }