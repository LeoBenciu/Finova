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
    return language==='ro'?'Selecteaza date':'Select dates';
  };
  
  return (
    <div className="relative w-full">
      <button 
        className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
        border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
        text-[var(--text1)] transition-all duration-200 flex items-center justify-between gap-2
        hover:border-[var(--primary)]/50"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
      >
        <span className={`${range.from || range.to ? 'text-[var(--text1)]' : 'text-[var(--text3)]'}`}>
          {displayText()}
        </span>
        <Cal size={16} className="text-[var(--text3)]" />
      </button>
      
      {isCalendarOpen && (
        <div 
          className="absolute z-50 mt-2 right-0" 
          ref={calendarRef}
        >
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            showOutsideDays={true}
            className="p-4 rounded-2xl border border-[var(--text4)] shadow-lg bg-[var(--foreground)]"
            classNames={{
              months: "flex flex-col sm:flex-row gap-2",
              month: "flex flex-col gap-4",
              caption: "flex justify-center pt-1 relative items-center w-full",
              caption_label: "text-sm font-medium text-[var(--text1)]",
              nav: "flex items-center gap-1",
              nav_button: cn(
                buttonVariants({ variant: "outline" }),
                "size-7 bg-transparent p-0 text-[var(--text3)] hover:text-[var(--text1)] hover:bg-[var(--background)] border-[var(--text4)]"
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
                "size-8 p-0 font-normal bg-[var(--background)] text-[var(--text1)] hover:bg-[var(--primary)]/10 hover:text-[var(--text1)] aria-selected:opacity-100"
              ),
              day_range_start:
                "day-range-start aria-selected:bg-[var(--primary)] aria-selected:text-white",
              day_range_end:
                "day-range-end aria-selected:bg-[var(--primary)] aria-selected:text-white",
              day_selected:
                "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/80 hover:text-white focus:bg-[var(--primary)] focus:text-white",
              day_today: "bg-[var(--primary)]/20 text-[var(--text1)] font-semibold",
              day_outside:
                "day-outside text-[var(--text4)] bg-transparent aria-selected:text-[var(--text4)]",
              day_disabled: "text-[var(--text4)] opacity-50",
              day_range_middle:
                "aria-selected:bg-[var(--primary)]/20 aria-selected:text-[var(--text1)]",
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