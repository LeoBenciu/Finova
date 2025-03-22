import { cn } from "@/lib/utils"
import React,{ FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import googleLogo from "@/assets/google-icon-logo-svgrepo-com.svg"
import { X } from "lucide-react"
import * as motion from "motion/react-client"
import { AnimatePresence } from "motion/react"
import { useLoginMutation } from "@/redux/slices/apiSlice"
import { useNavigate } from "react-router"


interface LoginFormProps extends React.ComponentPropsWithoutRef<"form"> {
  language?: string;
}

type login = {
  email: string,
  password: string
}

export function LoginForm({
  className,
  language,
  ...props
}: LoginFormProps) {

  const [isForgotPassword,setIsForgotPassword] = React.useState(false);
  const [formData, setFormData] = useState<login>({
    email:'',
    password: ''
  });
  const [login, { isLoading: isLoadingLogin,  isError:isLoginError }] = useLoginMutation();
  const navigate = useNavigate();

  const handleSubmitLogin = async(e: FormEvent<HTMLFormElement>) =>{
    e.preventDefault();
    try{
      const response = await login(formData).unwrap();
      if(response){
      localStorage.setItem('token',response.access_token);
      navigate('/home');}
    }catch(err){
      console.error("Failed login:",err);
    }
  };


  const handleFormDataChange = (e:React.ChangeEvent<HTMLInputElement>) =>{
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleSubmitLogin}>
      <div className="flex flex-col items-center gap-2 text-center min-w-[320px] max-w-[320px]">
        {!isLoginError&&(<p className="text-balance text-sm text-muted-foreground
        text-[var(--text3)]">
          {language==='ro'?'Introduceți datele pentru a vă conecta la contul dumneavoastră.':
          'Enter your details below to login to your account'}
        </p>)}
        {isLoginError&&(<p className="text-red-500 font-normal text-base">
          {language==='ro'?`Conectarea la contul de utilizator a esuat! 
          Va rugam sa verificati daca datele introduse sunt corecte!`:
          `Failed user login! Please check if the inserted details are correct!`}
          </p>)}
      </div>
      

      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-left text-[var(--text1)]">Email</Label>
          <Input id="email" type="email" placeholder={language==='ro'?'exemplu@exemplu.com':'example@example.com'} required 
          className="bg-[var(--foreground)] border-none text-[var(--text1)]
          focus:ring-[var(--primary)]" onChange={handleFormDataChange}/>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password" className="text-[var(--text1)]">{language==='ro'?'Parola':'Password'}</Label>
            <button
              onClick={(e)=>{
                e.preventDefault();
                setIsForgotPassword(true);
              }
              }
              className="ml-auto text-sm underline-offset-4 hover:underline bg-transparent text-[var(--primary)]"
              type='button'
            >
              {language==='ro'?'Ai uitat parola?':'Forgot your password?'}
            </button>
          </div>
          <Input id="password" type="password"placeholder={language==='ro'?'parola': 'password'}
           required className="bg-[var(--foreground)] border-none text-[var(--text1)]
          focus:ring-[var(--primary)]" onChange={handleFormDataChange}/>
        </div>
        <Button type="submit" className="w-full bg-[var(--primary)]">
          {isLoadingLogin?'Loggin in...':'Login'}
        </Button>
      </div>


      <AnimatePresence initial={false}>
      {isForgotPassword&&(<div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center">
        <motion.div className="flex flex-col bg-[var(--foreground)] px-5 pt-5 pb-8 rounded-lg min-w-xl max-w-lg min-h-max"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}>
          <div className="flex min-w-full max-w-full min-h-max max-h-max items-center justify-between mb-8">
            <X size={30} className="text-red-500 cursor-pointer" onClick={()=>setIsForgotPassword(false)}/>
            <h3 className="font-bold text-2xl text-[var(--text1)]">{language==='ro'?'Ai uitat parola?':'Forgot your password?'}</h3>
            <X size={30} className="text-transparent"/>
          </div>

          <p className="mb-6 text-[var(--text3)]">
            {language==='ro'?'Completează adresa contului pentru a primi un email de resetare':'No worries. We\'ll send you a link to reset your password.'}
          </p>

          <label htmlFor="reset email" className="text-left mb-2 ml-2 text-[var(--text1)]">Email</label>
          <input className="bg-transparent border-[var(--text)] border-2 
          rounded-lg min-w-16 max-w-full py-2 px-4 mb-10 focus:border-none focus:ring-3 
          focus:ring-[var(--primary)] focus:outline-none text-[var(--text1)]" id="reset email"></input>

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
