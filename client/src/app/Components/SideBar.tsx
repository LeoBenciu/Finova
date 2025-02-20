import Logo from '@/assets/2solLqZ3AFncSar4MubKNQ4TreZ.svg';
import { Input } from "@/components/ui/input"
import { House, Settings, CloudUpload, FileStack, FileChartColumn } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';

const SideBar = () => {

  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const navigate = useNavigate();

  return (
    <div className='bg-[var(--foreground)] min-w-64 max-w-64 min-h-screen p-4'>
      <img src={Logo} alt="Finova logo" className='h-12'/>
      <Input type="search" placeholder={language=='ro'?'Cauta':"Search"} className='border-[var(--card)] my-6 outline-none focus:ring-[var(--primary)]'/>
      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer '
      onClick={()=>navigate('/home')}><House size={19}/>{language==='ro'?'Acasa':'Home'}</button>

      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/file-upload')}><CloudUpload size={19}/> {language==='ro'?'Incarca Fisiere':'File Upload'}</button>

      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/file-management')}><FileStack size={19}/> {language==='ro'?'Management Fisiere':'File Management'}</button>

      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/reports')}><FileChartColumn size={19}/> {language==='ro'?'Rapoarte':'Reports'}</button>

      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/settings')}><Settings size={19}/> {language==='ro'?'Setari':'Settings'}</button>

    </div>
  )
}

export default SideBar
