import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, MapPin } from 'lucide-react';
import { useCompanyHolidays, CompanyHoliday } from '@/hooks/useCompanyHolidays';
import { parseLocalDateString } from '@/lib/dateUtils';

interface HolidayListProps {
  year?: number;
  showAllLocations?: boolean;
  maxHeight?: string;
}

export const HolidayList = ({ 
  year = new Date().getFullYear(), 
  showAllLocations = false,
  maxHeight = '400px'
}: HolidayListProps) => {
  const { holidays, applicableHolidays, userLocation, isLoading } = useCompanyHolidays(year);

  const displayHolidays = showAllLocations ? holidays : applicableHolidays;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Holiday Calendar {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getLocationBadgeVariant = (locations: string[]) => {
    if (locations.includes('all') || locations.length === 3) return 'default';
    return 'secondary';
  };

  const isApplicableToUser = (holiday: CompanyHoliday) => {
    if (!holiday.applicable_locations) return true;
    if (holiday.applicable_locations.includes('all')) return true;
    return holiday.applicable_locations.includes(userLocation || 'Delhi');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Holiday Calendar {year}
          </span>
          {!showAllLocations && userLocation && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {userLocation}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea style={{ maxHeight }} className="pr-4">
          <div className="space-y-2">
            {displayHolidays.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No holidays found for {year}
              </p>
            ) : (
              displayHolidays.map((holiday) => {
                const holidayDate = parseLocalDateString(holiday.holiday_date);
                const isPast = holidayDate < new Date();
                const isApplicable = isApplicableToUser(holiday);

                return (
                  <div
                    key={holiday.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isPast 
                        ? 'bg-muted/50 text-muted-foreground' 
                        : isApplicable 
                          ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                          : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-center min-w-[50px] ${isPast ? 'opacity-60' : ''}`}>
                        <div className="text-2xl font-bold leading-none">
                          {format(holidayDate, 'd')}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase">
                          {format(holidayDate, 'MMM')}
                        </div>
                      </div>
                      <div>
                        <div className={`font-medium ${!isApplicable && showAllLocations ? 'text-muted-foreground' : ''}`}>
                          {holiday.holiday_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {holiday.day_of_week || format(holidayDate, 'EEEE')}
                          {holiday.notes && ` • ${holiday.notes}`}
                        </div>
                      </div>
                    </div>
                    {showAllLocations && (
                      <div className="flex gap-1 flex-wrap justify-end">
                        {holiday.applicable_locations?.map(loc => (
                          <Badge 
                            key={loc} 
                            variant={loc === userLocation ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {loc === 'all' ? 'All' : loc.slice(0, 3)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
