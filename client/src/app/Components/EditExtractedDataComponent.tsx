import { useEffect } from 'react';
import pd from '../../assets/8_00114778_1732535358.pdf';
import LoadingComponent from './LoadingComponent';
import { X } from 'lucide-react';

interface EditExtractedDataProps {
  isLoading: boolean;
  editFile?: Record<string, any>;
  setEditFile: (value: any) => void;
  setIsModalOpen: (val:boolean)=>void;
}

const EditExtractedDataComponent = ({ isLoading, editFile, setEditFile, setIsModalOpen }: EditExtractedDataProps) => {

  useEffect(()=>{
    console.log(editFile)
  },[editFile])

  return (
    <div className="bg-black/80 fixed inset-0 min-w-vw min-h-vh flex justify-center items-center">
      <div className="bg-neutral-800 max-w-[70rem] min-h-[95vh] min-w-[70rem] max-h-[95vh] rounded-3xl flex">

        <div className="flex-2 border-r-2 border-neutral-900 bg-[var(--background)] rounded-tl-3xl rounded-bl-3xl">
          <div className='flex items-center px-5'>
            <X size={30} className='text-red-500 cursor-pointer' onClick={()=>setIsModalOpen(false)}></X>
            <h3 className="text-left font-bold text-3xl mt-5 ml-5 mb-5">Document</h3>
          </div>
          <iframe
            src={pd}
            className="min-w-[96%] max-w-[96%] mx-auto min-h-[90%] max-h-[90%] flex-1 rounded-xl"
            width="100%"
            height="100%"
          />
        </div>

        <div className="flex-1">
          <div className="relative min-h-[1005] max-h-[100%] overflow-auto">
            <div
              className={`absolute inset-0 flex justify-center items-center transition-opacity duration-300 ${
                isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="w-[150px] bg-[var(--background)] rounded-4xl py-6 px-5">
                <LoadingComponent />
              </div>
            </div>

            <div
              className={`transition-opacity duration-300 ${
                isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'
              } min-h-[790px]`}
            >
              <div className='flex flex-row justify-between items-center p-5 pb-0'>
                <h3 className="text-left font-bold text-3xl">Extracted data</h3>
                <button className='bg-[var(--primary)] max-h-8 p-2 px-4 flex justify-center items-center'>Save</button>
              </div>  
                        
              <div className="p-4 flex justify-center items-center min-h-[790px]">
                <div className='bg-[var(--background)] rounded-3xl min-h-[790px] flex-1 grid grid-cols-2'>
                  <div className="p-4 flex justify-center items-center">Document Type</div>
                  <div className="p-4 flex justify-center items-center">{editFile?.result.document_type}</div>
                  {editFile?.result.receipt_of&&(
                    <div className="p-4 flex justify-center items-center">Receipt for Invoice No.</div>
                  )}
                  {editFile?.result.receipt_of&&(
                  <div className="p-4 flex justify-center items-center">{editFile?.result.receipt_of}</div>
                  )}
                  <div className="p-4 flex justify-center items-center">Document Number</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.document_number?editFile?.result.document_number:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">Date</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.document_date?editFile?.result.document_date:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">Due Date</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.due_date?editFile?.result.due_date:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">Buyer</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.buyer?editFile?.result.buyer:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">Buyer EIN</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.buyer_ein?editFile?.result.buyer_ein:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">Vendor</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.vendor?editFile?.result.vendor:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">Vendor EIN</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.vendor_ein?editFile?.result.vendor_ein:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">Total Amount</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.total_amount?editFile?.result.total_amount:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>

                  <div className="p-4 flex justify-center items-center">VAT Amount</div>
                  <div className="p-4 flex justify-center items-center">
                    <input value={editFile?.result.vat_amount?editFile?.result.vat_amount:'-'}
                    className='bg-[var(--card)] max-w-30 text-center py-2 rounded-2xl pl-1'>
                    </input>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditExtractedDataComponent;