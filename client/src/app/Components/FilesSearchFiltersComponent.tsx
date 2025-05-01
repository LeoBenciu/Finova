import { useSelector } from "react-redux";
import { documentType } from "../Pages/FileManagementPage";
import { SelectDocType } from "./SelectDocType";
import { MyDateRangePicker } from '@/app/Components/MyDateRangePicker'; // New import
import { SetStateAction, Dispatch, useState} from "react";

type intervalDateType={
from:string|undefined,
to:string|undefined
}

interface FilesSearchFiltersProps {
  nameSearch: string;
  intervalDate: intervalDateType;
  setNameSearch: Dispatch<SetStateAction<string>>;
  setTypeFilter: Dispatch<SetStateAction<documentType | undefined>>;
  setIntervalDate: Dispatch<SetStateAction<intervalDateType>>;
}

const FilesSearchFiltersComponent = ({
  nameSearch,
  setNameSearch,
  setTypeFilter,
  setIntervalDate
}: FilesSearchFiltersProps) => {
  // Add state for date range
  const [dateRange, setDateRange] = useState<{ 
    from: string | undefined; 
    to: string | undefined 
  }>({ 
    from: undefined, 
    to: undefined 
  });
  const language = useSelector((state:{user:{language:string}})=>state.user.language);

  const handleDateRangeChange: Dispatch<SetStateAction<{ 
    from: string | undefined; 
    to: string | undefined 
  }>> = (value) => {
    const newDateRange = typeof value === 'function' ? value(dateRange) : value;
    setDateRange(newDateRange);
    setIntervalDate(newDateRange);
  };

  return (
    <div className="bg-[var(--foreground)] min-w-full max-w-full min-h-27 max-h-27
    rounded-2xl mb-15 grid grid-cols-3 py-5 px-5">
      <div className="flex flex-col items-center justify-center px-3">
        <label htmlFor="Name Search" className="text-md font-bold 
        text-left mb-2 text-[var(--text1)]">{language==='ro'?'Nume document':'Document name'}</label>
        <input 
          value={nameSearch} 
          onChange={(e)=>setNameSearch(e.target.value)}
          className="bg-[var(--foreground)] min-h-9 rounded-2xl min-w-full px-4
          shadow-[0_0_15px_rgba(0,0,0,0.3)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]
          text-[var(--text1)]"
          id="Name Search"
        />
      </div>
    
      <div className="flex items-center justify-center flex-col">
        <p className="text-md font-bold 
        text-left mb-2 text-[var(--text1)]">{language==='ro'?'Tipul documentului':'Document type'}</p>
        <SelectDocType setEditFile={setTypeFilter} shadow={true} />
      </div>

      <div className="flex items-center justify-center flex-col relative">
        <p className="text-md font-bold 
        text-left mb-2 text-[var(--text1)]">{language==='ro'?'Interval de date':'Date range'}</p>
        <MyDateRangePicker 
          dateRange={dateRange}
          setDateRange={handleDateRangeChange}
        />
      </div>
    </div>
  );
};

export default FilesSearchFiltersComponent;