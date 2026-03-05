import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Play } from "lucide-react";
import { useOnboardingContext } from "./OnboardingProvider";

export function OnboardingChecklist() {
  const { currentTour, currentStepIndex, startTour, isLoading } = useOnboardingContext();

  if (isLoading || !currentTour) {
    return null;
  }

  const totalSteps = currentTour.steps?.length || 0;
  const completedSteps = currentStepIndex;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Getting Started</CardTitle>
            <CardDescription>
              {completedSteps} of {totalSteps} steps completed
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => startTour(currentTour)}
          >
            <Play className="h-3 w-3 mr-1" />
            Continue
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} />
        
        <div className="space-y-2">
          {currentTour.steps?.slice(0, 5).map((step, index) => (
            <div
              key={step.id}
              className="flex items-center gap-2 text-sm"
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  index < completedSteps
                    ? "bg-primary text-primary-foreground"
                    : index === completedSteps
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index < completedSteps ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              <span
                className={
                  index <= completedSteps
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
