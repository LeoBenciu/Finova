import { Send, Bot, User, Zap, Aperture } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const AIChatSidebar = ({ isOpen, onClose }: AIChatSidebarProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const isEmpty = messages.length === 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    
    // Simulate AI typing
    setIsTyping(true);
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Înțeleg! Voi lucra la cererea ta și îți voi oferi un răspuns detaliat în curând.',
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ro-RO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-white/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[700px] h-[90vh] sm:h-[80vh] flex flex-col
        z-50 transform transition-all duration-300 ease-out
        ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>

        <div className={`flex-1 ${isEmpty ? 'max-h-[150px] min-h-[130px]' : ''} overflow-y-auto p-6 space-y-6 
          scrollbar-thin scrollbar-thumb-red scrollbar-track-transparent` }>
          {isEmpty && (
              <div className="flex flex-row justify-center items-center my-4">
                <Aperture size={65} className="group-hover:scale-110 transition-transform duration-300 drop-shadow-lg animate-pulse mr-2 text-[var(--primary)]" />
                <h1 className="text-6xl font-bold bg-gradient-to-br from-[var(--primary)] to-blue-500 text-transparent bg-clip-text
                transition-transform duration-300 drop-shadow-lg animate-pulse">Finly</h1>
              </div>
            )}
            {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 shadow-lg
                  ${message.sender === 'user' 
                    ? 'bg-gradient-to-br from-[var(--primary)] to-blue-500 border-white/20 text-white' 
                    : 'bg-white border-[var(--text4)] text-[var(--text2)]'
                  }`}>
                  {message.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>

                <div className={`relative rounded-3xl px-5 py-4 shadow-lg border backdrop-blur-sm ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-br from-[var(--primary)] to-blue-500 text-white border-white/20 rounded-br-lg'
                    : 'bg-white text-[var(--text1)] border-[var(--text4)]'
                }`}>
                  <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${
                    message.sender === 'user' 
                      ? 'from-white/10 to-transparent' 
                      : 'from-[var(--text1)]/5 to-transparent'
                  }`}></div>
                  
                  <div className="relative">
                    <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                    <p className={`text-xs mt-3 flex items-center gap-1 ${
                      message.sender === 'user' ? 'text-white/70' : 'text-[var(--text3)]'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${
                        message.sender === 'user' ? 'bg-white/50' : 'bg-[var(--text3)]'
                      }`}></div>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--background)] to-[var(--foreground)] 
                  border-2 border-[var(--text4)] text-[var(--text2)] flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Zap size={18} className="animate-pulse" />
                </div>
                <div className="bg-gradient-to-br from-[var(--background)] to-[var(--foreground)] border border-[var(--text4)] 
                  rounded-3xl rounded-bl-lg px-5 py-4 shadow-lg backdrop-blur-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-[var(--primary)] rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2.5 h-2.5 bg-[var(--primary)] rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2.5 h-2.5 bg-[var(--primary)] rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div>
          <div className={`flex gap-4 items-end ${isEmpty ? 'max-w-[700px] w-[90%]' : ''}`}>
            <div className="group relative min-w-[700px] max-w-[700px] flex-1 rounded-3xl ring-1 ring-inset ring-[var(--text4)] backdrop-blur-md shadow-inner overflow-hidden px-4
            bg-white hover:shadow-xl focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:shadow-2xl pb-1">
              
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={language === 'ro' ? 'Scrie un mesaj...' : 'Type a message...'}
                style={{resize:'none'}}
                className="relative w-full px-0 pt-6 pb-4 bg-transparent 
                rounded-3xl text-[var(--text1)] placeholder:text-[var(--text3)] font-medium"
                disabled={isTyping}
              />

              <div className='flex flex-row justify-between items-center'>

              <div className='flex flex-row gap-2'>
              <button></button>
              <button></button>
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="relative w-12 h-12 bg-[var(--primary)] hover:bg-[var(--primary)]/90 disabled:bg-[var(--text4)] 
                hover:from-[var(--primary)]/90 hover:to-blue-400 disabled:from-[var(--text4)] disabled:to-[var(--text4)]
                disabled:cursor-not-allowed text-white rounded-3xl flex items-center justify-center 
                transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg hover:shadow-2xl
                border border-white/20 backdrop-blur-sm group p-0"
              >
                <Send size={20} className="relative group-hover:scale-110 transition-transform duration-200 drop-shadow-sm" />
              </button>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChatSidebar;