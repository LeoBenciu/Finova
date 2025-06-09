import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDeleteUserAccountMutation, useGetUserDataQuery, useModifyFolderNameMutation, useModifyUserAccountMutation, useModifyUserPasswordMutation } from "@/redux/slices/apiSlice";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import AreYouSureModal from "../AreYouSureModalR";
import { useSelector } from "react-redux";

interface UserProps{
   
}

const User = ({}:UserProps) => {

  const navigate = useNavigate();

  const [email, setEmail] = useState<string>();
  const [name, setName] = useState<string>();
  const [password, setPassword] = useState<string>();
  const [folderName, setFolderName] = useState<string>();
  const [phoneNumber, setPhoneNumber] = useState<string>();
  const [role, setRole] = useState<string>();
  const [isSureModal, setIsSureModal] = useState<boolean>(false);
  const [passwordChanged, setPasswordChanged] = useState<boolean>(false);
  const [folderNameChanged, setFolderNameChanged] = useState<boolean>(false);
  const [accountChanged, setAccountChanged] = useState<boolean>(false);
  
  const { data: userData } = useGetUserDataQuery({});
  const [deleteAccount,{isError:isErrorDeleting}] = useDeleteUserAccountMutation();
  const [updateAccount,{isError:isErrorUpdating}] = useModifyUserAccountMutation();
  const [updateAccountPassword,{isError:isErrorUpdatingPassword}] = useModifyUserPasswordMutation();
  const [updateFolderName, {isError: isErrorUpdatingFolder}] = useModifyFolderNameMutation();
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

  const handleUpdateFolder = async() => {
    try {
      const result = await updateFolderName({folderName}).unwrap();
      console.log(result);
      setFolderNameChanged(true);
      setTimeout(()=>{
        setFolderNameChanged(false);
      },2500)
    } catch (e) {
      console.error(language==='ro'?'Schimbarea numelui folderului a esuat!':'Failed to change folder name!')
    }
  }

  return (
    <div id='User' 
    className="mt-10 mx-10 min-w-96 
    min-h-96 px-10 grid grid-cols-2 items-start col-start-1">
      
      <div className="flex flex-col items-center">
      <h2 className="font-bold text-4xl text-left text-[var(--text1)]">{language==='ro'?'Cont Utilizator':'User Account'}</h2>
      {isErrorDeleting&&(<p className="text-red-500 mt-3 text-left">{language==='ro'?'Stergerea contului a esuat!':'Failed to delete user account!'}</p>)}
      {isErrorUpdating&&(<p className="text-red-500 mt-3 text-left">{language==='ro'?'Nu s-a reușit salvarea detaliilor de utilizator modificate! Vă rugăm să încercați din nou mai târziu!':
      'Failed to save the modified user details! Please try again later!'}</p>)}

      <label htmlFor="nameInput" className="mt-9 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Nume':'Name'}</label>
      <input id='nameInput'
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)] min-w-96
      text-[var(--text1)] border-none shadow-[0_0_10px_rgba(0,0,0,0.3)]"
      value={name} onChange={(e)=>setName(e.target.value)}></input>

      <label htmlFor="emailInput" className="mt-9 text-left text-[var(--text1)]
      min-w-96 px-5">Email</label>
      <input id='emailInput'
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)]
      min-w-96"
      value={email} onChange={(e)=>setEmail(e.target.value)}></input>

      <label htmlFor="phoneInput" className="mt-9 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Numar de telefon':'Phone Number'}</label>
      <input id='phoneInput' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)]
      min-w-96"
      value={phoneNumber} onChange={(e)=>setPhoneNumber(e.target.value)}></input>

      <p className="mt-9 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Rol':'Role'}</p>
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger 
        className=" bg-[var(--foreground)] mt-3 min-w-96 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)]">
          <SelectValue placeholder="User Role" />
        </SelectTrigger>
        <SelectContent 
        className=" mt-3 max-w-96 min-h-11 rounded-2xl p-2 text-[var(--text1)]
        border-none bg-[var(--foreground)] shadow-[0_0_10px_rgba(0,0,0,0.3)]">
          <SelectItem value="USER" className="cursor-pointer">User</SelectItem>
          <SelectItem value="ADMIN" className="cursor-pointer">Admin</SelectItem>
        </SelectContent>
      </Select>

      <button 
      className={`max-w-96 ${accountChanged?'bg-transparent':'bg-[var(--primary)]'} rounded-2xl font-bold text-md mt-15
      hover:bg-[var(--primary)]/30 hover:text-[var(--primary)] flex justify-center
      items-center gap-3 min-w-96`}
       onClick={handleUpdateUserAccount}>
        {accountChanged?(language==='ro'?'Detaliile Contului Schimbate Cu Succes':'Account Details Changed Succesfully'):(language==='ro'?'Salveaza Detaliile Contului':'Save Account Details')}
        {accountChanged&&(<Check size={20}></Check>)}
      </button>

      <button 
      className="max-w-96 bg-transparent rounded-2xl font-bold text-md mt-9
      hover:text-red-300 flex justify-center gap-3 items-center text-red-500
      min-w-96"
      onClick={()=>setIsSureModal(true)}>
        <Trash2 size={20}></Trash2>
        {language==='ro'?'Sterge cont':'Delete account'}
      </button>
      </div>
      

      <div className="flex flex-col items-center">
      <h2 className="font-bold text-4xl text-left text-[var(--text1)]">{language==='ro'?'Parola Cont':'Account Password'}</h2>
      {isErrorUpdatingPassword&&(<p className="text-red-500 mt-3 text-left">{language==='ro'?'Schimbarea parolei a esuat! Va rugam reincercati mai tarziu!':'Failed to change the password! Please try again later!'}</p>)}

      <label htmlFor="passwordInput" className="mt-10 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Parola noua':'New Password'}</label>
      <input id='passwordInput' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)] min-w-96"
      value={password} onChange={(e)=>setPassword(e.target.value)}
      type="password"></input>
      <button 
      className={`max-w-96 ${passwordChanged?'bg-transparent':'bg-[var(--primary)]'} rounded-2xl font-bold text-md mt-15
      hover:bg-[var(--primary)]/30 hover:text-[var(--primary)] flex justify-center
      items-center gap-3 min-w-96`}
      onClick={handleUpdatePassword}>
        {passwordChanged?(language==='ro'?'Parola schimbata cu succes':'Password Changed Succesfully'):(language==='ro'?'Salveaza Parola':'Save New Password')}
        {passwordChanged&&(<Check size={20}></Check>)}
      </button>

      <h2 className="font-bold text-4xl text-left text-[var(--text1)] mt-15">{language==='ro'?'Nume folder RPA':'RPA folder name'}</h2>
      {isErrorUpdatingFolder&&(<p className="text-red-500 mt-3 text-left">{language==='ro'?'Schimbarea numelui folderului a esuat! Va rugam reincercati mai tarziu!':'Failed to change the folder name! Please try again later!'}</p>)}

      <label htmlFor="rpaFolder" className="mt-10 text-left text-[var(--text1)]
      min-w-96 px-5">{language==='ro'?'Nume folder RPA':'RPA folder name'}</label>
      <input id='rpaFolder' 
      className="bg-[var(--foreground)] mt-3 max-w-96 min-h-11 rounded-2xl p-2
      focus:outline-none focus:ring-1 ring-[var(--primary)]
      shadow-[0_0_10px_rgba(0,0,0,0.3)] text-[var(--text1)] min-w-96"
      value={folderName} onChange={(e)=>setFolderName(e.target.value)}
      type="text"></input>
      <button 
      className={`max-w-96 ${folderNameChanged?'bg-transparent':'bg-[var(--primary)]'} rounded-2xl font-bold text-md mt-15
      hover:bg-[var(--primary)]/30 hover:text-[var(--primary)] flex justify-center
      items-center gap-3 min-w-96`}
      onClick={handleUpdateFolder}>
        {folderNameChanged?(language==='ro'?'Folder salvat':'Saved'):(language==='ro'?'Salveaza Folder':'Save Folder')}
        {folderNameChanged&&(<Check size={20}></Check>)}
      </button>
      </div>

      {isSureModal&&(
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

