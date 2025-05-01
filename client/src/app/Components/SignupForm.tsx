import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSignupMutation } from "@/redux/slices/apiSlice"
import { useState } from "react"
import LoadingComponent from "./LoadingComponent"



interface SignupFormProps extends React.ComponentPropsWithoutRef<"form"> {
  language?: string;
}

export function SignupForm({
  className,
  language,
  ...props
}: SignupFormProps) {


  const[email,setEmail] = useState<string>();
  const[password,setPassword] = useState<string>();
  const[phoneNumber,setPhoneNumber] = useState<string>();
  const[ein,setEin] = useState<string>();
  const[username,setUsername] = useState<string>();
  const[success,setSuccess] = useState<boolean>(false);;

  const [signup,{isLoading:isSignupLoading,isError:isSignupError}] = useSignupMutation();

  const handleSignupButton =async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    try {
      const response = await signup({email,password,phoneNumber,ein,username}).unwrap();
      console.log(response);
      setSuccess(true);
      setTimeout(()=>{
        setSuccess(false);
        window.location.reload();
      },1000)
    } catch (e) {
      console.error('Failed to signup user')
    }
  }


  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleSignupButton}>
      <div className="flex flex-col items-center gap-2 text-center min-w-[320px] max-w-[320px]">
        {!isSignupError&&!success&&(<p className="text-balance text-sm text-muted-foreground
        text-[var(--text3)]">
          {language==='ro'?'Introduceți datele dumneavoastră pentru a crea un cont':
          'Enter your credentials below to create an account'}
        </p>)}
        {isSignupError&&(<p className="text-red-500 font-normal text-base">
          {language==='ro'?`Crearea contului de utilizator a esuat! 
          Va rugam sa verificati daca datele introduse sunt corecte!`:
          `Failed user account creation! Please check if the inserted details are correct!`}
          </p>)}
        {success&&(<p className="text-green-500 font-normal text-base">
          {language=='ro'?'Contul dumneavoastra a fost creat cu succes!':'Account created successfully!'}
        </p>)}
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-left text-[var(--text1)]">Email</Label>
          <Input id="email" type="email" placeholder={language==='ro'?'exemplu@exemplu.com':'example@example.com'} 
          required  onChange={(e)=>setEmail(e.target.value)} value={email}
          className="bg-[var(--foreground)] border-none text-[var(--text1)]
          focus:ring-[var(--primary)]"/>
        </div>
        <div className="grid gap-2">
        <Label htmlFor="password" className="text-left text-[var(--text1)]">{language==='ro'?'Parola':'Password'}</Label>
          <Input id="password" type="password" placeholder={language==='ro'?'Parola': 'Password'}
          className="bg-[var(--foreground)] border-none text-[var(--text1)]
          focus:ring-[var(--primary)]" required onChange={(e)=>setPassword(e.target.value)} 
          value={password}/>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phoneNumber" className="text-left text-[var(--text1)]">{language==='ro'?'Numar de telefon (ex: +40#########)':'Phone Number'}</Label>
          <Input id="phoneNumber" type="tel" placeholder={language==='ro'?'Numar de telefon':'Phone number'} required 
          className="bg-[var(--foreground)] border-none text-[var(--text1)]
          focus:ring-[var(--primary)]" onChange={(e)=>setPhoneNumber(e.target.value)}
          value={phoneNumber}/>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ein" className="text-left text-[var(--text1)]">{language==='ro'?'Cod Unic de Identificare Companie':'Employer Identification Number'}</Label>
          <Input id="ein" type="text" placeholder={language==='ro'?'CUI':'EIN'} required 
          className="bg-[var(--foreground)] border-none text-[var(--text1)]
          focus:ring-[var(--primary)]" onChange={(e)=>setEin(e.target.value)}
          value={ein}/>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nume prenume" className="text-left text-[var(--text1)]">{language==='ro'?'Utilizator':'Username'}</Label>
          <Input id="nume prenume" type="text" placeholder={language==='ro'?'Nume Prenume':'First & Last Name'} required 
          className="bg-[var(--foreground)] border-none text-[var(--text1)]
          focus:ring-[var(--primary)]" onChange={(e)=>setUsername(e.target.value)}
          value={username}/>
        </div>
        <Button type="submit" className="w-full bg-[var(--primary)]">
          {language==='ro'?'Creeaza cont':'Sign-up'}
        </Button>
      </div>
      {isSignupLoading&&(<div className="inset-0 absolute z-50 min-w-vw min-h-vh bg-black/70
      flex justify-center items-center">
        <div className="max-w-[250px]">
          <LoadingComponent></LoadingComponent>
        </div>
      </div>)}
    </form>
  )
}
