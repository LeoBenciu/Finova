import { Outlet } from 'react-router';
import SideBar from '@/app/Components/SideBar';
import { useState } from 'react';
import AIChatSidebar from '@/app/Components/AiChatSidebar';
import { MessageCircle, Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';

const Page = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const language = useSelector((state: {user:{language:string}}) => state.user.language);

  return (
    <div className="min-w-screen min-h-screen flex overflow-hidden relative">
      <SideBar />
      
      <div id="content" className="flex-1 h-screen overflow-y-auto">
        <div className="w-vw min-h-full flex items-start justify-center">
          <div className="p-10 min-w-full max-w-vw">
            <Outlet />
          </div>
        </div>
      </div>

      {!isChatOpen && (
        <div className="fixed bottom-8 right-8 z-50">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)] to-blue-500 rounded-3xl blur-xl opacity-60 animate-pulse"></div>
          
          <button
            onClick={() => setIsChatOpen(true)}
            className="relative w-16 h-16 bg-gradient-to-br from-[var(--primary)] via-[var(--primary)] to-blue-500 
            hover:from-[var(--primary)]/90 hover:to-blue-400 text-white rounded-3xl shadow-2xl 
            hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all duration-500 
            flex items-center justify-center group border border-white/20 backdrop-blur-sm
            hover:scale-110 active:scale-95"
          >
            <div className="absolute inset-1 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
            
            <div className="relative flex items-center justify-center">
              <MessageCircle size={28} className="group-hover:scale-110 transition-transform duration-300 drop-shadow-lg" />
              <Sparkles size={12} className="absolute -top-1 -right-1 text-rose-500 animate-pulse" />
            </div>
            
            <div className="absolute right-full mr-4 px-4 py-3 bg-gray-900/95 backdrop-blur-sm text-white text-sm rounded-2xl 
            opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-xl border border-white/10
            transform group-hover:translate-x-0 translate-x-2">
              {language === 'ro' ? 'Chat cu AI' : 'AI Chat'}
              <div className="absolute top-1/2 -right-1 w-2 h-2 bg-gray-900 rotate-45 transform -translate-y-1/2 border-r border-b border-white/10"></div>
            </div>
          </button>
        </div>
      )}

      <AIChatSidebar 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
};

export default Page;