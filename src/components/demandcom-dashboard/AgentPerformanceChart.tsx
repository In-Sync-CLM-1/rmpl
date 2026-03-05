import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DemandComDashboardMetrics } from "@/hooks/useDemandComDashboard";

interface AgentPerformanceChartProps {
  data: DemandComDashboardMetrics['topAgents'];
}

export function AgentPerformanceChart({ data }: AgentPerformanceChartProps) {
  const chartData = data.map(agent => ({
    name: agent.name.split(' ').slice(0, 2).join(' '), // First 2 names
    assigned: agent.totalAssigned,
    tagged: agent.taggedCount,
    efficiency: agent.efficiency,
  }));

  const getBarColor = (efficiency: number) => {
    if (efficiency >= 40) return '#10b981'; // Green
    if (efficiency >= 25) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Agent Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" fontSize={12} />
            <YAxis 
              dataKey="name" 
              type="category" 
              stroke="#64748b" 
              fontSize={12}
              width={120}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                backgroundColor: 'white'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'efficiency') return [`${value}%`, 'Efficiency'];
                return [value.toLocaleString(), name === 'assigned' ? 'Assigned' : 'Tagged'];
              }}
            />
            <Bar dataKey="assigned" fill="#cbd5e1" name="Assigned" radius={[0, 4, 4, 0]} />
            <Bar dataKey="tagged" name="Tagged" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.efficiency)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
