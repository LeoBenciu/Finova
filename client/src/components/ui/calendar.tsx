import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, SelectRangeEventHandler, SelectSingleEventHandler } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useState } from "react";

interface CalendarProps {
  setDate: (date: Date | undefined) => void;
  selected?: Date | undefined;
  showOutsideDays?: boolean;
  className?: string;
  classNames?: Record<string, string>;
  [key: string]: any;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  setDate,
  selected,
  ...props
}: CalendarProps) {
  const handleDateSelect: SelectSingleEventHandler = (date) => {
    setDate(date);
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      onSelect={handleDateSelect}
      selected={selected}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium text-[var(--text1)]",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 text-[var(--text3)] hover:text-[var(--text1)] hover:bg-[var(--background)]"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-x-1",
        head_row: "flex",
        head_cell: "text-[var(--text3)] rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal bg-[var(--background)] text-[var(--text1)] hover:bg-[var(--primaryLow)] hover:text-[var(--text1)] aria-selected:opacity-100"
        ),
        day_range_start:
          "day-range-start aria-selected:bg-[var(--primary)] aria-selected:text-[var(--primaryText)]",
        day_range_end:
          "day-range-end aria-selected:bg-[var(--primary)] aria-selected:text-[var(--primaryText)]",
        day_selected:
          "bg-[var(--primary)] text-[var(--primaryText)] hover:bg-[var(--primary-foreground)] hover:text-[var(--primaryText)] focus:bg-[var(--primary)] focus:text-[var(--primaryText)]",
        day_today: "bg-[var(--primaryLow)] text-[var(--text1)] font-bold",
        day_outside:
          "day-outside text-[var(--text4)] bg-transparent aria-selected:text-[var(--text4)]",
        day_disabled: "text-[var(--text4)] opacity-50",
        day_range_middle:
          "aria-selected:bg-[var(--primaryLow)] aria-selected:text-[var(--text1)]",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

function DateRangePicker() {
  const [range, setRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({
    from: undefined,
    to: undefined
  });

  const handleRangeSelect: SelectRangeEventHandler = (range) => {
    setRange(range || { from: undefined, to: undefined });
  };

  return (
    <div className="border rounded-md">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleRangeSelect}
        showOutsideDays={true}
        className="p-3"
      />
      <div className="p-3 border-t">
        <p>
          {range.from ? `From: ${range.from.toLocaleDateString()}` : "Select start date"}
          {range.to ? ` To: ${range.to.toLocaleDateString()}` : ""}
        </p>
      </div>
    </div>
  );
}

export { Calendar, DateRangePicker };