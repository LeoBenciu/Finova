"use client"
import en from '@/assets/en.png'
import ro from '@/assets/ro.png'
import * as React from "react"
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setCurrentLanguage } from '@/redux/slices/userSlice'
import { useDispatch, useSelector } from 'react-redux'

type Checked = DropdownMenuCheckboxItemProps["checked"]

export function LanguageDropdown() {
  const [romana, setRomana] = React.useState<Checked>(false)
  const [english, setEnglish] = React.useState<Checked>(true)
  const dispatch = useDispatch();
  const language = useSelector((state: { user: { language: string } })=> state.user.language);

React.useEffect(()=>{
    dispatch(setCurrentLanguage(romana?'ro':'en'))
}, [english,romana])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className='bg-transparent p-0 focus:outline-none'>
        {language==='en'&&(<img src={en} alt="USA Flag" className='rounded-full size-9 cursor-pointer'/>)}
        {language==='ro'&&(<img src={ro} alt="Romania Flag" className='rounded-full size-9 cursor-pointer'/>)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-[var(--background)] border-0">
        <DropdownMenuLabel>{language==='ro'? 'Selectați o limbă': 'Select a language'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={romana}
          onCheckedChange={()=>{setRomana(true); setEnglish(false)}}
          className='cursor-pointer hover:bg-[var(--card)]'
        >
          Română
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={english}
          onCheckedChange={()=>{setEnglish(true); setRomana(false)}}
          className='cursor-pointer hover:bg-[var(--card)]'
        >
          English
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
