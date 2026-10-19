import * as React from "react";
import { ResponsiveContainer, Tooltip, type TooltipContentProps } from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: React.ReactNode; color: string }>;

const ChartContext = React.createContext<ChartConfig | null>(null);

function useChartConfig() {
  const config = React.useContext(ChartContext);
  if (!config) throw new Error("Chart parts must be rendered inside <ChartContainer />");
  return config;
}

// Series colours are exposed as --color-<key> custom properties on the wrapper,
// so bars can use fill="var(--color-income)" without injecting a <style> tag.
function ChartContainer({
  className,
  children,
  config,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  config: ChartConfig;
  children: React.ReactElement;
}) {
  const colorVars = Object.fromEntries(
    Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color]),
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={config}>
      <div
        data-slot="chart"
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-hidden",
          className,
        )}
        style={{ ...colorVars, ...style }}
        {...props}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartTooltip = Tooltip;

function ChartTooltipContent({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  const config = useChartConfig();
  if (!active || !payload?.length) return null;

  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {label != null && <div className="font-medium">{String(label)}</div>}
      {payload.map(item => {
        const key = String(item.dataKey ?? item.name ?? "");
        const entry = config[key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: entry?.color ?? item.color }}
            />
            <span className="flex-1 text-muted-foreground">{entry?.label ?? item.name}</span>
            {item.value != null && (
              <span className="font-mono font-medium tabular-nums text-foreground">
                {Number(item.value).toLocaleString()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
