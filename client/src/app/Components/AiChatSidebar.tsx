import { Send, User, Zap, Aperture, Upload, RotateCw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSendChatMessageMutation } from '@/redux/slices/apiSlice';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DocPreviewItem {
  id?: number | string;
  title?: string;
  fileName?: string;
  documentNumber?: string;
  signedUrl?: string;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  docs?: DocPreviewItem[];
}

const AIChatSidebar = ({ isOpen, onClose }: AIChatSidebarProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const clientEin = useSelector((state: {clientCompany:{current:{ein:string}}}) => state.clientCompany.current.ein);
  const [sendChatMessage, { isLoading: isSending } ] = useSendChatMessageMutation();
  const isEmpty = messages.length === 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0) {
      setShowIntro(false);
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    // reset height when textarea is cleared
    if (inputMessage === '' && inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.overflowY = 'hidden';
    }
  }, [inputMessage]);

  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const maxHeight = 200; // px
      const newHeight = Math.min(inputRef.current.scrollHeight, maxHeight);
      inputRef.current.style.height = `${newHeight}px`;
      inputRef.current.style.overflowY = inputRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    if (!clientEin) {
      alert(language === 'ro' ? 'Selectează o companie înainte de a trimite mesaje.' : 'Please select a company before chatting.');
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Build short history for context (last 10 messages)
      const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = messages
        .slice(-10)
        .map((m) => ({
          role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }));

      const res = await sendChatMessage({ clientEin, message: newMessage.content, history }).unwrap();

      // Try to parse document results from AI reply (JSON payload with items[].signedUrl)
      const parseDocResults = (text: string): DocPreviewItem[] | undefined => {
        try {
          const trimmed = text.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const data = JSON.parse(trimmed);
            const items = (data?.items ?? data?.documents ?? []) as any[];
            if (Array.isArray(items) && items.length) {
              const docs: DocPreviewItem[] = items
                .map((it) => ({
                  id: it.id ?? it.docId ?? it.documentId,
                  title: it.processedData?.document_number || it.processedData?.title || it.fileName,
                  fileName: it.fileName,
                  documentNumber: it.processedData?.document_number,
                  signedUrl: it.signedUrl,
                }))
                .filter((d) => !!d.signedUrl);
              return docs.length ? docs : undefined;
            }
          }
        } catch (_) {
          // ignore parse errors
        }
        return undefined;
      };

      const docs = parseDocResults(res.reply);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: res.reply || (language === 'ro' ? 'Niciun răspuns.' : 'No response.'),
        sender: 'ai',
        timestamp: new Date(),
        docs,
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (err: any) {
      const aiError: Message = {
        id: (Date.now() + 2).toString(),
        content: language === 'ro' ? 'Eroare la trimiterea mesajului. Încearcă din nou.' : 'Error sending message. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiError]);
      console.error('Chat error:', err);
    } finally {
      setIsTyping(false);
    }
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
          className="fixed inset-0 bg-white/30 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[700px] h-[90vh] sm:h-[80vh] flex flex-col
        z-50 transform transition-all duration-300 ease-out
        ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>

        <div className={`flex-1 ${isEmpty? "mt-32":""} ${isEmpty ? 'max-h-[150px] min-h-[130px]' : ''} overflow-y-auto p-6 space-y-6 
          scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent` }>
          {showIntro && (
               <div className={`flex flex-row justify-center items-center my-4 transition-all duration-500 ${messages.length>0 ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'}`}>
                <Aperture size={65} className="group-hover:scale-110 transition-transform duration-300 drop-shadow-lg mr-2 text-[var(--primary)]" />
                <h1 className="text-6xl font-bold bg-gradient-to-br from-[var(--primary)] to-blue-500 text-transparent bg-clip-text
                transition-transform duration-300 drop-shadow-lg py-1">Finly</h1>
              </div>
            )}
            {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 shadow-lg
                  ${message.sender === 'user' 
                    ? 'bg-gradient-to-br from-[var(--primary)] to-blue-500 text-white border-[var(--primary)]/60' 
                    : 'bg-white text-[var(--text2)] border-neutral-100'
                  }`}>
                  {message.sender === 'user' ? <User size={18} /> : <Aperture size={18} />}
                </div>

                <div className={`relative rounded-3xl px-5 py-4 shadow-lg border-0 backdrop-blur-sm ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-br from-[var(--primary)] to-blue-500 text-white'
                    : 'bg-white text-[var(--text1)]'
                }`}>
                  <div className={`absolute inset-0 rounded-3xl ${
                    message.sender === 'user' 
                      ? 'bg-[var(--primary)]' 
                      : ' bg-white'
                  }`}></div>
                  
                  <div className="relative">
                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{message.content}</p>

                    {message.sender === 'ai' && message.docs && message.docs.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-3">
                        {message.docs.slice(0, 3).map((doc, idx) => (
                          <div key={`${message.id}-doc-${idx}`} className="border rounded-xl overflow-hidden shadow-sm">
                            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-700 flex flex-row justify-between items-center">
                              <div className="font-semibold truncate max-w-[80%]">
                                {doc.documentNumber || doc.title || doc.fileName || 'Document'}
                              </div>
                              {doc.signedUrl && (
                                <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                  Open
                                </a>
                              )}
                            </div>
                            {doc.signedUrl && (
                              <iframe
                                src={doc.signedUrl}
                                className="w-full h-64"
                                title={`doc-preview-${idx}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
            bg-white hover:shadow-xl focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:shadow-2xl pb-2 pt-1">
              
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyPress={handleKeyPress}
                placeholder={language === 'ro' ? 'Scrie un mesaj...' : 'Type a message...'}
                style={{resize:'none'}}
                className="relative w-full px-0 pt-2 pb-4 bg-transparent max-h-[200px] 
                text-[var(--text1)] placeholder:text-[var(--text3)] font-medium
                focus:outline-none overflow-auto"
                disabled={isTyping || isSending}
              />

              <div className='flex flex-row justify-between items-center'>

              <div className='flex flex-row gap-2'>
              <button className='flex items-center flex-row gap-2 bg-white rounded-2xl text-black/60 border border-[var(--text4)] px-3 py-1 hover:bg-gray-100 text-sm'><Upload size={15} /> Upload</button>
              <button className='flex items-center flex-row gap-2 bg-white rounded-2xl text-black/60 border border-[var(--text4)] px-3 py-1 hover:bg-gray-100 text-sm'><RotateCw size={15} /> Reset</button>
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping || isSending}
                className="relative w-11 h-11 bg-[var(--primary)] hover:bg-[var(--primary)]/90 disabled:bg-[var(--text4)] 
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