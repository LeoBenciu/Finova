import { Trash2 } from 'lucide-react';
import React from 'react';

interface LineItemsProps {
  editFile?: Record<string, any>;
  setEditFile: (value: any) => void;
  item: any;
  index: number;
}

const LineItems = React.memo(({ editFile, setEditFile, item, index }: LineItemsProps) => {
  const handleChange = (field: string, value: any) => {
    const updatedLineItems = editFile?.result.line_items.map((line: any, idx: number) =>
      idx === index ? { ...line, [field]: value } : line
    );

    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        line_items: updatedLineItems,
      },
    });
  };

  const handleRemoveLineItem = () => {
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        line_items: editFile?.result.line_items.filter((_: any, idx: number) => idx !== index),
      },
    });
  };

  return (
    <div className="bg-[var(--background)] rounded-3xl min-h-max min-w-full flex-1 grid grid-cols-2 mt-10">
      <div></div>
      <div className="p-4 flex justify-center items-center" onClick={handleRemoveLineItem}>
        <Trash2 size={20} className='hover:text-red-500 cursor-pointer'></Trash2>
      </div>
      <div className="p-4 flex justify-center items-center">Description</div>
      <div className="p-4 flex justify-center items-center">
        <textarea
          value={item ? item.description : '-'}
          className="bg-[var(--card)] min-w-40 max-w-40 min-h-max max-h-40 py-2 rounded-2xl pl-1 text-sm custom-scrollbar"
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>

      <div className="p-4 flex justify-center items-center">Quantity</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.quantity : '-'}
          className="bg-[var(--card)] max-w-35 text-center py-2 rounded-2xl pl-1"
          onChange={(e) => handleChange('quantity', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center">Total</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.total : '-'}
          className="bg-[var(--card)] max-w-35 text-center py-2 rounded-2xl pl-1"
          onChange={(e) => handleChange('total', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center">Unit price</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.unit_price : '-'}
          className="bg-[var(--card)] max-w-35 text-center py-2 rounded-2xl pl-1"
          onChange={(e) => handleChange('unit_price', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center">Vat amount</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.vat_amount : '-'}
          className="bg-[var(--card)] max-w-35 text-center py-2 rounded-2xl pl-1"
          onChange={(e) => handleChange('vat_amount', Number(e.target.value))}
        />
      </div>
    </div>
  );
});

export default LineItems;
