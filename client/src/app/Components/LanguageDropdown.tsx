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
  const [romana] = React.useState<Checked>()
  const [english] = React.useState<Checked>()
  const dispatch = useDispatch();
  const language = useSelector((state: { user: { language: string } })=> state.user.language);

const handleChangeLanguage = (lg:string)=>{
  dispatch(setCurrentLanguage(lg));
}

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className='bg-transparent p-0 focus:outline-none'>
        {language==='en'&&(<img src={en} alt="USA Flag" className='rounded-full size-9 cursor-pointer'/>)}
        {language==='ro'&&(<img src={ro} alt="Romania Flag" className='rounded-full size-9 cursor-pointer'/>)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-[var(--background)] text-[var(--text1)] border-0">
        <DropdownMenuLabel>{language==='ro'? 'Selectați o limbă': 'Select a language'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={romana}
          onCheckedChange={()=>{handleChangeLanguage('ro')}}
          className='cursor-pointer hover:bg-[var(--text4)]'
        >
          Română
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={english}
          onCheckedChange={()=>{handleChangeLanguage('en')}}
          className='cursor-pointer hover:bg-[var(--text4)]'
        >
          English
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
