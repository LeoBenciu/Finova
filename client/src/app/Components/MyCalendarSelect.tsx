import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as Cal } from 'lucide-react';
import { format } from "date-fns";

interface MyCalendarSelectProps {
  createdAtFilter: string;
  setCreatedAtFilter: Dispatch<SetStateAction<string>>;
}

export function MyCalendarSelect({ createdAtFilter, setCreatedAtFilter }: MyCalendarSelectProps) {
  const [date, setDate] = useState<Date | undefined>(
    createdAtFilter ? new Date(createdAtFilter) : new Date()
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  
  const calendarRef = useRef<HTMLDivElement>(null);
  
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
  
  useEffect(() => {
    if (date) {
      setCreatedAtFilter(format(date, 'yyyy-MM-dd'));
    }
  }, [date, setCreatedAtFilter]);
  
  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      setCreatedAtFilter(format(newDate, 'yyyy-MM-dd'));
    }
    setIsCalendarOpen(false);
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
        {date ? format(date, 'MMM dd, yyyy') : 'Pick a date'}
        <Cal size={20} />
      </button>
      
      {isCalendarOpen && (
        <div 
          className="absolute z-50 mt-1" 
          ref={calendarRef}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            setDate={handleDateSelect}
            className="rounded-md border shadow bg-[var(--foreground)]"
          />
        </div>
      )}
    </div>
  );
}