import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronRight, MapPin } from 'lucide-react';
import { useCompanyHolidays } from '@/hooks/useCompanyHolidays';
import { useNavigate } from 'react-router-dom';

export const UpcomingHolidays = () => {
  const navigate = useNavigate();
  const { upcomingHolidays, userLocation, isLoading } = useCompanyHolidays();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming Holidays
          </span>
          {userLocation && (
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {userLocation}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcomingHolidays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming holidays in the next 3 months
          </p>
        ) : (
          <>
            {upcomingHolidays.slice(0, 5).map((holiday) => {
              const holidayDate = new Date(holiday.holiday_date);
              const daysUntil = Math.ceil((holidayDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[40px]">
                      <div className="text-lg font-bold leading-none text-primary">
                        {format(holidayDate, 'd')}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {format(holidayDate, 'MMM')}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{holiday.holiday_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {holiday.day_of_week || format(holidayDate, 'EEEE')}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                  </Badge>
                </div>
              );
            })}

            <Button
              variant="ghost"
              className="w-full mt-2 text-sm"
              onClick={() => navigate('/calendar')}
            >
              View Full Holiday Calendar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
