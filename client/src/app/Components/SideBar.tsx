import Logo from '@/assets/2solLqZ3AFncSar4MubKNQ4TreZ.svg';
import { Input } from "@/components/ui/input"
import { House, Settings, CloudUpload, FileStack, FileChartColumn } from 'lucide-react';

const SideBar = () => {
  return (
    <div className='bg-[var(--foreground)] min-w-64 max-w-64 min-h-screen p-4'>
      <img src={Logo} alt="Finova logo" className='h-12'/>
      <Input type="search" placeholder="Search" className='border-[var(--card)] my-6 outline-none focus:ring-[var(--primary)]'/>
      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2'
      ><House size={19}/> Home</button>
      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2'
      ><CloudUpload size={19}/> File Upload</button>
      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2'
      ><FileStack size={19}/> File Management</button>
      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2'
      ><FileChartColumn size={19}/> Reports</button>
      <button className='bg-[var(--foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--background)] text-[var(--text)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2'
      ><Settings size={19}/> Settings</button>
    </div>
  )
}

export default SideBar
