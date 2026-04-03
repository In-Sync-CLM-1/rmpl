import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, MapPin, Star, Check } from 'lucide-react';
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
  const { holidays, applicableHolidays, userLocation, availedHolidayIds, availOptionalHoliday, deleteOptionalHolidayClaim, userClaims, remainingOptionalHolidays, isLoading } = useCompanyHolidays(year);

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
                const isOptional = holiday.is_optional;
                const isAvailed = availedHolidayIds.has(holiday.id);
                const claimForHoliday = userClaims.find(c => c.holiday_id === holiday.id);

                return (
                  <div
                    key={holiday.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isPast
                        ? 'bg-muted/50 text-muted-foreground'
                        : isOptional && isAvailed
                          ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                          : isOptional
                            ? 'bg-amber-50/50 border-amber-200/50 dark:bg-amber-950/10 dark:border-amber-800/30'
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
                        <div className={`font-medium flex items-center gap-2 ${!isApplicable && showAllLocations ? 'text-muted-foreground' : ''}`}>
                          {holiday.holiday_name}
                          {isOptional && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:text-amber-400">
                              <Star className="h-2.5 w-2.5 mr-0.5" />
                              Optional
                            </Badge>
                          )}
                          {isAvailed && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">
                              <Check className="h-2.5 w-2.5 mr-0.5" />
                              Availed
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {holiday.day_of_week || format(holidayDate, 'EEEE')}
                          {holiday.notes && !isOptional && ` • ${holiday.notes}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOptional && isApplicable && !isPast && (
                        isAvailed && claimForHoliday ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive text-xs h-7"
                            onClick={() => deleteOptionalHolidayClaim.mutate(claimForHoliday.id)}
                            disabled={deleteOptionalHolidayClaim.isPending}
                          >
                            Remove
                          </Button>
                        ) : !isAvailed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                            onClick={() => availOptionalHoliday.mutate({ holidayId: holiday.id, holidayDate: holiday.holiday_date })}
                            disabled={remainingOptionalHolidays <= 0 || availOptionalHoliday.isPending}
                            title={remainingOptionalHolidays <= 0 ? 'You have already used 2 optional holidays this year' : 'Avail this optional holiday'}
                          >
                            Avail
                          </Button>
                        ) : null
                      )}
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
