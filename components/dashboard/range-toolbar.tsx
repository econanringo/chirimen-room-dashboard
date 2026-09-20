"use client";

import { useState } from "react";
import { BarChart3, CalendarDays, LineChart } from "lucide-react";
import { ja } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RANGE_LABELS } from "@/lib/format";
import { RANGE_KEYS, type RangeKey } from "@/lib/readings";

type RangeToolbarProps = {
  range: RangeKey;
  end: Date;
  chartType: "line" | "bar";
  onRangeChange: (range: RangeKey) => void;
  onEndChange: (end: Date) => void;
  onChartTypeChange: (chartType: "line" | "bar") => void;
};

export function RangeToolbar({
  range,
  end,
  chartType,
  onRangeChange,
  onEndChange,
  onChartTypeChange,
}: RangeToolbarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        value={[range]}
        onValueChange={(next) => {
          const selected = next[0];
          if (selected && RANGE_KEYS.includes(selected as RangeKey)) {
            onRangeChange(selected as RangeKey);
          }
        }}
        variant="default"
        size="sm"
        spacing={0}
        className="flex-1 rounded-full bg-muted p-1"
      >
        {RANGE_KEYS.map((key) => (
          <ToggleGroupItem
            key={key}
            value={key}
            className="flex-1 rounded-full aria-pressed:bg-background aria-pressed:shadow-sm"
          >
            {RANGE_LABELS[key]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <Button variant="secondary" size="icon" aria-label="日付を選ぶ" />
          }
        >
          <CalendarDays className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-2">
          <Calendar
            mode="single"
            locale={ja}
            selected={end}
            onSelect={(date) => {
              if (date) {
                const next = new Date(date);
                next.setHours(23, 59, 59, 999);
                onEndChange(next);
                setCalendarOpen(false);
              }
            }}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="secondary"
        size="icon"
        aria-label={chartType === "line" ? "棒グラフに切替" : "折れ線グラフに切替"}
        onClick={() => onChartTypeChange(chartType === "line" ? "bar" : "line")}
      >
        {chartType === "line" ? (
          <BarChart3 className="size-4" />
        ) : (
          <LineChart className="size-4" />
        )}
      </Button>
    </div>
  );
}
