import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

interface MobileCardField {
  label: string;
  value: ReactNode;
  className?: string;
}

interface MobileCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  fields?: MobileCardField[];
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  onClick,
  className,
}: MobileCardProps) {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors' : ''} ${className || ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-medium text-sm sm:text-base truncate">{title}</div>
              {badge}
            </div>
            {subtitle && (
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {actions && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
            {onClick && !actions && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        
        {fields && fields.length > 0 && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
            {fields.map((field, idx) => (
              <div key={idx} className={field.className}>
                <div className="text-xs text-muted-foreground">{field.label}</div>
                <div className="text-sm font-medium truncate">{field.value}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MobileCardListProps {
  children: ReactNode;
  className?: string;
}

export function MobileCardList({ children, className }: MobileCardListProps) {
  return (
    <div className={`space-y-2 sm:space-y-3 ${className || ''}`}>
      {children}
    </div>
  );
}
