import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";
import { format } from "date-fns";

interface DailyTrendChartProps {
  data: DemandComDashboardMetrics['dailyTrends'];
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    'Total Calls': item.totalCalls,
    'Connected': item.connectedCalls,
  }));

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Calling Volume Over Time (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorTagged" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                backgroundColor: 'white'
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => <span className="text-sm">{value}</span>}
            />
            <Area 
              type="monotone" 
              dataKey="Total Calls" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorNew)" 
            />
            <Area 
              type="monotone" 
              dataKey="Connected" 
              stroke="#10b981" 
              fillOpacity={1} 
              fill="url(#colorTagged)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
