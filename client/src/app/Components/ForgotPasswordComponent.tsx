import { motion } from "framer-motion";
import LoadingComponent from "./LoadingComponent";
import { X } from "lucide-react";
import { useState } from "react";
import { useForgotPasswordMutation } from "@/redux/slices/apiSlice";

interface ForgotPasswordProps{
    isOpen: boolean,
    setIsForgotPassword: (a:boolean)=>void,
    language:string|undefined
}

export const ForgotPasswordModal = ({ 
    isOpen, 
    setIsForgotPassword, 
    language 
  }:ForgotPasswordProps) => {
    const [email, setEmail] = useState("");
    const [isResetEmailSent, setIsResetEmailSent] = useState(false);
    const [forgotPassword, { isError: isForgotPasswordError, isLoading: isForgotPasswordLoading }] = useForgotPasswordMutation();
  
    const handleSubmitForgotPassword = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation(); 
      try {
        const response = await forgotPassword({ email }).unwrap();
        console.log('forgot password response:',response);
        setIsResetEmailSent(true);
      } catch (e) {
        console.error('Error forgot password:', e);
      }
    };
  
    if (!isOpen) return null;
  
    return (
      <div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center"
           onClick={(e) => e.stopPropagation()}>
        {!isForgotPasswordLoading ? (
          <motion.div 
            className="flex flex-col bg-[var(--foreground)] px-5 pt-5 pb-8 rounded-lg min-w-xl max-w-lg min-h-max"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-full max-w-full min-h-max max-h-max items-center justify-between mb-8">
              <X size={30} className="text-red-500 cursor-pointer" onClick={()=>{console.log('X button clicked');setIsForgotPassword(false)}} />
              <h3 className="font-bold text-2xl text-[var(--text1)]">
                {language === 'ro' ? 'Ai uitat parola?' : 'Forgot your password?'}
              </h3>
              <X size={30} className="text-transparent" />
            </div>
  
            {isResetEmailSent && (
              <div className="flex flex-col items-center mt-4">
                <p className="mb-4 text-green-500">
                  {language === 'ro' ? 'Email de resetare trimis cu succes!' : 'Reset email sent successfully!'}
                </p>
                <button
                  className="bg-[var(--primary)] px-4 py-2 rounded-md text-white"
                  onClick={()=>{console.log('Close button clicked');setIsForgotPassword(false)}}
                  type="button"
                >
                  {language === 'ro' ? 'Închide' : 'Close'}
                </button>
              </div>
            )}
  
            {!isResetEmailSent && (
              <>
                {!isForgotPasswordError && (
                  <p className="mb-6 text-[var(--text3)]">
                    {language === 'ro' ? 'Completează adresa contului pentru a primi un email de resetare' : 'No worries. We\'ll send you a link to reset your password.'}
                  </p>
                )}
  
                {isForgotPasswordError && (
                  <p className="mb-6 text-red-500">
                    {language === 'ro' ? 'Trimiterea emailului de resetare a parolei a esuat!' : 'Failed to send reset password email!'}
                  </p>
                )}
  
                <label htmlFor="reset-email" className="text-left mb-2 ml-2 text-[var(--text1)]">Email</label>
                <input
                  className="bg-transparent border-[var(--text)] border-2 rounded-lg min-w-16 max-w-full py-2 px-4 mb-10 focus:border-none focus:ring-3 focus:ring-[var(--primary)] focus:outline-none text-[var(--text1)]"
                  id="reset-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
  
                <button
                  className="bg-[var(--primary)] max-w-max mx-auto px-4 py-2 rounded-md text-white"
                  onClick={(e)=>handleSubmitForgotPassword(e)}
                  type="button"
                >
                  {language === 'ro' ? 'Trimite email de resetare a parolei' : 'Send email to reset password'}
                </button>
              </>
            )}
          </motion.div>
        ) : (
          <div className="bg-[var(--foreground)] p-5 rounded-2xl">
            <LoadingComponent />
          </div>
        )}
      </div>
    );
  };

