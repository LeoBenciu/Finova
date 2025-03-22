import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {Calendar as Cal} from 'lucide-react';


interface MyCalendarSelectProps{
    createdAtFilter: string,
    setCreatedAtFilter: Dispatch<SetStateAction<string>>
}


export function MyCalendarSelect({createdAtFilter, setCreatedAtFilter}:MyCalendarSelectProps) {
console.log(createdAtFilter);

  const [date,setDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  const calendarRef = useRef(null);

useEffect(()=>{
    function handleClickOutside(event: MouseEvent): void {
      if (calendarRef.current && !(calendarRef.current as any).contains(event.target)) {
        setIsCalendarOpen(false);
      }
    }
  
      document.addEventListener('mousedown',handleClickOutside);
      return()=>{
          document.removeEventListener('mousedown', handleClickOutside);
      };
},[])

  return (
  <div>
    <p className="mb-2 font-bold text-md">Select a date interval</p>

    <button className="rounded-2xl bg-[var(--foreground)]
    flex items-center gap-3 min-h-9 max-h-9
    shadow-[0_0_15px_rgba(0,0,0,0.3)]
    text-[var(--text1)]"
    onClick={()=>setIsCalendarOpen(true)}>
        Pick a date 
        <Cal size={20}></Cal>
    </button>

    {isCalendarOpen&&(
        <div className="absolute top-[-100px] left-10" ref={calendarRef}>
            <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border shadow bg-[var(--foreground)]"
            />
        </div>
    )}
    
   </div>
  )
}
