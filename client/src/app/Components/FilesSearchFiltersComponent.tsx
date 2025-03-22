import { documentType } from "../Pages/FileManagementPage"
import { SelectDocType } from "./SelectDocType"
import {MyCalendarSelect} from '@/app/Components/MyCalendarSelect'
import { SetStateAction,Dispatch } from "react"

interface FilesSearchFiltersProps{
    nameSearch: string,
    createdAtFilter: string,
    setNameSearch: Dispatch<SetStateAction<string>>,
    setTypeFilter: Dispatch<SetStateAction<documentType | undefined>>, 
    setCreatedAtFilter: Dispatch<SetStateAction<string>>
}

const FilesSearchFiltersComponent = ({
    nameSearch,
    setNameSearch,
    setTypeFilter,
    createdAtFilter,
    setCreatedAtFilter
}:FilesSearchFiltersProps) => {



  return (
    <div className="bg-[var(--foreground)] min-w-full max-w-full min-h-27 max-h-27
    rounded-2xl mb-15 grid grid-cols-3 py-5 px-5">
    <div className="flex flex-col items-center justify-center px-3">
      <label htmlFor="Name Search" className="text-md font-bold 
      text-left mb-2 text-[var(--text1)]">Document name</label>
      <input value={nameSearch} onChange={(e)=>setNameSearch(e.target.value)}
      className="bg-[var(--foreground)] min-h-9 rounded-2xl min-w-full px-4
      shadow-[0_0_15px_rgba(0,0,0,0.3)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]
      text-[var(--text1)]"
      id="Name Search"></input>
    </div>

    <div className="flex items-center justify-center flex-col">
    <p className="text-md font-bold 
      text-left mb-2 text-[var(--text1)]">Document name</p>
      <SelectDocType setEditFile={setTypeFilter} ></SelectDocType>
    </div>

    <div className="flex items-center justify-center relative">
      <MyCalendarSelect createdAtFilter={createdAtFilter}
      setCreatedAtFilter={setCreatedAtFilter}></MyCalendarSelect>
    </div>

    </div>
  )
}

export default FilesSearchFiltersComponent
