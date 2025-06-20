import { Outlet } from 'react-router';
import SideBar from '@/app/Components/SideBar';
import { useState } from 'react';
import AIChatSidebar from '@/app/Components/AiChatSidebar';
import { MessageCircle } from 'lucide-react';
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
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--primary)] hover:bg-[var(--primary)]/90 
          text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 
          flex items-center justify-center z-50 group"
        >
          <MessageCircle size={24} className="group-hover:scale-110 transition-transform duration-200" />
          
          <div className="absolute right-full mr-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg 
          opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            {language === 'ro' ? 'Chat cu AI' : 'AI Chat'}
            <div className="absolute top-1/2 -right-1 w-2 h-2 bg-gray-900 rotate-45 transform -translate-y-1/2"></div>
          </div>
        </button>
      )}

      <AIChatSidebar 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
};

export default Page;