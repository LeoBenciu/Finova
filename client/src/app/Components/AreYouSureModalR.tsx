import { X } from 'lucide-react'
import * as motion from 'motion/react-client'
import { useSelector } from 'react-redux';

interface AreYouSureProps{
    setIsSureModal:(is:boolean)=>void;
    setAction:()=>void;
    text:string;
    confirmButton:string;
}

const AreYouSureModal = ({setIsSureModal,setAction,text,confirmButton}:AreYouSureProps) => {


    const language = useSelector((state:{user:{language:string}})=>state.user.language);

  return (
    <motion.div
    className='
    bg-black/90 fixed inset-0 min-w-vw 
    min-h-vh flex justify-center items-center'>

        <div className="bg-[var(--foreground)] max-w-[27rem] min-h-60 
        min-w-[27rem] max-h-60 rounded-3xl flex border-[1px] border-[var(--card)] flex-col
        px-1">
            <div className='flex flex-row max-h-max py-5 px-8 justify-between min-w-full items-center'>
                <h3 className='text-2xl text-[var(--text1)]'>Confirm</h3>
                <X size={25} className='hover:text-red-300 text-red-500 cursor-pointer'
                onClick={()=>setIsSureModal(false)}></X>
            </div>

            <p className='mt-2 px-8 text-[var(--text2)]'>{text}</p>

            <div className='bg-[var(--card)] min-h-[1px] max-h-[1px] mx-10 mt-7'></div>

            <div className='flex flex-row mt-7 justify-end gap-3 px-7'>
                <button className='bg-[var(--background)] text-[var(--text1)]'
                onClick={()=>setIsSureModal(false)}>{language==='ro'?'Anuleaza':'Cancel'}</button>
                <button className='bg-[var(--primary)] '
                onClick={()=>{setAction();
                    setIsSureModal(false)
                }}>{confirmButton}</button>
            </div>
        </div>

    </motion.div>
  )
}

export default AreYouSureModal
