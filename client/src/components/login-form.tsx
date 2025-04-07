import { cn } from "@/lib/utils"
import React,{ FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLoginMutation } from "@/redux/slices/apiSlice"
import { useNavigate } from "react-router"
import { ForgotPasswordModal } from "@/app/Components/ForgotPasswordComponent"


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

  const [isForgotPassword,setIsForgotPassword] = useState<boolean>(false);
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
    <div>
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


    </form>
      {isForgotPassword&&(
        <ForgotPasswordModal
        isOpen={isForgotPassword}
        setIsForgotPassword={setIsForgotPassword}
        language={language}
        ></ForgotPasswordModal>
      )}
    </div>
  )
}
