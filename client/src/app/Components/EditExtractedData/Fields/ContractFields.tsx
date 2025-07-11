import React from 'react';
import EditableField from '../EditableField';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Trash2, Users } from 'lucide-react';

interface ContractFieldsProps {
  editFile: any;
  setEditFile: (value: any) => void;
}

interface Party {
  name: string;
  ein: string;
  role: string;
}

interface Deliverable {
  description: string;
  due_date: string;
  amount: number;
  status: string;
}

const ContractFields: React.FC<ContractFieldsProps> = ({ editFile, setEditFile }) => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);
  const [showParties, setShowParties] = React.useState(false);
  const [showDeliverables, setShowDeliverables] = React.useState(false);

  const handleAddParty = () => {
    const newParty: Party = {
      name: '',
      ein: '',
      role: 'client'
    };

    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        parties: [...(editFile?.result.parties || []), newParty]
      }
    });
  };

  const handleDeleteParty = (index: number) => {
    const updatedParties = editFile?.result.parties.filter((_: any, i: number) => i !== index);
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        parties: updatedParties
      }
    });
  };

  const updateParty = (index: number, field: string, value: any) => {
    const updatedParties = [...editFile?.result.parties];
    updatedParties[index] = {
      ...updatedParties[index],
      [field]: value
    };
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        parties: updatedParties
      }
    });
  };

  const handleAddDeliverable = () => {
    const newDeliverable: Deliverable = {
      description: '',
      due_date: '',
      amount: 0,
      status: 'pending'
    };

    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        deliverables: [...(editFile?.result.deliverables || []), newDeliverable]
      }
    });
  };

  const handleDeleteDeliverable = (index: number) => {
    const updatedDeliverables = editFile?.result.deliverables.filter((_: any, i: number) => i !== index);
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        deliverables: updatedDeliverables
      }
    });
  };

  const updateDeliverable = (index: number, field: string, value: any) => {
    const updatedDeliverables = [...editFile?.result.deliverables];
    updatedDeliverables[index] = {
      ...updatedDeliverables[index],
      [field]: value
    };
    setEditFile({
      ...editFile,
      result: {
        ...editFile?.result,
        deliverables: updatedDeliverables
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Contract Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EditableField
          label={language === 'ro' ? 'Numarul contractului' : 'Contract number'}
          fieldName="contract_number"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Tipul contractului' : 'Contract type'}
          fieldName="contract_type"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Data contractului' : 'Contract date'}
          fieldName="contract_date"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Data inceperii' : 'Start date'}
          fieldName="start_date"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Data finalizarii' : 'End date'}
          fieldName="end_date"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Valoare totala' : 'Total value'}
          fieldName="total_value"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Moneda' : 'Currency'}
          fieldName="currency"
          editFile={editFile}
          setEditFile={setEditFile}
        />

        <EditableField
          label={language === 'ro' ? 'Termeni de plata' : 'Payment terms'}
          fieldName="payment_terms"
          editFile={editFile}
          setEditFile={setEditFile}
        />
      </div>

      {/* Parties Section */}
      <div className="mt-8">
        <button
          className="bg-[var(--primary)] text-white rounded-2xl flex items-center gap-3 px-6 py-3 
          hover:bg-[var(--primary)]/80 transition-all duration-200 font-medium shadow-sm w-full justify-between"
          onClick={() => setShowParties(!showParties)}
        >
          <span className="flex items-center gap-2">
            <Users size={18} />
            {language === 'ro' ? 'Parti contractuale' : 'Contract parties'}
            <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
              {editFile?.result.parties?.length || 0}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 ${showParties ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {showParties && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 space-y-4"
            >
              <button
                onClick={handleAddParty}
                className="bg-[var(--primary)]/10 hover:bg-[var(--primary)] 
                hover:text-white text-[var(--primary)] px-4 py-2.5 rounded-2xl
                flex items-center gap-2 transition-all duration-200 font-medium"
              >
                <Plus size={18} />
                {language === 'ro' ? 'Adauga parte' : 'Add party'}
              </button>

              {editFile?.result.parties?.map((party: Party, index: number) => (
                <div
                  key={index}
                  className="bg-[var(--foreground)] border border-[var(--text4)] rounded-2xl p-4 space-y-4"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-[var(--text1)]">
                      {language === 'ro' ? `Partea ${index + 1}` : `Party ${index + 1}`}
                    </h4>
                    <button
                      onClick={() => handleDeleteParty(index)}
                      className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Nume' : 'Name'}
                      </label>
                      <input
                        type="text"
                        value={party.name || ''}
                        onChange={(e) => updateParty(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'CUI' : 'EIN'}
                      </label>
                      <input
                        type="text"
                        value={party.ein || ''}
                        onChange={(e) => updateParty(index, 'ein', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Rol' : 'Role'}
                      </label>
                      <select
                        value={party.role || 'client'}
                        onChange={(e) => updateParty(index, 'role', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      >
                        <option value="client">{language === 'ro' ? 'Client' : 'Client'}</option>
                        <option value="vendor">{language === 'ro' ? 'Furnizor' : 'Vendor'}</option>
                        <option value="contractor">{language === 'ro' ? 'Contractor' : 'Contractor'}</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Deliverables Section */}
      <div className="mt-8">
        <button
          className="bg-[var(--primary)] text-white rounded-2xl flex items-center gap-3 px-6 py-3 
          hover:bg-[var(--primary)]/80 transition-all duration-200 font-medium shadow-sm w-full justify-between"
          onClick={() => setShowDeliverables(!showDeliverables)}
        >
          <span className="flex items-center gap-2">
            {language === 'ro' ? 'Livrabile' : 'Deliverables'}
            <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
              {editFile?.result.deliverables?.length || 0}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 ${showDeliverables ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {showDeliverables && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 space-y-4"
            >
              <button
                onClick={handleAddDeliverable}
                className="bg-[var(--primary)]/10 hover:bg-[var(--primary)] 
                hover:text-white text-[var(--primary)] px-4 py-2.5 rounded-2xl
                flex items-center gap-2 transition-all duration-200 font-medium"
              >
                <Plus size={18} />
                {language === 'ro' ? 'Adauga livrabil' : 'Add deliverable'}
              </button>

              {editFile?.result.deliverables?.map((deliverable: Deliverable, index: number) => (
                <div
                  key={index}
                  className="bg-[var(--foreground)] border border-[var(--text4)] rounded-2xl p-4 space-y-4"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-[var(--text1)]">
                      {language === 'ro' ? `Livrabil ${index + 1}` : `Deliverable ${index + 1}`}
                    </h4>
                    <button
                      onClick={() => handleDeleteDeliverable(index)}
                      className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Descriere' : 'Description'}
                      </label>
                      <input
                        type="text"
                        value={deliverable.description || ''}
                        onChange={(e) => updateDeliverable(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Data scadenta' : 'Due date'}
                      </label>
                      <input
                        type="text"
                        value={deliverable.due_date || ''}
                        onChange={(e) => updateDeliverable(index, 'due_date', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Suma' : 'Amount'}
                      </label>
                      <input
                        type="number"
                        value={deliverable.amount || ''}
                        onChange={(e) => updateDeliverable(index, 'amount', e.target.value ? parseFloat(e.target.value) : 0)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-[var(--text2)] mb-1 block">
                        {language === 'ro' ? 'Status' : 'Status'}
                      </label>
                      <select
                        value={deliverable.status || 'pending'}
                        onChange={(e) => updateDeliverable(index, 'status', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--text4)] 
                        rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                      >
                        <option value="pending">{language === 'ro' ? 'In asteptare' : 'Pending'}</option>
                        <option value="completed">{language === 'ro' ? 'Finalizat' : 'Completed'}</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ContractFields;