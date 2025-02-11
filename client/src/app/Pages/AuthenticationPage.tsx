import React from 'react'
import Logo from '@/assets/2solLqZ3AFncSar4MubKNQ4TreZ.svg'
import { TabsAuth } from "../Components/TabsAuth"
import { LoginForm } from "@/components/login-form"
import { SignupForm } from '../Components/SignupForm'
import { LanguageDropdown } from '../Components/LanguageDropdown'
import { useSelector } from 'react-redux'
import { Code,BookOpen, ChartColumn, File } from 'lucide-react'

const AuthenticationPage = () => {
  const language = useSelector((state: {user:{ language: string }})=> state.user.language);
  const [isLogin, setIsLogin] = React.useState(true);

  return (
    <div className="grid min-h-svh lg:grid-cols-3 bg-[var(--foreground)]">
      <div className="col-span-3 lg:col-span-2 flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <div className="flex justify-center gap-2 mb-10">
              <a href="#" className="flex items-center gap-2 font-medium">
                <img src={Logo} alt="Finova Logoll" className="min-w-72 max-w-72"/>
              </a>
            </div>
            <TabsAuth content1={<LoginForm language={language}/>} content2={<SignupForm language={language}/>} isLogin={isLogin}
            setIsLogin={setIsLogin}/>
          </div>
        </div>
      </div>

      
      <div className="col-span-1 relative bg-muted bg-[var(--primary)] flex flex-col
      justify-center items-center px-5">
        <div className=' size-5 w-full h-max p-5'>
          <div className=' w-full h-20 mb-3 rounded-lg flex justify-center gap-8 items-center'>
            <div className='bg-white rounded-full size-12 text-black flex justify-center
            items-center'>
            <Code size={22}/>
            </div>
            <div className='bg-white rounded-full size-18 mb-10 text-black flex justify-center
            items-center'>
              <ChartColumn size={35}/>
            </div>
            <div className='bg-white rounded-full size-12 text-black flex justify-center
            items-center'>
            <BookOpen size={22}/>
            </div>
          </div>
          <div className='bg-white w-full h-20 mb-3 rounded-lg flex justify-between items-center px-4'>
            <div className='flex gap-3'>
            <div className='bg-[var(--primary)] size-13 rounded-full flex justify-center items-center'>
              <File size={25}/>
            </div>
            <div className='flex flex-col'>
              <p className='text-black font-bold text-base text-left'>{language==='ro'?'Factura':'Invoice'} 156</p>
              <p className='text-black text-base text-left'>{language==='ro'?'SC Companie SRL':'Company Inc.'}</p>
            </div>
            </div>
            <div className='bg-green-200 text-green-600 px-2 rounded-md'>{language==='ro'?'Succes':'Success'}</div>
          </div>
          <h2 className='font-semibold text-3xl mb-3'>{language==='ro'?'"Finova este cu adevărat un element care schimbă regulile jocului pentru afacerea noastră!"':'"Finova it\'s a true game changer for our business!"'}</h2>
          <p>{language==='ro'?'Automatizează-ți fluxul de lucru în contabilitate!':'Automate your bookkeeping workflow'}</p>
        </div>
      </div>
      <div className='rounded-full absolute top-5 left-5'>
        <LanguageDropdown/>
      </div>
    </div>
  )
}

export default AuthenticationPage
