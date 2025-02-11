import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import googleLogo from '@/assets/google-icon-logo-svgrepo-com.svg'



interface SignupFormProps extends React.ComponentPropsWithoutRef<"form"> {
  language?: string;
}

export function SignupForm({
  className,
  language,
  ...props
}: SignupFormProps) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center min-w-[320px] max-w-[320px]">
        <p className="text-balance text-sm text-muted-foreground">
          {language==='ro'?'Introduceți datele dumneavoastră pentru a crea un cont':
          'Enter your credentials below to create an account'}
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-left">Email</Label>
          <Input id="email" type="email" placeholder={language==='ro'?'exemplu@exemplu.com':'example@example.com'} 
          required 
          className="bg-[var(--background)] border-none"/>
        </div>
        <div className="grid gap-2">
        <Label htmlFor="password" className="text-left">{language==='ro'?'Parola':'Password'}</Label>
          <Input id="password" type="password" placeholder={language==='ro'?'parola': 'password'}
          className="bg-[var(--background)] border-none" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-left">{language==='ro'?'Cod Unic de Identificare Companie':'Employer Identification Number'}</Label>
          <Input id="email" type="email" placeholder={language==='ro'?'CUI':'EIN'} required 
          className="bg-[var(--background)] border-none"/>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-left">{language==='ro'?'Utilizator':'Username'}</Label>
          <Input id="email" type="email" placeholder={language==='ro'?'Nume Prenume':'First & Last Name'} required 
          className="bg-[var(--background)] border-none"/>
        </div>
        <Button type="submit" className="w-full bg-[var(--primary)]">
          Login
        </Button>
        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-[var(--foreground)] px-2 text-muted-foreground">
            {language==='ro'?'Sau continuă cu':'Or continue with'}
          </span>
        </div>
        <Button variant="outline" className="w-full">
         <img src={googleLogo} className="size-5"/>
          {language==='ro'?'Contectează-te cu Google':'Signup with Google'}
        </Button>
      </div>
    </form>
  )
}
