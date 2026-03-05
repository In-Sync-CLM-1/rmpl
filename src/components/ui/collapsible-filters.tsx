import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

interface CollapsibleFiltersProps {
  children: ReactNode;
  activeFilterCount?: number;
  onReset?: () => void;
  className?: string;
  defaultOpen?: boolean;
}

export function CollapsibleFilters({
  children,
  activeFilterCount = 0,
  onReset,
  className,
  defaultOpen = false,
}: CollapsibleFiltersProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(defaultOpen || !isMobile);

  // On desktop, always show filters
  if (!isMobile) {
    return (
      <Card className={className}>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {children}
          </div>
        </CardContent>
      </Card>
    );
  }

  // On mobile, use collapsible
  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-3 flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex-1 justify-start gap-2 h-auto py-2 px-3">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          {activeFilterCount > 0 && onReset && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onReset}
              className="shrink-0 text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3">
            <div className="grid grid-cols-1 gap-3">
              {children}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
