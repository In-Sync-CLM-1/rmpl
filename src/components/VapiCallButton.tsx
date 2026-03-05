import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useVapiMakeCall } from "@/hooks/useVapiCalls";

interface VapiCallButtonProps {
  phoneNumber: string;
  contactName?: string;
  demandcomId?: string;
  variant?: "default" | "ghost" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function VapiCallButton({
  phoneNumber,
  contactName,
  demandcomId,
  variant = "outline",
  size = "sm",
}: VapiCallButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const makeCall = useVapiMakeCall();

  const handleCall = () => {
    makeCall.mutate({
      phone_number: phoneNumber,
      contact_name: contactName,
      demandcom_id: demandcomId,
    });
    setShowConfirm(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowConfirm(true)}
        disabled={makeCall.isPending}
        title="Call via VAPI"
      >
        <Bot className="h-4 w-4 mr-1" />
        {size !== "icon" && "VAPI Call"}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Initiate VAPI Call</AlertDialogTitle>
            <AlertDialogDescription>
              This will initiate an automated voice call to{" "}
              <strong>{contactName || phoneNumber}</strong> ({phoneNumber}).
              The AI assistant will handle the conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCall}>
              Start Call
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
