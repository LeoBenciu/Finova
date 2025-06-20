import { X, Send, Bot, User, Sparkles } from 'lucide-react';
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Salut! Sunt asistentul tău AI. Cu ce te pot ajuta astăzi?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const language = useSelector((state: {user:{language:string}}) => state.user.language);

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
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 lg:w-[28rem] bg-[var(--foreground)] 
        shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-[var(--text4)]
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="bg-[var(--primary)] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'ro' ? 'Asistent AI' : 'AI Assistant'}
              </h3>
              <p className="text-white/80 text-sm">
                {language === 'ro' ? 'Online' : 'Online'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 h-[calc(100vh-140px)] overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
                  ${message.sender === 'user' 
                    ? 'bg-[var(--primary)] text-white' 
                    : 'bg-[var(--background)] border border-[var(--text4)] text-[var(--text2)]'
                  }`}>
                  {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                {/* Message Bubble */}
                <div className={`rounded-2xl px-4 py-3 ${
                  message.sender === 'user'
                    ? 'bg-[var(--primary)] text-white rounded-br-md'
                    : 'bg-[var(--background)] text-[var(--text1)] border border-[var(--text4)] rounded-bl-md'
                }`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className={`text-xs mt-2 ${
                    message.sender === 'user' ? 'text-white/70' : 'text-[var(--text3)]'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-[var(--background)] border border-[var(--text4)] 
                  text-[var(--text2)] flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={16} />
                </div>
                <div className="bg-[var(--background)] border border-[var(--text4)] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[var(--text3)] rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-[var(--text3)] rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-[var(--text3)] rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[var(--text4)] bg-[var(--background)]">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={language === 'ro' ? 'Scrie un mesaj...' : 'Type a message...'}
                className="w-full px-4 py-3 pr-12 bg-[var(--foreground)] border border-[var(--text4)] 
                rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] resize-none transition-all duration-200"
                disabled={isTyping}
              />
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="w-12 h-12 bg-[var(--primary)] hover:bg-[var(--primary)]/90 disabled:bg-[var(--text4)] 
              disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center 
              transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Send size={18} />
            </button>
          </div>
          
          <p className="text-xs text-[var(--text3)] mt-2 text-center">
            {language === 'ro' 
              ? 'Apasă Enter pentru a trimite, Shift+Enter pentru linie nouă' 
              : 'Press Enter to send, Shift+Enter for new line'
            }
          </p>
        </div>
      </div>
    </>
  );
};

export default AIChatSidebar;