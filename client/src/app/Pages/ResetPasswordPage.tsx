import finovaLogo from '@/assets/2solLqZ3AFncSar4MubKNQ4TreZ.svg'
import { useResetPasswordMutation } from '@/redux/slices/apiSlice'
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const ResetPasswordPage = () => {

    const location = useLocation();
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(location.search);

    const [resetPassword] = useResetPasswordMutation();
    const [newPassword, setNewPassword] = useState<string>('');
    const token = queryParams.get('token');

    interface ResetPasswordResponse {
      message: string;
    }

    const handleResetPassword = async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      try {
        if (newPassword.length > 0) {
          const response: ResetPasswordResponse = await resetPassword({ token, newPassword }).unwrap();
          console.log(response);
          navigate('/authentication');
        }
      } catch (error) {
        console.error('Failed to reset password', error);
      }
    }

  return (
    <div className="bg-[var(--background)] flex items-center
    justify-center min-w-screen min-h-screen flex-col">
        <div className='flex flex-col bg-[var(--foreground)]
        rounded-2xl p-10'>
            <img src={finovaLogo} className='max-w-96'></img>
            <label htmlFor='NewPassword'
            className='mt-10 text-left
            text-[var(--text1)] font-bold
            text-xl min-w-96 px-3'>New Password</label>
            <form onSubmit={handleResetPassword} className='flex flex-col items-center
            justify-center'>
            <input className='min-w-96
            bg-[var(--foreground)] shadow-[0_0_15px_rgba(0,0,0,0.3)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]
              text-[var(--text1)] rounded-2xl min-h-10 px-5
              mt-3' id='NewPassword'
              type='password' value={newPassword}
              onChange={(e)=>setNewPassword(e.target.value)}></input>
            <button className='bg-[var(--primary)]
            rounded-2xl mt-8 hover:bg-[var(--primary)]/50
            hover:text-[var(--primary)]'
            type='submit'>Change Password</button>
            </form>
        </div>
    </div>
  )
}

export default ResetPasswordPage
