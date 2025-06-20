import { House, Settings, CloudUpload, FileStack, FileChartColumn, LogOut, ChevronDown, Building, Landmark } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../helper/authHelpers';
import { setCurrentCompany } from '@/redux/slices/clientCompanySlice';
import logo from '@/assets/FinovaW-removebg-preview.png'
import { LanguageDropdown } from './LanguageDropdown';
import { motion } from 'framer-motion';

const SideBar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const currentCompanyName = useSelector((state:{clientCompany:{current:{name:string}}})=>state.clientCompany.current.name);

  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    { path: '/home', icon: House, label: language === 'ro' ? 'Acasă' : 'Home' },
    { path: '/file-upload', icon: CloudUpload, label: language === 'ro' ? 'Încarcă Fișiere' : 'File Upload' },
    { path: '/file-management', icon: FileStack, label: language === 'ro' ? 'Management Doc.' : 'File Management' },
    { path: '/bank', icon: Landmark, label: language === 'ro' ? 'Bancă' : 'Bank' },
    { path: '/reports', icon: FileChartColumn, label: language === 'ro' ? 'Rapoarte' : 'Reports' },
    { path: '/clients', icon: Building, label: language === 'ro' ? 'Clienți' : 'Clients' },
    { path: '/settings', icon: Settings, label: language === 'ro' ? 'Setări' : 'Settings' },
  ];

  return (
    <div className='bg-gradient-to-br from-[var(--primary-foreground)] to-[var(--background)]/80 
    backdrop-blur-xl min-w-[18rem] max-w-[18rem] min-h-[97vh] m-3 relative
    rounded-3xl border border-white/10 shadow-2xl overflow-hidden'>
      
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 right-10 w-32 h-32 bg-[var(--primary)] rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-24 h-24 bg-blue-500 rounded-full blur-2xl"></div>
      </div>

      <div className="relative p-6 h-full flex flex-col">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <img src={logo} alt="Finova logo" className='h-12 drop-shadow-lg'/>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='mb-8'
        >
          <div 
            className='group bg-gradient-to-r from-[var(--background)]/50 to-[var(--foreground)]/30 
            backdrop-blur-sm border border-[var(--text4)] rounded-2xl p-4 cursor-pointer
            hover:border-[var(--primary)]/50 hover:shadow-lg transition-all duration-300'
            onClick={() => {dispatch(setCurrentCompany({name:'',ein:''}));}}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--text3)] mb-1 font-medium">
                  {language === 'ro' ? 'Companie curentă' : 'Current company'}
                </p>
                <h2 className="text-[var(--text1)] font-bold text-lg truncate group-hover:text-[var(--primary)] transition-colors duration-300">
                  {currentCompanyName || (language === 'ro' ? 'Selectează compania' : 'Select company')}
                </h2>
              </div>
              <ChevronDown size={20} className="text-[var(--text3)] group-hover:text-[var(--primary)] 
              group-hover:rotate-180 transition-all duration-300 flex-shrink-0 ml-2"/>
            </div>
          </div>
        </motion.div>

        <nav className="flex-1 space-y-2">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + (index * 0.05) }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative w-full px-4 py-3 rounded-2xl flex items-center gap-4 text-left
                transition-all duration-300 group overflow-hidden ${
                  active 
                    ? 'bg-gradient-to-r from-[var(--primary)] to-blue-500 text-white shadow-lg' 
                    : 'bg-transparent text-[var(--text2)] hover:bg-gradient-to-r hover:from-[var(--primary)]/10 hover:to-blue-500/10 hover:text-[var(--primary)]'
                }`}
                onClick={() => navigate(item.path)}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-[var(--primary)] to-blue-500 rounded-2xl"
                    transition={{ type: "spring", duration: 0.6 }}
                  />
                )}
                
                <div className="relative flex items-center gap-4 w-full">
                  <Icon size={20} className={`transition-all duration-300 ${
                    active ? 'text-white drop-shadow-sm' : 'group-hover:scale-110'
                  }`} />
                  <span className={`font-medium transition-all duration-300 ${
                    active ? 'text-white font-semibold' : ''
                  }`}>
                    {item.label}
                  </span>
                </div>

                {!active && (
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/5 to-blue-500/5 
                  rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}
              </motion.button>
            );
          })}
        </nav>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className='mt-8 space-y-4'
        >
          <div className="px-2">
            <LanguageDropdown />
          </div>
          
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--text4)] to-transparent"></div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className='w-full px-4 py-3 rounded-2xl flex items-center gap-4 text-left
            bg-transparent text-[var(--text2)] hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 
            hover:text-red-500 transition-all duration-300 group'
            onClick={() => logout()}
          >
            <LogOut size={20} className="transition-all duration-300 group-hover:scale-110" />
            <span className="font-medium text-lg">
              {language === 'ro' ? 'Deconectează-te' : 'Logout'}
            </span>
          </motion.button>
        </motion.div>
      </div>

      <div className="absolute inset-1 border border-white/5 rounded-3xl pointer-events-none"></div>
    </div>
  )
}

export default SideBar