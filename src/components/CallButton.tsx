import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { EnhancedCallDialog } from "./EnhancedCallDialog";

interface CallButtonProps {
  phoneNumber: string;
  demandcomId?: string;
  demandcomName?: string;
  demandcomData?: any;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function CallButton({
  phoneNumber,
  demandcomId,
  demandcomName,
  demandcomData,
  variant = "outline",
  size = "sm",
  showLabel = true,
}: CallButtonProps) {
  const [showEnhancedDialog, setShowEnhancedDialog] = useState(false);

  // Don't render if no phone number
  if (!phoneNumber) {
    return null;
  }

  // Prepare demandcom data with required fields
  const callData = demandcomData || {
    id: demandcomId || "",
    name: demandcomName || "",
    mobile_numb: phoneNumber,
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowEnhancedDialog(true)}
      >
        <Phone className="h-4 w-4" />
        {showLabel && <span className="ml-2">Call</span>}
      </Button>

      <EnhancedCallDialog
        open={showEnhancedDialog}
        onOpenChange={setShowEnhancedDialog}
        demandcomData={callData}
      />
    </>
  );
}
