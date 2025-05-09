import { useGetManagementQuery } from '@/redux/slices/apiSlice';
import { Trash2 } from 'lucide-react';
import React from 'react';
import { useSelector } from 'react-redux';

interface LineItemsProps {
  editFile?: Record<string, any>;
  setEditFile: (value: any) => void;
  item: any;
  index: number;
}

export interface Management {
  analitic371: string | null,
  analitic378: string | null,
  analitic607: string | null,
  analitic707: string | null,
  analitic4428: string | null,
  clientCompanyId: number | null,
  code: number | null,
  id: number | null,
  isSellingPrice: boolean,
  manager: string | null,
  name: string,
  type: string | null,
  vatRate: string | null,
}

const LineItems = React.memo(({ editFile, setEditFile, item, index}: LineItemsProps) => {
  const currentClientCompanyId = useSelector((state:{clientCompany:{current:{name:string,ein:string}}})=>state.clientCompany.current.ein);
  const id = currentClientCompanyId;
  const { data: managementList } = useGetManagementQuery(id);

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
    console.log('ssdafs',editFile);
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        line_items: editFile?.result.line_items.filter((_: any, idx: number) => idx !== index),
      },
    });
  };
  const language = useSelector((state:{user:{language:string}})=>state.user.language);

  console.log('current ein:',id);
  console.log('buyer ein:',item?.buyer_ein);

  return (
    <div className="bg-[var(--background)] rounded-3xl min-h-max min-w-full flex-1 grid grid-cols-2 mt-10">
      <div className={`p-4 flex justify-center items-center ${item?.isNew? 'bg-[var(--primary)]' : 'bg-transparent'} max-w-max max-h-[10px] mx-auto
      rounded-lg my-auto`}>
        {item&& item.isNew&&(<p className='text-white font-bold'>{language==='ro'?'Nou':'New'}</p>)}
      </div>
      <div className="p-4 flex justify-center items-center" onClick={handleRemoveLineItem}>
        <Trash2 size={20} className='hover:text-red-300 text-red-500 cursor-pointer'></Trash2>
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Denumire':'Name'}</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.name : '-'}
          className="bg-[var(--foreground)] max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Cantitate':'Quantity'}</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.quantity : '-'}
          className="bg-[var(--foreground)] max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e) => handleChange('quantity', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">Total</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.total : '-'}
          className="bg-[var(--foreground)] max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e) => handleChange('total', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Pret articol':'Unit price'}</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.unit_price : '-'}
          className="bg-[var(--foreground)] max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e) => handleChange('unit_price', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'TVA':'Vat amount'}</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? (item.vat_amount? item.vat_amount : '0'):'-'}
          className="bg-[var(--foreground)] max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e) => handleChange('vat_amount', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Tip':'Type'}</div>
      <div className="p-4 flex justify-center items-center">
      {id===item.buyer_ein&&(
        <select className="bg-[var(--foreground)] min-w-35 max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]" defaultValue={item? item.type?.toUpperCase():'NEDEFINIT'}
          onChange={(e)=>handleChange('type', e.target.value)}>
          <option value="NEDEFINIT">Nedefinit</option>
          <option value="MARFURI">Marfuri</option>
          <option value="MATERII_PRIME">Materii prime</option>
          <option value="MATERIALE_AUXILIARE">Materiale auxiliare</option>
          <option value="COMBUSTIBILI">Combustibili</option>
          <option value="PIESE_DE_SCHIMB">Piese de schimb</option>
          <option value="ALTE_MATERIALE_CONSUMABILE">Alte mat. consumabile</option>
          <option value="AMBALAJE">Ambalaje</option>
          <option value="OBIECTE_DE_INVENTAR">Obiecte de inventar</option>
          <option value="AMENAJARI_PROVIZORII">Amenajari provizorii</option>
          <option value="MATERIALE_SPRE_PRELUCRARE">Mat. spre prelucrare</option>
          <option value="MATERIALE_IN_PASTRARE_SAU_CONSIGNATIE">Mat. in pastrare/consig</option>
          <option value="DISCOUNT_FINANCIAL_INTRARI">Discount financiar intrari</option>
          <option value="DISCOUNT_COMERCIAL_INTRARI">Discount comercial intrari</option>
          <option value="AMBALAJE_SGR">Ambalaje SGR</option>
        </select>
      )}

      {id!==item.buyer_ein&&(
        <select className="bg-[var(--foreground)] min-w-35 max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]" defaultValue={item? item.type?.toUpperCase():'NEDEFINIT'}
          onChange={(e)=>handleChange('type', e.target.value)}>
          <option value="NEDEFINIT">Nedefinit</option>
          <option value="MARFURI">Marfuri</option>
          <option value="PRODUSE_FINITE">Produse finite</option>
          <option value="AMBALAJE">Ambalaje</option>
          <option value="SEMIFABRICATE">Semifabricate</option>
          <option value="DISCOUNT_FINANCIAL_IESIRI">Discount financiar iesiri</option>
          <option value="DISCOUNT_COMERCIAL_IESIRI">Discount comercial iesiri</option>
          <option value="SERVICII_VANDUTE">Servicii vandute</option>
          <option value="AMBALAJE_SGR">Ambalaje SGR</option>
          <option value="TAXA_VERDE">Taxa verde</option>
          <option value="PRODUSE_REZIDUALE">Produse reziduale</option>
        </select>
      )}
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Cont Contabil':'Account Code'}</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? (item.account_code? item.account_code : '0'):'-'}
          className="bg-[var(--foreground)] max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e) => handleChange('account_code', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Gestiune':'Management'}</div>
      <div className="p-4 flex justify-center items-center">
        <select 
          className="bg-[var(--foreground)] min-w-35 max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          value={item?.management || '-'}
          onChange={(e)=>{handleChange('management', e.target.value === '-' ? null : e.target.value)}}
        >
          <option key={"None"} value="-">-</option>
          {managementList?.map((management:Management, index:number)=>(
            <option key={index} value={management.name}>{management.name} ({management.type})</option>
          ))}
        </select>
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Cod':'Code'}</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={item ? item.articleCode : '-'}
          className="bg-[var(--foreground)] max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e) => handleChange('articleCode', Number(e.target.value))}
        />
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'Cota tva':'Var rate'}</div>
      <div className="p-4 flex justify-center items-center">
        <select className="bg-[var(--foreground)] min-w-35 max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>handleChange('vat', e.target.value)} defaultValue={item? item.vat:'ZERO'}>
          <option value="ZERO">0</option>
          <option value="FIVE">5</option>
          <option value="NINE">9</option>
          <option value="NINETEEN">19</option>
        </select>
      </div>

      <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{language==='ro'?'UM':'UM'}</div>
      <div className="p-4 flex justify-center items-center">
        <select className="bg-[var(--foreground)] min-w-35 max-w-35 text-center py-2 rounded-2xl pl-1
          text-[var(--text1)] focus:outline-0 focus:ring-1 focus:ring-[var(--primary)]"
          onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>handleChange('um', e.target.value)} defaultValue={item? item.um:'BUCATA'}>
          <option value="BUCATA">BUCATA</option>
          <option value="KILOGRAM">KILOGRAM</option>
          <option value="LITRU">LITRU</option>
          <option value="METRU">METRU</option>
          <option value="GRAM">GRAM</option>
          <option value="CUTIE">CUTIE</option>
          <option value="PACHET">PACHET</option>
          <option value="PUNGA">PUNGA</option>
          <option value="SET">SET</option>
          <option value="METRU_PATRAT">METRU_PATRAT</option>
          <option value="METRU_CUB">METRU_CUB</option>
          <option value="MILIMETRU">MILIMETRU</option>
          <option value="CENTIMETRU">CENTIMETRU</option>
          <option value="TONA">TONA</option>
          <option value="PERECHE">PERECHE</option>
          <option value="SAC">SAC</option>
          <option value="MILILITRU">MILILITRU</option>
          <option value="KILOWATT_ORA">KILOWATT_ORA</option>
          <option value="MINUT">MINUT</option>
          <option value="ORA">ORA</option>
          <option value="ZI_DE_LUCRU">ZI_DE_LUCRU</option>
          <option value="LUNI_DE_LUCRU">LUNI_DE_LUCRU</option>
          <option value="DOZA">DOZA</option>
          <option value="UNITATE_DE_SERVICE">UNITATE_DE_SERVICE</option>
          <option value="O_MIE_DE_BUCATI">O_MIE_DE_BUCATI</option>
          <option value="TRIMESTRU">TRIMESTRU</option>
          <option value="PROCENT">PROCENT</option>
          <option value="KILOMETRU">KILOMETRU</option>
          <option value="LADA">LADA</option>
          <option value="DRY_TONE">DRY_TONE</option>
          <option value="CENTIMETRU_PATRAT">CENTIMETRU_PATRAT</option>
          <option value="MEGAWATI_ORA">MEGAWATI_ORA</option>
          <option value="ROLA">ROLA</option>
          <option value="TAMBUR">TAMBUR</option>
          <option value="SAC_PLASTIC">SAC_PLASTIC</option>
          <option value="PALET_LEMN">PALET_LEMN</option>
          <option value="UNITATE">UNITATE</option>
          <option value="TONA_NETA">TONA_NETA</option>
          <option value="HECTOMETRU_PATRAT">HECTOMETRU_PATRAT</option>
          <option value="FOAIE">FOAIE</option>
        </select>
      </div>
    </div>
  );
});

export default LineItems;
