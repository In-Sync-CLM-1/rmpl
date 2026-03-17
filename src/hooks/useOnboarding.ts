import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OnboardingStep {
  id: string;
  tour_id: string;
  step_order: number;
  title: string;
  content: string;
  target_element: string | null;
  target_route: string | null;
  image_url: string | null;
  action_label: string;
}

export interface OnboardingTour {
  id: string;
  title: string;
  description: string | null;
  version: number;
  tour_type: "initial" | "feature_update";
  target_roles: string[] | null;
  is_active: boolean;
  steps?: OnboardingStep[];
}

export interface OnboardingProgress {
  id: string;
  user_id: string;
  tour_id: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  current_step_id: string | null;
  completed_at: string | null;
}

export function useOnboarding() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTour, setCurrentTour] = useState<OnboardingTour | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  const fetchPendingTour = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile to check onboarding status
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, last_tour_version_seen")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      // Check for incomplete initial tour or new feature tours
      const { data: tours } = await supabase
        .from("onboarding_tours")
        .select("*, onboarding_steps(*)")
        .eq("is_active", true)
        .order("version", { ascending: false });

      if (!tours || tours.length === 0) {
        setIsLoading(false);
        return;
      }

      // Find a tour that user hasn't completed
      let tourToShow: OnboardingTour | null = null;

      for (const tour of tours) {
        const { data: userProgress } = await supabase
          .from("user_onboarding_progress")
          .select("*")
          .eq("user_id", user.id)
          .eq("tour_id", tour.id)
          .maybeSingle();

        // Show initial tour if not completed
        if (tour.tour_type === "initial" && (!userProgress || userProgress.status !== "completed")) {
          tourToShow = tour as OnboardingTour;
          setProgress(userProgress);
          break;
        }

        // Show feature update if version is newer than last seen
        if (
          tour.tour_type === "feature_update" &&
          tour.version > (profile.last_tour_version_seen || 0) &&
          (!userProgress || userProgress.status !== "completed")
        ) {
          tourToShow = tour as OnboardingTour;
          setProgress(userProgress);
          break;
        }
      }

      if (tourToShow) {
        // Sort steps by step_order
        const sortedSteps = (tourToShow.steps || []).sort((a, b) => a.step_order - b.step_order);
        tourToShow.steps = sortedSteps;
        
        setCurrentTour(tourToShow);
        
        // Set current step based on progress or start from beginning
        const stepIndex = progress?.current_step_id
          ? sortedSteps.findIndex(s => s.id === progress.current_step_id)
          : 0;
        
        setCurrentStepIndex(stepIndex >= 0 ? stepIndex : 0);
        setCurrentStep(sortedSteps[stepIndex >= 0 ? stepIndex : 0] || null);
        setShouldShowOnboarding(true);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching onboarding tour:", error);
      setIsLoading(false);
    }
  }, [progress]);

  useEffect(() => {
    fetchPendingTour();
  }, []);

  const startTour = useCallback(async (tour: OnboardingTour) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sortedSteps = (tour.steps || []).sort((a, b) => a.step_order - b.step_order);
      tour.steps = sortedSteps;

      // Create or update progress
      const { data: existingProgress } = await supabase
        .from("user_onboarding_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("tour_id", tour.id)
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from("user_onboarding_progress")
          .update({
            status: "in_progress",
            current_step_id: sortedSteps[0]?.id,
          })
          .eq("id", existingProgress.id);
        setProgress({ ...existingProgress, status: "in_progress" });
      } else {
        const { data: newProgress } = await supabase
          .from("user_onboarding_progress")
          .insert({
            user_id: user.id,
            tour_id: tour.id,
            status: "in_progress",
            current_step_id: sortedSteps[0]?.id,
          })
          .select()
          .single();
        setProgress(newProgress);
      }

      setCurrentTour(tour);
      setCurrentStepIndex(0);
      setCurrentStep(sortedSteps[0] || null);
      setShouldShowOnboarding(true);
    } catch (error) {
      console.error("Error starting tour:", error);
      toast.error("Failed to start tour");
    }
  }, []);

  const nextStep = useCallback(async () => {
    if (!currentTour?.steps || !progress) return;

    const nextIndex = currentStepIndex + 1;
    
    if (nextIndex >= currentTour.steps.length) {
      // Tour completed
      await completeTour();
      return;
    }

    const nextStepData = currentTour.steps[nextIndex];
    
    try {
      await supabase
        .from("user_onboarding_progress")
        .update({
          current_step_id: nextStepData.id,
        })
        .eq("id", progress.id);

      setCurrentStepIndex(nextIndex);
      setCurrentStep(nextStepData);
    } catch (error) {
      console.error("Error moving to next step:", error);
      toast.error("Failed to save progress");
    }
  }, [currentTour, currentStepIndex, progress]);

  const previousStep = useCallback(async () => {
    if (!currentTour?.steps || !progress || currentStepIndex === 0) return;

    const prevIndex = currentStepIndex - 1;
    const prevStepData = currentTour.steps[prevIndex];
    
    try {
      await supabase
        .from("user_onboarding_progress")
        .update({
          current_step_id: prevStepData.id,
        })
        .eq("id", progress.id);

      setCurrentStepIndex(prevIndex);
      setCurrentStep(prevStepData);
    } catch (error) {
      console.error("Error moving to previous step:", error);
      toast.error("Failed to save progress");
    }
  }, [currentTour, currentStepIndex, progress]);

  const skipTour = useCallback(async () => {
    if (!progress) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_onboarding_progress")
        .update({
          status: "skipped",
        })
        .eq("id", progress.id);

      await supabase
        .from("profiles")
        .update({
          onboarding_skipped: true,
        })
        .eq("id", user.id);

      setShouldShowOnboarding(false);
      setCurrentTour(null);
      setCurrentStep(null);
      toast.info("Onboarding skipped. You can replay it anytime from the help menu.");
    } catch (error) {
      console.error("Error skipping tour:", error);
      toast.error("Failed to skip tour");
    }
  }, [progress]);

  const completeTour = useCallback(async () => {
    if (!progress || !currentTour) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_onboarding_progress")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", progress.id);

      await supabase
        .from("profiles")
        .update({
          onboarding_completed: currentTour.tour_type === "initial",
          last_tour_version_seen: currentTour.version,
        })
        .eq("id", user.id);

      setShouldShowOnboarding(false);
      setCurrentTour(null);
      setCurrentStep(null);
      toast.success("Tour completed! 🎉");
    } catch (error) {
      console.error("Error completing tour:", error);
      toast.error("Failed to complete tour");
    }
  }, [progress, currentTour]);

  const dismissOnboarding = useCallback(() => {
    setShouldShowOnboarding(false);
  }, []);

  return {
    isLoading,
    currentTour,
    currentStep,
    currentStepIndex,
    shouldShowOnboarding,
    startTour,
    nextStep,
    previousStep,
    skipTour,
    completeTour,
    dismissOnboarding,
    refetch: fetchPendingTour,
  };
}
