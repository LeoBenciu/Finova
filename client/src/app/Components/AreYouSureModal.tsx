import { X } from 'lucide-react'
import * as motion from 'motion/react-client'

interface AreYouSureProps{
    setCloseModal:(is:boolean)=>void;
    setIsModalOpen:(is:boolean)=>void;
}

const AreYouSureModal = ({setCloseModal,setIsModalOpen}:AreYouSureProps) => {
  return (
    <motion.div
    className='
    bg-black/90 fixed inset-0 min-w-vw 
    min-h-vh flex justify-center items-center'>

        <div className="bg-neutral-800 max-w-[27rem] min-h-60 
        min-w-[27rem] max-h-60 rounded-3xl flex border-[1px] border-[var(--card)] flex-col
        px-1">
            <div className='flex flex-row max-h-max py-5 px-8 justify-between min-w-full items-center'>
                <h3 className='text-2xl'>Confirm</h3>
                <X size={25} className='hover:text-red-500 cursor-pointer'
                onClick={()=>setCloseModal(false)}></X>
            </div>

            <p className='mt-2 px-8'>Are you sure you want to exit without saving the file & the processed data?</p>

            <div className='bg-[var(--card)] min-h-[1px] max-h-[1px] mx-10 mt-7'></div>

            <div className='flex flex-row mt-7 justify-end gap-3 px-7'>
                <button className='text-neutral-300 bg-[var(--card)]'
                onClick={()=>setCloseModal(false)}>Cancel</button>
                <button className='bg-[var(--primary)] '
                onClick={()=>{setIsModalOpen(false);
                    setCloseModal(false)
                }}>Exit</button>
            </div>
        </div>

    </motion.div>
  )
}

export default AreYouSureModal
