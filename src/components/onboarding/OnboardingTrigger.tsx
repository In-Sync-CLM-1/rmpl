import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpCircle, Play, Sparkles } from "lucide-react";
import { useOnboardingContext } from "./OnboardingProvider";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { OnboardingTour } from "@/hooks/useOnboarding";

export function OnboardingTrigger() {
  const { startTour } = useOnboardingContext();
  const [availableTours, setAvailableTours] = useState<OnboardingTour[]>([]);

  useEffect(() => {
    fetchTours();
  }, []);

  const fetchTours = async () => {
    const { data } = await supabase
      .from("onboarding_tours")
      .select("*, onboarding_steps(*)")
      .eq("is_active", true)
      .order("version", { ascending: false });

    if (data) {
      setAvailableTours(data as OnboardingTour[]);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Help & Tours</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableTours.map((tour) => (
          <DropdownMenuItem
            key={tour.id}
            onClick={() => startTour(tour)}
            className="cursor-pointer"
          >
            {tour.tour_type === "feature_update" ? (
              <Sparkles className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {tour.title}
          </DropdownMenuItem>
        ))}
        
        {availableTours.length === 0 && (
          <DropdownMenuItem disabled>
            No tours available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
