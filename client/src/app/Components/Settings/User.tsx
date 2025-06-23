import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDeleteUserAccountMutation, useGetUserDataQuery, useModifyUserAccountMutation, useModifyUserPasswordMutation } from "@/redux/slices/apiSlice";
import { Check, Trash2, UserRound, Lock, Mail, Phone, Shield, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import AreYouSureModal from "../AreYouSureModalR";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";

interface UserProps{
   
}

const User = ({}:UserProps) => {

  const navigate = useNavigate();

  const [email, setEmail] = useState<string>();
  const [name, setName] = useState<string>();
  const [password, setPassword] = useState<string>();
  const [phoneNumber, setPhoneNumber] = useState<string>();
  const [role, setRole] = useState<string>();
  const [isSureModal, setIsSureModal] = useState<boolean>(false);
  const [passwordChanged, setPasswordChanged] = useState<boolean>(false);
  const [accountChanged, setAccountChanged] = useState<boolean>(false);
  
  const { data: userData } = useGetUserDataQuery({});
  const [deleteAccount,{isError:isErrorDeleting}] = useDeleteUserAccountMutation();
  const [updateAccount,{isError:isErrorUpdating}] = useModifyUserAccountMutation();
  const [updateAccountPassword,{isError:isErrorUpdatingPassword}] = useModifyUserPasswordMutation();
  const language = useSelector((state:{user:{language:string}})=>state.user.language);


  useEffect(()=>{
    setEmail(userData?.email);
    setName(userData?.name);
    setPhoneNumber(userData?.phoneNumber);
    setRole(userData?.role);
  },[userData])
  
  const handleDeleteAccount=async()=>{
    try {
      await deleteAccount({}).unwrap();
      navigate('/authentication')
    } catch (e) {
      console.error(language==='ro'?'Stergerea contului a esuat':'Failed to cancel user account')
    }
  };

  const handleUpdateUserAccount=async()=>{
    try {
      await updateAccount({name,email,role,phoneNumber}).unwrap();
      setAccountChanged(true);
      setTimeout(()=>{
        setAccountChanged(false);
      },2000)
    } catch (e) {
      console.error('Failed to change user details!')
    }
  };

  const handleUpdatePassword = async() =>{
    try {
      const result = await updateAccountPassword({password}).unwrap();
      console.log(result);
      setPasswordChanged(true);
      setTimeout(()=>{
        setPasswordChanged(false);
      },2500)
    } catch (e) {
      console.error(language==='ro'?'Schimbarea parolei a esuat!':'Failed to change user password!')
    }
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <UserRound size={35} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[var(--text1)] mb-2 text-left">
              {language==='ro'?'Setări Cont':'Account Settings'}
            </h1>
            <p className="text-[var(--text2)] text-lg text-left">
              {language === 'ro' 
                ? 'Gestionează-ți informațiile de cont și preferințele' 
                : 'Manage your account information and preferences'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Account Details Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden"
        >
          {/* Card Header */}
          <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)]/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                <UserRound size={24} className="text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--text1)]">
                  {language==='ro'?'Detalii Cont':'Account Details'}
                </h2>
                <p className="text-[var(--text2)] text-sm">
                  {language==='ro'?'Actualizează informațiile tale personale':'Update your personal information'}
                </p>
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-6">
            {/* Error Messages */}
            {isErrorDeleting && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-50 border border-red-200 rounded-2xl"
              >
                <p className="text-red-600 text-sm font-medium">
                  {language==='ro'?'Stergerea contului a esuat!':'Failed to delete user account!'}
                </p>
              </motion.div>
            )}
            
            {isErrorUpdating && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-50 border border-red-200 rounded-2xl"
              >
                <p className="text-red-600 text-sm font-medium">
                  {language==='ro'?'Nu s-a reușit salvarea detaliilor de utilizator modificate! Vă rugăm să încercați din nou mai târziu!':
                  'Failed to save the modified user details! Please try again later!'}
                </p>
              </motion.div>
            )}

            {/* Name Field */}
            <div className="space-y-2">
              <label htmlFor="nameInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                <UserRound size={16} />
                {language==='ro'?'Nume':'Name'}
              </label>
              <input 
                id='nameInput'
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md"
                value={name || ''} 
                onChange={(e)=>setName(e.target.value)}
                placeholder={language==='ro'?'Introduceți numele':'Enter your name'}
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="emailInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                <Mail size={16} />
                Email
              </label>
              <input 
                id='emailInput'
                type="email"
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md"
                value={email || ''} 
                onChange={(e)=>setEmail(e.target.value)}
                placeholder={language==='ro'?'Introduceți email-ul':'Enter your email'}
              />
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <label htmlFor="phoneInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                <Phone size={16} />
                {language==='ro'?'Număr de telefon':'Phone Number'}
              </label>
              <input 
                id='phoneInput'
                type="tel"
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md"
                value={phoneNumber || ''} 
                onChange={(e)=>setPhoneNumber(e.target.value)}
                placeholder={language==='ro'?'Introduceți numărul de telefon':'Enter your phone number'}
              />
            </div>

            {/* Role Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                <Shield size={16} />
                {language==='ro'?'Rol':'Role'}
              </label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md">
                  <SelectValue placeholder={language==='ro'?'Selectați rolul':'Select role'} />
                </SelectTrigger>
                <SelectContent className="bg-[var(--foreground)] border border-[var(--text4)] rounded-2xl shadow-lg">
                  <SelectItem value="USER" className="cursor-pointer hover:bg-[var(--primary)]/10">User</SelectItem>
                  <SelectItem value="ADMIN" className="cursor-pointer hover:bg-[var(--primary)]/10">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Save Button */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl
                flex items-center justify-center gap-3 ${
                accountChanged
                  ? 'bg-green-50 border-2 border-green-200 text-green-700'
                  : 'bg-gradient-to-r from-[var(--primary)] to-blue-500 text-white hover:from-[var(--primary)]/90 hover:to-blue-400'
              }`}
              onClick={handleUpdateUserAccount}
              disabled={accountChanged}
            >
              {accountChanged ? (
                <>
                  <Check size={20} />
                  {language==='ro'?'Detaliile Contului Schimbate Cu Succes':'Account Details Changed Successfully'}
                </>
              ) : (
                <>
                  <Save size={20} />
                  {language==='ro'?'Salvează Detaliile Contului':'Save Account Details'}
                </>
              )}
            </motion.button>

            {/* Delete Button */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-semibold
              hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center gap-3"
              onClick={()=>setIsSureModal(true)}
            >
              <Trash2 size={18} />
              {language==='ro'?'Șterge cont':'Delete account'}
            </motion.button>
          </div>
        </motion.div>

        {/* Password Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-[var(--foreground)] rounded-3xl border border-[var(--text4)] shadow-lg overflow-hidden"
        >
          {/* Card Header */}
          <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)]/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                <Lock size={24} className="text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--text1)]">
                  {language==='ro'?'Schimbă Parola':'Change Password'}
                </h2>
                <p className="text-[var(--text2)] text-sm">
                  {language==='ro'?'Actualizează parola contului tău':'Update your account password'}
                </p>
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-6">
            {/* Error Message */}
            {isErrorUpdatingPassword && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-50 border border-red-200 rounded-2xl"
              >
                <p className="text-red-600 text-sm font-medium">
                  {language==='ro'?'Schimbarea parolei a eșuat! Vă rugăm reîncercați mai târziu!':'Failed to change the password! Please try again later!'}
                </p>
              </motion.div>
            )}

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="passwordInput" className="flex items-center gap-2 text-sm font-semibold text-[var(--text1)]">
                <Lock size={16} />
                {language==='ro'?'Parola nouă':'New Password'}
              </label>
              <input 
                id='passwordInput'
                type="password"
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] transition-all duration-300 shadow-sm hover:shadow-md"
                value={password || ''} 
                onChange={(e)=>setPassword(e.target.value)}
                placeholder={language==='ro'?'Introduceți parola nouă':'Enter new password'}
              />
            </div>

            {/* Save Password Button */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl
                flex items-center justify-center gap-3 ${
                passwordChanged
                  ? 'bg-green-50 border-2 border-green-200 text-green-700'
                  : 'bg-gradient-to-r from-[var(--primary)] to-blue-500 text-white hover:from-[var(--primary)]/90 hover:to-blue-400'
              }`}
              onClick={handleUpdatePassword}
              disabled={passwordChanged || !password}
            >
              {passwordChanged ? (
                <>
                  <Check size={20} />
                  {language==='ro'?'Parola schimbată cu succes':'Password Changed Successfully'}
                </>
              ) : (
                <>
                  <Save size={20} />
                  {language==='ro'?'Salvează Parola':'Save New Password'}
                </>
              )}
            </motion.button>

            {/* Security Tips */}
            <div className="mt-8 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-2xl">
              <h4 className="font-semibold text-[var(--text1)] mb-2 flex items-center gap-2">
                <Shield size={16} className="text-[var(--primary)]" />
                {language==='ro'?'Sfaturi de securitate':'Security Tips'}
              </h4>
              <ul className="text-sm text-[var(--text2)] space-y-1">
                <li>• {language==='ro'?'Folosește o parolă puternică cu cel puțin 8 caractere':'Use a strong password with at least 8 characters'}</li>
                <li>• {language==='ro'?'Combină litere mari, mici, cifre și simboluri':'Combine uppercase, lowercase, numbers and symbols'}</li>
                <li>• {language==='ro'?'Nu folosi aceeași parolă pentru mai multe conturi':'Don\'t use the same password for multiple accounts'}</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal */}
      {isSureModal && (
        <AreYouSureModal
          setIsSureModal={setIsSureModal}
          setAction={handleDeleteAccount}
          confirmButton='Delete'
          text="Are you sure you want to permanently DELETE your account?"
        />
      )}
    </div>
  )
}

export default User