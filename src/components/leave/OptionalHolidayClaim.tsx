import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Gift, CalendarDays, Cake, Heart, PartyPopper, Check, Trash2 } from 'lucide-react';
import { useCompanyHolidays } from '@/hooks/useCompanyHolidays';
import { cn } from '@/lib/utils';

const OPTIONAL_HOLIDAY_TYPES = [
  {
    id: 'birthday',
    label: 'Self Birthday',
    icon: Cake,
    description: 'Take a day off on your birthday',
  },
  {
    id: 'anniversary',
    label: 'Marriage Anniversary',
    icon: Heart,
    description: 'Celebrate your special day',
  },
  {
    id: 'regional_festival',
    label: 'Regional Festival',
    icon: PartyPopper,
    description: 'Any festival of your choice',
  },
];

export const OptionalHolidayClaim = () => {
  const currentYear = new Date().getFullYear();
  const { userClaims, claimOptionalHoliday, deleteOptionalHolidayClaim, remainingOptionalHolidays, isLoading } = useCompanyHolidays(currentYear);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClaim = () => {
    if (!selectedType || !selectedDate) return;

    claimOptionalHoliday.mutate(
      { claimType: selectedType, claimDate: format(selectedDate, 'yyyy-MM-dd') },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedType(null);
          setSelectedDate(undefined);
        },
      }
    );
  };

  const openClaimDialog = (typeId: string) => {
    setSelectedType(typeId);
    setSelectedDate(undefined);
    setDialogOpen(true);
  };

  const getClaimForType = (typeId: string) => {
    return userClaims.find(c => c.claim_type === typeId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5" />
            Optional Holidays
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Optional Holidays
            </span>
            <Badge variant={remainingOptionalHolidays > 0 ? 'default' : 'secondary'}>
              {userClaims.length}/2 claimed
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can claim up to 2 optional holidays per year for special occasions.
          </p>

          {OPTIONAL_HOLIDAY_TYPES.map((type) => {
            const claim = getClaimForType(type.id);
            const Icon = type.icon;

            return (
              <div
                key={type.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-colors',
                  claim ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-full',
                    claim ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-muted'
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {type.label}
                      {claim && <Check className="h-4 w-4 text-green-600" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {claim ? (
                        <>Claimed for {format(new Date(claim.claim_date!), 'MMM d, yyyy')}</>
                      ) : (
                        type.description
                      )}
                    </div>
                  </div>
                </div>

                {claim ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteOptionalHolidayClaim.mutate(claim.id)}
                    disabled={deleteOptionalHolidayClaim.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openClaimDialog(type.id)}
                    disabled={remainingOptionalHolidays <= 0}
                  >
                    <CalendarDays className="h-4 w-4 mr-1" />
                    Claim
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Claim Optional Holiday - {OPTIONAL_HOLIDAY_TYPES.find(t => t.id === selectedType)?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Select the date for your optional holiday. This date will be marked as a holiday for you without any leave deduction.
            </p>

            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date.getFullYear() !== currentYear}
                className="rounded-md border"
              />
            </div>

            {selectedDate && (
              <p className="text-center text-sm">
                Selected: <span className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleClaim} 
              disabled={!selectedDate || claimOptionalHoliday.isPending}
            >
              {claimOptionalHoliday.isPending ? 'Claiming...' : 'Confirm Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
