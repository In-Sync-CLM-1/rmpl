import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboardingContext } from "./OnboardingProvider";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function OnboardingModal() {
  const {
    shouldShowOnboarding,
    currentTour,
    currentStep,
    currentStepIndex,
    nextStep,
    previousStep,
    skipTour,
    completeTour,
  } = useOnboardingContext();

  if (!shouldShowOnboarding || !currentTour || !currentStep) {
    return null;
  }

  const totalSteps = currentTour.steps?.length || 0;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <Dialog open={shouldShowOnboarding} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{currentStep.title}</DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {currentStep.content}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={skipTour}
              className="ml-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {currentStep.image_url && (
          <div className="my-4 rounded-lg overflow-hidden border">
            <img
              src={currentStep.image_url}
              alt={currentStep.title}
              className="w-full h-auto"
            />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Step {currentStepIndex + 1} of {totalSteps}</span>
            <Progress value={progress} className="flex-1" />
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={skipTour}
            >
              Skip Tour
            </Button>
            
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={previousStep}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
              )}
              
              <Button
                onClick={isLastStep ? completeTour : nextStep}
              >
                {isLastStep ? "Finish" : currentStep.action_label || "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
