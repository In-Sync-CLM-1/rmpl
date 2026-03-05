import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { useOnboardingContext } from "./OnboardingProvider";

export function FeatureAnnouncementBanner() {
  const { currentTour, startTour, dismissOnboarding, shouldShowOnboarding } = useOnboardingContext();

  if (
    !shouldShowOnboarding ||
    !currentTour ||
    currentTour.tour_type !== "feature_update"
  ) {
    return null;
  }

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Sparkles className="h-4 w-4 text-primary" />
      <div className="flex items-center justify-between gap-4 flex-1">
        <div>
          <AlertTitle className="text-base">{currentTour.title}</AlertTitle>
          <AlertDescription>{currentTour.description}</AlertDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => startTour(currentTour)} size="sm">
            See What's New
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismissOnboarding}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
