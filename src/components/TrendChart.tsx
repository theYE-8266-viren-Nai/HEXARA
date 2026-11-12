import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricCardData } from "../types/horizon";

type TrendMetric = Pick<MetricCardData, "label" | "baseline" | "points">;

export function TrendChart({ metric }: { metric: TrendMetric }) {
  return (
    <div className="h-48" role="img" aria-label={`${metric.label} trend chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={metric.points} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 10 }} />
          <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "var(--text-secondary)" }} itemStyle={{ color: "var(--text-primary)" }} />
          <ReferenceLine y={metric.baseline} stroke="var(--chart-baseline)" strokeDasharray="4 5" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-line)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={({ cx, cy, payload }) => (
              <circle key={payload.day} cx={cx} cy={cy} r={payload.alert ? 4 : 2} fill={payload.alert ? "var(--chart-alert)" : "var(--chart-line)"} />
            )}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
