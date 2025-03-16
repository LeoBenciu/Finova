import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDeleteUserAccountMutation, useGetUserDataQuery, useModifyUserAccountMutation, useModifyUserPasswordMutation } from "@/redux/slices/apiSlice";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import AreYouSureModal from "../AreYouSureModalR";

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
      console.error('Failed to cancel user account')
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
      console.error('Failed to change user password!')
    }
  }

  return (
    <div id='User' 
    className="mt-10 mx-10 min-w-96 
    min-h-96 px-10 grid grid-cols-2 items-start col-start-1">
      
      <div className="flex flex-col">
      <h2 className="font-bold text-4xl text-left">User Account</h2>
      {isErrorDeleting&&(<p className="text-red-500 mt-3 text-left">Failed to delete the user account!</p>)}
      {isErrorUpdating&&(<p className="text-red-500 mt-3 text-left">Failed to save the modified user details! Please try again later!</p>)}

      <label htmlFor="nameInput" className="mt-9 text-left">Name</label>
      <input id='nameInput'
      className="bg-[var(--card)] mt-3 max-w-96 min-h-11 rounded-2xl p-2"
      value={name} onChange={(e)=>setName(e.target.value)}></input>

      <label htmlFor="emailInput" className="mt-9 text-left">Email</label>
      <input id='emailInput'
      className="bg-[var(--card)] mt-3 max-w-96 min-h-11 rounded-2xl p-2"
      value={email} onChange={(e)=>setEmail(e.target.value)}></input>

      <label htmlFor="phoneInput" className="mt-9 text-left">Phone Number</label>
      <input id='phoneInput' 
      className=" mt-3 max-w-96 min-h-11 rounded-2xl p-2 bg-[var(--card)]"
      value={phoneNumber} onChange={(e)=>setPhoneNumber(e.target.value)}></input>

      <p className="mt-9 text-left">Role</p>
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger 
        className=" mt-3 max-w-96 min-h-11 rounded-2xl p-2 bg-[var(--card)]
        focus:ring-[var(--primary)]">
          <SelectValue placeholder="User Role" />
        </SelectTrigger>
        <SelectContent 
        className=" mt-3 max-w-96 min-h-11 rounded-2xl p-2 bg-[var(--card)] 
        border-none">
          <SelectItem value="USER">User</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
        </SelectContent>
      </Select>

      <button 
      className={`max-w-96 ${accountChanged?'bg-transparent':'bg-[var(--primary)]'} rounded-2xl font-bold text-md mt-15
      hover:bg-[var(--primary)]/30 hover:text-[var(--primary)] flex justify-center
      items-center gap-3`}
       onClick={handleUpdateUserAccount}>
        {accountChanged?'Account Details Changed Succesfully':'Save Account Details'}
        {accountChanged&&(<Check size={20}></Check>)}
      </button>

      <button 
      className="max-w-96 bg-transparent rounded-2xl font-bold text-md mt-9
      text-white flex justify-center gap-3 items-center hover:text-red-500"
      onClick={()=>setIsSureModal(true)}>
        <Trash2 size={20}></Trash2>
        Delete Account
      </button>
      </div>
      

      <div className="flex flex-col">
      <h2 className="font-bold text-4xl text-left">Account Password</h2>
      {isErrorUpdatingPassword&&(<p className="text-red-500 mt-3 text-left">Failed to change the password! Please try again later!</p>)}

      <label htmlFor="passwordInput" className="mt-10 text-left">New Password</label>
      <input id='passwordInput' 
      className="bg-[var(--card)] mt-3 max-w-96 min-h-11 rounded-2xl p-2"
      value={password} onChange={(e)=>setPassword(e.target.value)}
      type="password"></input>
      <button 
      className={`max-w-96 ${passwordChanged?'bg-transparent':'bg-[var(--primary)]'} rounded-2xl font-bold text-md mt-15
      hover:bg-[var(--primary)]/30 hover:text-[var(--primary)] flex justify-center
      items-center gap-3`}
      onClick={handleUpdatePassword}>
        {passwordChanged?'Password Changed Succesfully':'Save New Password'}
        {passwordChanged&&(<Check size={20}></Check>)}
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
