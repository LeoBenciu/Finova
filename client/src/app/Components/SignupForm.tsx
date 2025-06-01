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

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [ein, setEin] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);

  // Legal agreements state
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    dpa: false,
    cookies: false,
    marketing: false
  });

  const [agreementErrors, setAgreementErrors] = useState<{[key: string]: boolean}>({});

  const [signup, { isLoading: isSignupLoading, isError: isSignupError }] = useSignupMutation();

  const handleCheckboxChange = (key: keyof typeof agreements) => {
    setAgreements(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    
    // Clear error when user checks the box
    if (agreementErrors[key]) {
      setAgreementErrors(prev => ({
        ...prev,
        [key]: false
      }));
    }
  };

  const validateAgreements = () => {
    const newErrors: {[key: string]: boolean} = {};
    
    // Required checkboxes
    if (!agreements.terms) newErrors.terms = true;
    if (!agreements.privacy) newErrors.privacy = true;
    if (!agreements.dpa) newErrors.dpa = true;
    if (!agreements.cookies) newErrors.cookies = true;
    
    setAgreementErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignupButton = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate agreements first
    if (!validateAgreements()) {
      return;
    }

    try {
      const response = await signup({
        email,
        password,
        phoneNumber,
        ein,
        username,
        agreements // Include agreements in the signup data
      }).unwrap();
      console.log(response);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        window.location.reload();
      }, 1000);
    } catch (e) {
      console.error('Failed to signup user');
    }
  };

  const CheckboxItem = ({ 
    id, 
    checked, 
    onChange, 
    required = false, 
    error = false, 
    children 
  }: {
    id: string;
    checked: boolean;
    onChange: () => void;
    required?: boolean;
    error?: boolean;
    children: React.ReactNode;
  }) => (
    <div className={`border rounded-lg p-3 transition-colors ${
      error ? 'border-red-300 bg-red-50' : 
      checked ? 'border-green-300 bg-green-50' : 
      'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <label className="flex items-start gap-3 cursor-pointer">
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={onChange}
            className="sr-only"
          />
          <div className={`w-4 h-4 border-2 rounded transition-all duration-200 ${
            checked 
              ? 'bg-[var(--primary)] border-[var(--primary)]' 
              : error 
                ? 'border-red-400 bg-white'
                : 'border-gray-300 bg-white hover:border-[var(--primary)]'
          }`}>
            {checked && (
              <svg className="w-2.5 h-2.5 text-white absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1">
            {required && <span className="text-red-500 text-xs font-medium">*</span>}
            {children}
          </div>
          {error && (
            <p className="text-red-600 text-xs mt-1">
              {language === 'ro' 
                ? 'Acest acord este obligatoriu pentru crearea contului'
                : 'This agreement is required to create an account'
              }
            </p>
          )}
        </div>
      </label>
    </div>
  );

  const allRequiredAgreementsChecked = agreements.terms && agreements.privacy && agreements.dpa && agreements.cookies;

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleSignupButton}>
      <div className="flex flex-col items-center gap-2 text-center min-w-[320px] max-w-[400px]">
        {!isSignupError && !success && (
          <p className="text-balance text-sm text-muted-foreground text-[var(--text3)]">
            {language === 'ro' 
              ? 'Introduceți datele dumneavoastră pentru a crea un cont'
              : 'Enter your credentials below to create an account'}
          </p>
        )}
        {isSignupError && (
          <p className="text-red-500 font-normal text-base">
            {language === 'ro' 
              ? 'Crearea contului de utilizator a eșuat! Vă rugăm să verificați dacă datele introduse sunt corecte!'
              : 'Failed user account creation! Please check if the inserted details are correct!'}
          </p>
        )}
        {success && (
          <p className="text-green-500 font-normal text-base">
            {language === 'ro' 
              ? 'Contul dumneavoastră a fost creat cu succes!'
              : 'Account created successfully!'}
          </p>
        )}
      </div>

      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-left text-[var(--text1)]">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder={language === 'ro' ? 'exemplu@exemplu.com' : 'example@example.com'} 
            required  
            onChange={(e) => setEmail(e.target.value)} 
            value={email}
            className="bg-[var(--foreground)] border-none text-[var(--text1)] focus:ring-[var(--primary)]"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password" className="text-left text-[var(--text1)]">
            {language === 'ro' ? 'Parola' : 'Password'}
          </Label>
          <Input 
            id="password" 
            type="password" 
            placeholder={language === 'ro' ? 'Parola' : 'Password'}
            className="bg-[var(--foreground)] border-none text-[var(--text1)] focus:ring-[var(--primary)]" 
            required 
            onChange={(e) => setPassword(e.target.value)} 
            value={password}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phoneNumber" className="text-left text-[var(--text1)]">
            {language === 'ro' ? 'Număr de telefon (ex: +40#########)' : 'Phone Number'}
          </Label>
          <Input 
            id="phoneNumber" 
            type="tel" 
            placeholder={language === 'ro' ? 'Număr de telefon' : 'Phone number'} 
            required 
            className="bg-[var(--foreground)] border-none text-[var(--text1)] focus:ring-[var(--primary)]" 
            onChange={(e) => setPhoneNumber(e.target.value)}
            value={phoneNumber}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ein" className="text-left text-[var(--text1)]">
            {language === 'ro' ? 'Cod Unic de Identificare Companie' : 'Employer Identification Number'}
          </Label>
          <Input 
            id="ein" 
            type="text" 
            placeholder={language === 'ro' ? 'CUI' : 'EIN'} 
            required 
            className="bg-[var(--foreground)] border-none text-[var(--text1)] focus:ring-[var(--primary)]" 
            onChange={(e) => setEin(e.target.value)}
            value={ein}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="username" className="text-left text-[var(--text1)]">
            {language === 'ro' ? 'Utilizator' : 'Username'}
          </Label>
          <Input 
            id="username" 
            type="text" 
            placeholder={language === 'ro' ? 'Nume Prenume' : 'First & Last Name'} 
            required 
            className="bg-[var(--foreground)] border-none text-[var(--text1)] focus:ring-[var(--primary)]" 
            onChange={(e) => setUsername(e.target.value)}
            value={username}
          />
        </div>

        <div className="grid gap-3">
          <h3 className="text-sm font-medium text-[var(--text1)]">
            {language === 'ro' 
              ? 'Acceptarea Termenilor și Condițiilor'
              : 'Terms and Conditions Acceptance'}
          </h3>

          <CheckboxItem
            id="terms"
            checked={agreements.terms}
            onChange={() => handleCheckboxChange('terms')}
            required={true}
            error={agreementErrors.terms}
          >
            <div className="text-xs text-[var(--text1)]">
              <span className="font-medium">
                {language === 'ro' ? 'Accept ' : 'I accept '}
              </span>
              <a href="/terms" target="_blank" className="text-[var(--primary)] hover:underline font-medium">
                {language === 'ro' 
                  ? 'Termenii și Condițiile de Utilizare'
                  : 'Terms and Conditions of Use'}
              </a>
            </div>
          </CheckboxItem>

          <CheckboxItem
            id="privacy"
            checked={agreements.privacy}
            onChange={() => handleCheckboxChange('privacy')}
            required={true}
            error={agreementErrors.privacy}
          >
            <div className="text-xs text-[var(--text1)]">
              <span className="font-medium">
                {language === 'ro' ? 'Accept ' : 'I accept '}
              </span>
              <a href="/privacy" target="_blank" className="text-[var(--primary)] hover:underline font-medium">
                {language === 'ro' 
                  ? 'Politica de Confidențialitate'
                  : 'Privacy Policy'}
              </a>
            </div>
          </CheckboxItem>

          <CheckboxItem
            id="dpa"
            checked={agreements.dpa}
            onChange={() => handleCheckboxChange('dpa')}
            required={true}
            error={agreementErrors.dpa}
          >
            <div className="text-xs text-[var(--text1)]">
              <span className="font-medium">
                {language === 'ro' ? 'Accept ' : 'I accept '}
              </span>
              <a href="/dpa" target="_blank" className="text-[var(--primary)] hover:underline font-medium">
                {language === 'ro' 
                  ? 'Acordul de Prelucrare a Datelor (DPA)'
                  : 'Data Processing Agreement (DPA)'}
              </a>
            </div>
          </CheckboxItem>

          <CheckboxItem
            id="cookies"
            checked={agreements.cookies}
            onChange={() => handleCheckboxChange('cookies')}
            required={true}
            error={agreementErrors.cookies}
          >
            <div className="text-xs text-[var(--text1)]">
              <span className="font-medium">
                {language === 'ro' ? 'Accept ' : 'I accept '}
              </span>
              <a href="/cookies" target="_blank" className="text-[var(--primary)] hover:underline font-medium">
                {language === 'ro' 
                  ? 'Politica de Cookie-uri'
                  : 'Cookies Policy'}
              </a>
            </div>
          </CheckboxItem>

          <CheckboxItem
            id="marketing"
            checked={agreements.marketing}
            onChange={() => handleCheckboxChange('marketing')}
            required={false}
            error={false}
          >
            <div className="text-xs text-[var(--text1)]">
              <span>
                {language === 'ro' 
                  ? 'Sunt de acord să primesc comunicări de marketing prin email'
                  : 'I agree to receive marketing communications via email'}
              </span>
              <div className="text-xs text-gray-500 mt-0.5">
                {language === 'ro' 
                  ? 'Opțional - puteți revoca oricând'
                  : 'Optional - you can revoke anytime'}
              </div>
            </div>
          </CheckboxItem>
        </div>

        <div className="text-center">
          <div className="text-xs text-[var(--text3)] mb-1">
            {language === 'ro' 
              ? `Progres: ${Object.values(agreements).filter(Boolean).length} din ${Object.keys(agreements).length} acorduri`
              : `Progress: ${Object.values(agreements).filter(Boolean).length} of ${Object.keys(agreements).length} agreements`}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-[var(--primary)] h-1.5 rounded-full transition-all duration-300" 
              style={{ width: `${(Object.values(agreements).filter(Boolean).length / Object.keys(agreements).length) * 100}%` }}
            ></div>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full bg-[var(--primary)] disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={!allRequiredAgreementsChecked}
        >
          {allRequiredAgreementsChecked
            ? (language === 'ro' ? 'Creează cont' : 'Sign-up')
            : (language === 'ro' ? 'Acceptați acordurile obligatorii' : 'Accept required agreements')
          }
        </Button>
      </div>

      {isSignupLoading && (
        <div className="inset-0 absolute z-50 min-w-vw min-h-vh bg-black/70 flex justify-center items-center">
          <div className="max-w-[250px]">
            <LoadingComponent />
          </div>
        </div>
      )}
    </form>
  );
}