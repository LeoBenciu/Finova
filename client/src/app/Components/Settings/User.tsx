import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2 } from "lucide-react";

interface UserProps{
    email:string | undefined;
    password:string | undefined;
    name: string | undefined;
    phoneNumber:string | undefined;
    setEmail: React.Dispatch<React.SetStateAction<string | undefined>>;
    setPassword: React.Dispatch<React.SetStateAction<string | undefined>>;
    setName: React.Dispatch<React.SetStateAction<string | undefined>>;
    setPhoneNumber: React.Dispatch<React.SetStateAction<string | undefined>>;
}

const User = ({email, setEmail, password, setPassword, name, setName, phoneNumber,setPhoneNumber}:UserProps) => {
  return (
    <div id='User' 
    className="mt-10 mx-10 min-w-96 
    min-h-96 px-10 grid grid-cols-2 items-start col-start-1">
      
      <div className="flex flex-col">
      <h2 className="font-bold text-4xl text-left">User Account</h2>

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
      <Select >
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
      className="max-w-96 bg-[var(--primary)] rounded-2xl font-bold text-md mt-15
       hover:bg-[var(--primary)]/30 hover:text-[var(--primary)]">
        Save Account Details
      </button>

      <button 
      className="max-w-96 bg-transparent rounded-2xl font-bold text-md mt-9
      text-white flex justify-center gap-3 items-center hover:text-red-500">
        <Trash2 size={20}></Trash2>
        Delete Account
      </button>
      </div>
      

      <div className="flex flex-col">
      <h2 className="font-bold text-4xl text-left">Account Password</h2>

      <label htmlFor="passwordInput" className="mt-10 text-left">New Password</label>
      <input id='passwordInput' 
      className="bg-[var(--card)] mt-3 max-w-96 min-h-11 rounded-2xl p-2"
      value={password} onChange={(e)=>setPassword(e.target.value)}
      type="password"></input>
      <button 
      className="max-w-96 bg-[var(--primary)] rounded-2xl font-bold text-md mt-15
      hover:bg-[var(--primary)]/30 hover:text-[var(--primary)]">
        Save New Password
      </button>
      </div>

    </div>
  )
}

export default User
