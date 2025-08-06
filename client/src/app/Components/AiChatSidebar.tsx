import { Send, Bot, User, Zap } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  
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

        <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 
          scrollbar-thin scrollbar-thumb-[var(--text4)] scrollbar-track-transparent">
          {isEmpty && (
              <div className="flex justify-center my-10">
                <h1 className="text-9xl font-bold bg-gradient-to-br from-[var(--primary)] to-blue-500 text-transparent bg-clip-text">Finly</h1>
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
                    : 'bg-white text-[var(--text1)] border-[var(--text4)] rounded-bl-lg'
                }`}>
                  <div className={`absolute inset-0 rounded-3xl ${
                    message.sender === 'user' ? 'rounded-br-lg' : 'rounded-bl-lg'
                  } bg-gradient-to-br ${
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

        <div className={`p-6 pb-8 bg-gradient-to-t from-[var(--background)]/80 to-transparent backdrop-blur-sm ${isEmpty ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-none bg-transparent p-0 w-full flex justify-center' : 'border-t border-white/10'}`}>
          <div className={`flex gap-4 items-end ${isEmpty ? 'max-w-[700px] w-[90%]' : ''}`}>
            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/20 to-blue-500/20 rounded-3xl blur-xl opacity-50"></div>
              
              <input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={language === 'ro' ? 'Scrie un mesaj...' : 'Type a message...'}
                className="relative w-full px-6 py-4 bg-white/60 
                border border-[var(--text4)] rounded-3xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] 
                focus:border-transparent text-[var(--text1)] transition-all duration-300 shadow-lg backdrop-blur-sm
                placeholder:text-[var(--text3)] font-medium hover:shadow-xl focus:shadow-2xl"
                disabled={isTyping}
              />
              
              <div className="absolute inset-1 bg-gradient-to-br from-white/5 to-transparent rounded-3xl pointer-events-none"></div>
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="relative w-14 h-14 bg-[var(--primary)] 
              hover:from-[var(--primary)]/90 hover:to-blue-400 disabled:from-[var(--text4)] disabled:to-[var(--text4)]
              disabled:cursor-not-allowed text-white rounded-3xl flex items-center justify-center 
              transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg hover:shadow-2xl
              border border-white/20 backdrop-blur-sm group"
            >
              <div className="absolute inset-1 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
              
              <Send size={20} className="relative group-hover:scale-110 transition-transform duration-200 drop-shadow-sm" />
            </button>
          </div>
          
          <p className="text-xs text-[var(--text3)] mt-4 text-center font-medium flex items-center justify-center gap-1">
            <div className="w-1 h-1 bg-[var(--text3)] rounded-full"></div>
            {language === 'ro' 
              ? 'Apasă Enter pentru a trimite, Shift+Enter pentru linie nouă' 
              : 'Press Enter to send, Shift+Enter for new line'
            }
            <div className="w-1 h-1 bg-[var(--text3)] rounded-full"></div>
          </p>
        </div>
      </div>
    </>
  );
};

export default AIChatSidebar;