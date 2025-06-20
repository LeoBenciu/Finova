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
  console.log('buyer ein:',editFile?.result?.buyer_ein);

  return (
    <div className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-sm mt-4 overflow-hidden">
      {/* Header Section */}
      <div className="bg-[var(--background)] border-b border-[var(--text4)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {item && item.isNew && (
              <span className="bg-[var(--primary)] text-white text-xs px-3 py-1 rounded-full font-medium">
                {language === 'ro' ? 'Nou' : 'New'}
              </span>
            )}
            <h4 className="font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Articol' : 'Line Item'} #{index + 1}
            </h4>
          </div>
          <button 
            onClick={handleRemoveLineItem}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
          
      {/* Form Fields */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Name Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Denumire' : 'Name'}
            </label>
            <input
              value={item ? item.name : '-'}
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={language === 'ro' ? 'Introdu denumirea...' : 'Enter name...'}
            />
          </div>
          
          {/* Quantity Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Cantitate' : 'Quantity'}
            </label>
            <input
              type="number"
              value={item ? item.quantity : ''}
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e) => handleChange('quantity', Number(e.target.value))}
              placeholder="0"
            />
          </div>
          
          {/* Unit Price Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Preț articol' : 'Unit price'}
            </label>
            <input
              type="number"
              step="0.01"
              value={item ? item.unit_price : ''}
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e) => handleChange('unit_price', Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
          
          {/* Total Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">Total</label>
            <input
              type="number"
              step="0.01"
              value={item ? item.total : ''}
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e) => handleChange('total', Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
          
          {/* VAT Amount Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'TVA' : 'VAT amount'}
            </label>
            <input
              type="number"
              step="0.01"
              value={item ? (item.vat_amount ? item.vat_amount : '0') : ''}
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e) => handleChange('vat_amount', Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
          
          {/* Account Code Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Cont Contabil' : 'Account Code'}
            </label>
            <input
              type="number"
              value={item ? (item.account_code ? item.account_code : '') : ''}
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e) => handleChange('account_code', Number(e.target.value))}
              placeholder="0"
            />
          </div>
          
          {/* Article Code Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Cod' : 'Code'}
            </label>
            <input
              value={item ? item.articleCode : ''}
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e) => handleChange('articleCode', e.target.value)}
              placeholder={language === 'ro' ? 'Introdu codul...' : 'Enter code...'}
            />
          </div>
          
          {/* Type Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Tip' : 'Type'}
            </label>
            {id === editFile?.result?.buyer_ein ? (
              <select 
                className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
                border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] transition-all duration-200"
                defaultValue={item ? item.type?.toUpperCase() : 'NEDEFINIT'}
                onChange={(e) => handleChange('type', e.target.value)}
              >
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
            ) : (
              <select 
                className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
                border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                text-[var(--text1)] transition-all duration-200"
                defaultValue={item ? item.type?.toUpperCase() : 'NEDEFINIT'}
                onChange={(e) => handleChange('type', e.target.value)}
              >
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
          
          {/* Management Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Gestiune' : 'Management'}
            </label>
            <select 
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              value={item?.management || '-'}
              onChange={(e) => handleChange('management', e.target.value === '-' ? null : e.target.value)}
            >
              <option key={"None"} value="-">-</option>
              {managementList?.map((management: Management, index: number) => (
                <option key={index} value={management.name}>
                  {management.name} ({management.type})
                </option>
              ))}
            </select>
          </div>
            
          {/* VAT Rate Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'Cota TVA' : 'VAT rate'}
            </label>
            <select 
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('vat', e.target.value)}
              defaultValue={item ? item.vat : 'ZERO'}
            >
              <option value="ZERO">0%</option>
              <option value="FIVE">5%</option>
              <option value="NINE">9%</option>
              <option value="NINETEEN">19%</option>
            </select>
          </div>
            
          {/* Unit of Measure Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text1)]">
              {language === 'ro' ? 'UM' : 'Unit of Measure'}
            </label>
            <select 
              className="bg-[var(--background)] min-h-11 rounded-2xl w-full px-4 py-2
              border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
              text-[var(--text1)] transition-all duration-200"
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('um', e.target.value)}
              defaultValue={item ? item.um : 'BUCATA'}
            >
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
      </div>
</div>
);
});

export default LineItems;
