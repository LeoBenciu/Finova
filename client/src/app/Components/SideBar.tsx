import { House, Settings, CloudUpload, FileStack, FileChartColumn, LogOut, ChevronDown, Building, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../helper/authHelpers';
import { setCurrentCompany } from '@/redux/slices/clientCompanySlice';
import logo from '@/assets/FinovaW-removebg-preview.png'
import { LanguageDropdown } from './LanguageDropdown';

const SideBar = () => {

  const dispatch=useDispatch();

  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const currentCompanyName = useSelector((state:{clientCompany:{current:{name:string}}})=>state.clientCompany.current.name);
  const navigate = useNavigate();

  return (
    <div className='bg-[var(--primary-foreground)] min-w-[16rem] max-w-[16rem] min-h-[97vh] m-3 p-4 relative
    rounded-xl'>
      <img src={logo} alt="Finova logo" className='h-12'/>
      <div className='hover:text-[var(--primaryLow)] flex items-center
      justify-start px-2 text-xl mt-5 cursor-pointer
      text-left mb-5'
      onClick={()=>{dispatch(setCurrentCompany({name:'',ein:''}));}}>
        <h2>{currentCompanyName}</h2>
        <div className='min-w-[20px]'>
        <ChevronDown size={20}></ChevronDown>
        </div>
      </div>
      <button className='bg-[var(--primary-foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--primary)] text-[var(--primaryText)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer '
      onClick={()=>navigate('/home')}><House size={19}/>{language==='ro'?'Acasa':'Home'}</button>

      <button className='bg-[var(--primary-foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--primary)] text-[var(--primaryText)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/file-upload')}><CloudUpload size={19}/> {language==='ro'?'Incarca Fisiere':'File Upload'}</button>

      <button className={`bg-[var(--primary-foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--primary)] text-[var(--primaryText)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer`}
      onClick={()=>navigate('/file-management')}><FileStack size={19}/> {language==='ro'?'Management Docum..':'File Management'}</button>

      <button className={`bg-[var(--primary-foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--primary)] text-[var(--primaryText)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer`}
      onClick={()=>navigate('/bank')}><Landmark size={19}/> {language==='ro'?'Banca':'Bank'}</button>   

      <button className='bg-[var(--primary-foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--primary)] text-[var(--primaryText)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/reports')}><FileChartColumn size={19}/> {language==='ro'?'Rapoarte':'Reports'}</button>

      <button className='bg-[var(--primary-foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--primary)] text-[var(--primaryText)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/clients')}><Building size={19}/> {language==='ro'?'Clienti':'Clients'}</button>

      <button className='bg-[var(--primary-foreground)] focus:bg-[var(--background)] focus:text-[var(--primary)]
      hover:bg-[var(--primary)] text-[var(--primaryText)] px-3
      min-w-full max-h-9 flex flex-row items-center gap-3 text-base mb-2 cursor-pointer'
      onClick={()=>navigate('/settings')}><Settings size={19}/> {language==='ro'?'Setari':'Settings'}</button>

      <div className='absolute bottom-10 left-0 bg-transparent min-w-full flex items-start
      flex-col  gap-5'>
      <div className='flex-1 px-6'>
      <LanguageDropdown/>
      </div>
      <button className='bg-transparent focus:text-[var(--primary)] text-[var(--primaryText)] px-6
      flex-1 max-h-9 flex flex-row items-center gap-3 text-xl cursor-pointer hover:text-red-500'
      onClick={()=>logout()}>
        <LogOut size={22}></LogOut>
        {language==='ro'?'Deconecteaza-te':'Logout'}
      </button>
      </div>

    </div>
  )
}

export default SideBar
