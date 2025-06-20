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
    <div className="bg-[var(--foreground)] min-w-full max-w-full min-h-fit rounded-3xl mb-8 p-6 
    border-[1px] border-[var(--text4)] shadow-md">
      
      <div className="flex flex-row items-center gap-2 mb-6">
        <p className="text-left text-xl font-bold text-[var(--text1)]">
          {language === 'ro' ? 'Filtrează Documente' : 'Filter Documents'}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="flex flex-col space-y-3">
          <label htmlFor="Name Search" className="text-sm font-semibold text-[var(--text1)]">
            {language==='ro'?'Nume document':'Document name'}
          </label>
          <input
            value={nameSearch}
            onChange={(e)=>setNameSearch(e.target.value)}
            className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
            border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
            text-[var(--text1)] placeholder-[var(--text3)] transition-all duration-200"
            placeholder={language==='ro'?'Căutați după nume...':'Search by name...'}
            id="Name Search"
          />
        </div>
            
        <div className="flex flex-col space-y-3">
          <label className="text-sm font-semibold text-[var(--text1)]">
            {language==='ro'?'Tipul documentului':'Document type'}
          </label>
          <div className="min-h-11 flex items-center">
            <SelectDocType setEditFile={setTypeFilter} shadow={false} full={true}/>
          </div>
        </div>
        
        <div className="flex flex-col space-y-3">
          <label className="text-sm font-semibold text-[var(--text1)]">
            {language==='ro'?'Interval de date':'Date range'}
          </label>
          <div className="min-h-11 flex items-center">
            <MyDateRangePicker
              dateRange={dateRange}
              setDateRange={handleDateRangeChange}
            />
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default FilesSearchFiltersComponent;