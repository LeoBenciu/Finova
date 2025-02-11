import { cn } from "@/lib/utils"
import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import googleLogo from "@/assets/google-icon-logo-svgrepo-com.svg"
import { X } from "lucide-react"
import * as motion from "motion/react-client"
import { AnimatePresence } from "motion/react"
import { useNavigate } from 'react-router'


interface LoginFormProps extends React.ComponentPropsWithoutRef<"form"> {
  language?: string;
}

export function LoginForm({
  className,
  language,
  ...props
}: LoginFormProps) {

  const [isForgotPassword,setIsForgotPassword] = React.useState(false);
  const navigate = useNavigate();

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center min-w-[320px] max-w-[320px]">
        <p className="text-balance text-sm text-muted-foreground">
          {language==='ro'?'Introduceți datele pentru a vă conecta la contul dumneavoastră.':
          'Enter your details below to login to your account'}
        </p>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-left">Email</Label>
          <Input id="email" type="email" placeholder={language==='ro'?'exemplu@exemplu.com':'example@example.com'} required 
          className="bg-[var(--background)] border-none"/>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">{language==='ro'?'Parola':'Password'}</Label>
            <button
              onClick={(e)=>{
                e.preventDefault();
                setIsForgotPassword(true);
              }
              }
              className="ml-auto text-sm underline-offset-4 hover:underline bg-transparent text-[var(--primary)]"
            >
              {language==='ro'?'Ai uitat parola?':'Forgot your password?'}
            </button>
          </div>
          <Input id="password" type="password"placeholder={language==='ro'?'parola': 'password'}
           required className="bg-[var(--background)] border-none"/>
        </div>
        <Button type="submit" className="w-full bg-[var(--primary)]" onClick={(e)=>{e.preventDefault(); navigate('/home')}}>
          Login
        </Button>
        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-[var(--foreground)] px-2 text-muted-foreground">
            {language==='ro'?'Sau continuă cu':'Or continue with'}
          </span>
        </div>
        <Button variant="outline" className="w-full">
         <img src={googleLogo} className="size-5"/>
         {language==='ro'?'Contectează-te cu Google':'Login with Google'}
        </Button>
      </div>


      <AnimatePresence initial={false}>
      {isForgotPassword&&(<div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center">
        <motion.div className="flex flex-col bg-[var(--background)] px-5 pt-5 pb-8 rounded-lg min-w-xl max-w-lg min-h-max"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}>
          <div className="flex min-w-full max-w-full min-h-max max-h-max items-center justify-between mb-8">
            <X size={30} className="text-red-500 cursor-pointer" onClick={()=>setIsForgotPassword(false)}/>
            <h3 className="font-bold text-2xl">{language==='ro'?'Ai uitat parola?':'Forgot your password?'}</h3>
            <X size={30} className="text-transparent"/>
          </div>

          <p className="mb-6">
            {language==='ro'?'Completează adresa contului pentru a primi un email de resetare':'No worries. We\'ll send you a link to reset your password.'}
          </p>

          <label htmlFor="reset email" className="text-left mb-2 ml-2">Email</label>
          <input className="bg-transparent border-[var(--text)] border-2 
          rounded-lg min-w-16 max-w-full py-2 px-4 mb-10" id="reset email" placeholder="Email"></input>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
             className="bg-[var(--primary)] max-w-max mx-auto"
             onClick={(e)=>e.preventDefault()}>{language==='ro'?'Trimite email de resetare a parolei':'Send email to reset password'}
          </motion.button>
        </motion.div>
      </div>)}
      </AnimatePresence>
    </form>
  )
}
