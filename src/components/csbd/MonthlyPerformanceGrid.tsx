import { CSBDMetrics } from "@/hooks/useCSBDMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface MonthlyPerformanceGridProps {
  metrics: CSBDMetrics[];
  fiscalYear: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getFiscalMonthIndex = (calendarIdx: number, fiscalYear: number): number => {
  if (calendarIdx < 3) return calendarIdx + 9;
  return calendarIdx - 3;
};

const formatValue = (value: number) => {
  if (value === 0) return '–';
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
};

export const MonthlyPerformanceGrid = ({ metrics, fiscalYear }: MonthlyPerformanceGridProps) => {
  const allIndividuals = metrics.flatMap(m => {
    if (m.team_metrics && m.team_metrics.length > 0) {
      return [m, ...m.team_metrics];
    }
    return [m];
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
        <div>
          <CardTitle className="text-lg font-semibold">Monthly Performance</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">FY {fiscalYear - 1}-{fiscalYear.toString().slice(-2)}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="min-w-max">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30">
                  <th className="sticky left-0 bg-muted/30 backdrop-blur-sm px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider z-20 min-w-[180px] border-r border-border/50">
                    Team Member
                  </th>
                  {MONTHS.map((month, idx) => (
                    <th key={month} className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[100px]">
                      {month} '{idx < 3 ? String(fiscalYear).slice(-2) : String(fiscalYear - 1).slice(-2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {allIndividuals.map((person, personIdx) => (
                  <tr 
                    key={person.user_id} 
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="sticky left-0 bg-card/95 backdrop-blur-sm px-4 py-3 z-10 border-r border-border/50">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground"
                          style={{
                            background: `hsl(${(personIdx * 47) % 360}, 65%, 55%)`
                          }}
                        >
                          {getInitials(person.full_name)}
                        </div>
                        <span className="text-sm font-medium text-foreground">{person.full_name}</span>
                      </div>
                    </td>
                    {MONTHS.map((month, calendarIdx) => {
                      const fiscalIdx = getFiscalMonthIndex(calendarIdx, fiscalYear);
                      const monthData = person.monthly_performance?.[fiscalIdx];
                      const actual = monthData?.actual || 0;
                      const projection = monthData?.projection || 0;
                      const hasActual = actual > 0;
                      const variance = monthData?.over_under_percentage || 0;
                      
                      return (
                        <td key={month} className="px-3 py-3 text-center">
                          {hasActual ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-semibold text-foreground">
                                ₹{formatValue(actual)}L
                              </span>
                              <div className={`inline-flex items-center gap-1 text-xs font-medium ${
                                variance > 0 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : variance < 0 
                                    ? 'text-rose-600 dark:text-rose-400' 
                                    : 'text-muted-foreground'
                              }`}>
                                {variance > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : variance < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : (
                                  <Minus className="h-3 w-3" />
                                )}
                                <span>{variance > 0 ? '+' : ''}{variance.toFixed(0)}%</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                vs ₹{formatValue(projection)}L
                              </span>
                            </div>
                          ) : projection > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                ₹{formatValue(projection)}L
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 border-dashed">
                                Projected
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
