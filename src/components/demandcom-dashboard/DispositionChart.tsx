import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";

interface DispositionChartProps {
  data: DemandComDashboardMetrics['dispositionBreakdown'];
}

const DISPOSITION_COLORS: Record<string, string> = {
  'Fully Validate': '#10b981',
  'Connected': '#3b82f6',
  'Partially Validate': '#eab308',
  'LTO': '#f59e0b',
  'IVC': '#ef4444',
  'Wrong Number': '#dc2626',
  'Company Closed': '#991b1b',
  'NR': '#94a3b8',
  'Not Connected': '#64748b',
};

const getDispositionColor = (disposition: string) => {
  return DISPOSITION_COLORS[disposition] || '#94a3b8';
};

export function DispositionChart({ data }: DispositionChartProps) {
  const chartData = data.map(item => ({
    name: item.disposition,
    value: item.count,
    percentage: item.percentage,
  }));

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Disposition Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getDispositionColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => value.toLocaleString()}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span className="text-sm">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
