import { CSBDMetrics } from "@/hooks/useCSBDMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CumulativeYTDChartProps {
  metrics: CSBDMetrics[];
  fiscalYear: number;
}

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--secondary))',
  'hsl(var(--primary))',
];

export const CumulativeYTDChart = ({ metrics, fiscalYear }: CumulativeYTDChartProps) => {
  // Flatten all individuals including team members
  const allIndividuals = metrics.flatMap(m => {
    if (m.team_metrics && m.team_metrics.length > 0) {
      return [m, ...m.team_metrics];
    }
    return [m];
  });

  // Calculate cumulative data for each person
  const chartData = MONTHS.map((month, idx) => {
    const dataPoint: any = { month };
    
    allIndividuals.forEach((person) => {
      const monthlyData = person.monthly_performance || [];
      let cumulative = 0;
      
      // Sum up all actuals up to this month
      for (let i = 0; i <= idx; i++) {
        cumulative += monthlyData[i]?.actual || 0;
      }
      
      dataPoint[person.full_name.split(' ')[0]] = cumulative > 0 ? cumulative : null;
    });
    
    return dataPoint;
  });

  // Calculate total target for reference line
  const totalTarget = allIndividuals.reduce((sum, m) => sum + m.annual_target, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cumulative YTD Performance Trend</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Month-over-month cumulative actuals (₹ in Lakhs)
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Chart
        </Button>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
              formatter={(value: any) => [`₹${value?.toFixed(0)}L`, '']}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
            />
            
            {/* Reference line for total target */}
            <ReferenceLine 
              y={totalTarget} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="5 5"
              label={{ value: 'Annual Target', position: 'right', fill: 'hsl(var(--muted-foreground))' }}
            />
            
            {/* Lines for each person */}
            {allIndividuals.map((person, idx) => (
              <Line
                key={person.user_id}
                type="monotone"
                dataKey={person.full_name.split(' ')[0]}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
