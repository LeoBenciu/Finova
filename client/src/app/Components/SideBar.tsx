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
    <div className='bg-[var(--primary-foreground)] min-w-[17rem] max-w-[17rem] min-h-[97vh] m-3 
    rounded-2xl shadow-xl border border-[var(--text5)] relative overflow-hidden'>
      
      <div className="p-5 h-full flex flex-col">
        {/* Logo Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <img src={logo} alt="Finova logo" className='h-12'/>
        </motion.div>

        {/* Company Selector */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='mb-6'
        >
          <div 
            className='bg-[var(--background)] border border-[var(--text4)] rounded-xl p-4 cursor-pointer
            hover:border-[var(--primary)] hover:bg-[var(--foreground)] transition-all duration-300 group'
            onClick={() => {dispatch(setCurrentCompany({name:'',ein:''}));}}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--text3)] mb-1 font-medium">
                  {language === 'ro' ? 'Companie curentă' : 'Current company'}
                </p>
                <h2 className="text-[var(--text1)] font-semibold text-base truncate group-hover:text-[var(--primary)] transition-colors duration-300">
                  {currentCompanyName || (language === 'ro' ? 'Selectează compania' : 'Select company')}
                </h2>
              </div>
              <ChevronDown size={18} className="text-[var(--text3)] group-hover:text-[var(--primary)] 
              transition-all duration-300 flex-shrink-0 ml-2"/>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + (index * 0.03) }}
                className={`relative w-full px-4 py-3 rounded-xl flex items-center gap-3 text-left
                transition-all duration-200 ${
                  active 
                    ? 'bg-[var(--primary)] text-[var(--primaryText)] shadow-md' 
                    : 'text-[var(--primaryText)] hover:bg-[var(--primary)]/20'
                }`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={19} />
                <span className="font-medium text-base">
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className='mt-6 space-y-4'
        >
          {/* Language Dropdown */}
          <div className="px-1">
            <LanguageDropdown />
          </div>
          
          {/* Logout Button */}
          <motion.button 
            className='w-full px-4 py-3 rounded-xl flex items-center gap-3 text-left
            text-[var(--primaryText)] hover:text-red-400 hover:bg-red-500/10 
            transition-all duration-200'
            onClick={() => logout()}
          >
            <LogOut size={20} />
            <span className="font-medium text-lg">
              {language === 'ro' ? 'Deconectează-te' : 'Logout'}
            </span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}

export default SideBar