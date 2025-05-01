import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { Calendar as Cal, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useSelector } from "react-redux";

interface MyDateRangePickerProps {
  dateRange: { from: string | undefined; to: string | undefined };
  setDateRange: Dispatch<SetStateAction<{ from: string | undefined; to: string | undefined }>>;
}

export function MyDateRangePicker({ dateRange, setDateRange }: MyDateRangePickerProps) {
  // Initialize date range from props
  const [range, setRange] = useState<{ 
    from: Date | undefined; 
    to: Date | undefined 
  }>({
    from: dateRange.from ? new Date(dateRange.from) : undefined,
    to: dateRange.to ? new Date(dateRange.to) : undefined
  });
  
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const language = useSelector((state:{user:{language:string}})=>state.user.language);
  
  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Update parent state when range changes
  const handleRangeSelect = (selectedRange: {
    from: Date | undefined;
    to?: Date | undefined;
  } | undefined) => {
    const newRange = selectedRange || { from: undefined, to: undefined };
    setRange({ from: newRange.from, to: newRange.to || undefined });
    
    setDateRange({
      from: newRange.from ? format(newRange.from, 'dd-MM-yyyy') : undefined,
      to: newRange.to ? format(newRange.to, 'dd-MM-yyyy') : undefined
    });
  };
  
  const displayText = () => {
    if (range.from && range.to) {
      return `${format(range.from, 'MMM dd')} - ${format(range.to, 'MMM dd, yyyy')}`;
    } else if (range.from) {
      return `From: ${format(range.from, 'MMM dd, yyyy')}`;
    }
    return language==='ro'?'Selecteaza interval date':'Select date range';
  };
  
  return (
    <div className="relative">
      <button 
        className="rounded-2xl bg-[var(--foreground)]
        flex items-center gap-3 min-h-9 max-h-9 px-3
        shadow-[0_0_15px_rgba(0,0,0,0.3)]
        text-[var(--text1)]"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
      >
        {displayText()}
        <Cal size={20} />
      </button>
      
      {isCalendarOpen && (
        <div 
          className="absolute z-50 mt-1" 
          ref={calendarRef}
        >
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            showOutsideDays={true}
            className="p-3 rounded-md border shadow bg-[var(--foreground)]"
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
              day_hidden: "invisible"
            }}
            components={{
              IconLeft: ({ className, ...props }) => (
                <ChevronLeft className={cn("size-4", className)} {...props} />
              ),
              IconRight: ({ className, ...props }) => (
                <ChevronRight className={cn("size-4", className)} {...props} />
              ),
            }}
          />
        </div>
      )}
    </div>
  );
}