import { createContext, useContext, ReactNode } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import type { OnboardingTour, OnboardingStep, OnboardingProgress } from "@/hooks/useOnboarding";

interface OnboardingContextType {
  isLoading: boolean;
  currentTour: OnboardingTour | null;
  currentStep: OnboardingStep | null;
  currentStepIndex: number;
  shouldShowOnboarding: boolean;
  startTour: (tour: OnboardingTour) => Promise<void>;
  nextStep: () => Promise<void>;
  previousStep: () => Promise<void>;
  skipTour: () => Promise<void>;
  completeTour: () => Promise<void>;
  dismissOnboarding: () => void;
  refetch: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const onboarding = useOnboarding();

  return (
    <OnboardingContext.Provider value={onboarding}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboardingContext must be used within OnboardingProvider");
  }
  return context;
}
