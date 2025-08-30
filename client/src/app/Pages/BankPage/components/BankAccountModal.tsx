import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard } from 'lucide-react';

interface BankAccountModalProps {
  open: boolean;
  language: 'ro' | 'en' | string;
  editingBankAccount: any | null;
  onClose: () => void;

  // API/Actions from container
  clientCompanyEin: string;
  accountAnalytics: any[];
  createBankAccount: (args: any) => { unwrap: () => Promise<any> };
  updateBankAccount: (args: any) => { unwrap: () => Promise<any> };
  createAccountAnalytic: (args: any) => { unwrap: () => Promise<any> };
  updateAccountAnalytic: (args: any) => { unwrap: () => Promise<any> };
  refetchAccountAnalytics: () => Promise<any> | any;

  // Toast from container
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const BankAccountModal: React.FC<BankAccountModalProps> = ({
  open,
  language,
  editingBankAccount,
  onClose,
  clientCompanyEin,
  accountAnalytics,
  createBankAccount,
  updateBankAccount,
  createAccountAnalytic,
  updateAccountAnalytic,
  refetchAccountAnalytics,
  addToast,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[var(--foreground)] rounded-2xl border border-[var(--text4)] shadow-2xl max-w-2xl w-full p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                <CreditCard size={24} className="text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text1)]">
                  {editingBankAccount
                    ? language === 'ro'
                      ? 'Editează Cont Bancar'
                      : 'Edit Bank Account'
                    : language === 'ro'
                      ? 'Adaugă Cont Bancar Nou'
                      : 'Add New Bank Account'}
                </h3>
                <p className="text-[var(--text2)]">
                  {language === 'ro'
                    ? 'Completează informațiile contului bancar'
                    : 'Fill in the bank account information'}
                </p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const accountData = {
                  iban: formData.get('iban') as string,
                  accountName: formData.get('accountName') as string,
                  bankName: formData.get('bankName') as string,
                  currency: ((formData.get('currency') as string) || 'RON') as string,
                  accountType: (formData.get('accountType') as 'CURRENT' | 'SAVINGS' | 'BUSINESS' | 'CREDIT'),
                };
                const analyticSuffix = ((formData.get('analyticSuffix') as string) || '').trim();

                try {
                  if (editingBankAccount) {
                    await updateBankAccount({
                      accountId: editingBankAccount.id,
                      updateData: accountData,
                    }).unwrap();
                    addToast(language === 'ro' ? 'Contul bancar a fost actualizat.' : 'Bank account updated.', 'success');
                  } else {
                    await createBankAccount({
                      clientEin: clientCompanyEin,
                      accountData,
                    }).unwrap();
                    addToast(language === 'ro' ? 'Cont bancar salvat.' : 'Bank account saved.', 'success');
                  }

                  if (analyticSuffix) {
                    const syntheticCode = accountData.currency === 'RON' ? '5121' : '5124';
                    try {
                      const existing = (accountAnalytics as any[]).find(
                        (m) => m.iban === accountData.iban && m.currency === accountData.currency,
                      );
                      if (existing) {
                        await updateAccountAnalytic({
                          id: existing.id,
                          data: { syntheticCode, analyticSuffix, currency: accountData.currency, bankName: accountData.bankName },
                        }).unwrap();
                      } else {
                        await createAccountAnalytic({
                          clientEin: clientCompanyEin,
                          data: { iban: accountData.iban, currency: accountData.currency, syntheticCode, analyticSuffix, bankName: accountData.bankName },
                        }).unwrap();
                      }
                      await refetchAccountAnalytics();
                    } catch (err) {
                      console.error('Failed to save analytic mapping', err);
                    }
                  }
                  onClose();
                } catch (error) {
                  console.error('Failed to save bank account:', error);
                  addToast(
                    language === 'ro' ? 'Eroare la salvarea contului bancar.' : 'Error saving bank account.',
                    'error',
                  );
                }
              }}
            >
              <div className="space-y-4">
                {/* IBAN */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text1)] mb-2">IBAN *</label>
                  <input
                    type="text"
                    name="iban"
                    required
                    defaultValue={editingBankAccount?.iban || ''}
                    placeholder="RO49 AAAA 1B31 0075 9384 0000"
                    className="w-full text-black px-4 py-3 border border-[var(--text4)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white"
                  />
                </div>

                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                    {language === 'ro' ? 'Nume Cont *' : 'Account Name *'}
                  </label>
                  <input
                    type="text"
                    name="accountName"
                    required
                    defaultValue={editingBankAccount?.accountName || ''}
                    placeholder={language === 'ro' ? 'Cont Principal Companie' : 'Company Main Account'}
                    className="w-full px-4 py-3 text-black border border-[var(--text4)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white"
                  />
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                    {language === 'ro' ? 'Nume Bancă *' : 'Bank Name *'}
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    required
                    defaultValue={editingBankAccount?.bankName || ''}
                    placeholder={language === 'ro' ? 'Banca Transilvania' : 'Bank Name'}
                    className="w-full px-4 py-3 text-black border border-[var(--text4)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white"
                  />
                </div>

                {/* Currency and Account Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                      {language === 'ro' ? 'Monedă' : 'Currency'}
                    </label>
                    <select
                      name="currency"
                      defaultValue={editingBankAccount?.currency || 'RON'}
                      className="w-full px-4 py-3 text-black border border-[var(--text4)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white"
                    >
                      <option value="RON">RON</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                      {language === 'ro' ? 'Tip Cont' : 'Account Type'}
                    </label>
                    <select
                      name="accountType"
                      defaultValue={editingBankAccount?.accountType || 'CURRENT'}
                      className="w-full px-4 py-3 text-black border border-[var(--text4)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white"
                    >
                      <option value="CURRENT">{language === 'ro' ? 'Cont Curent' : 'Current Account'}</option>
                      <option value="SAVINGS">{language === 'ro' ? 'Cont Economii' : 'Savings Account'}</option>
                      <option value="BUSINESS">{language === 'ro' ? 'Cont Business' : 'Business Account'}</option>
                      <option value="CREDIT">{language === 'ro' ? 'Card de Credit' : 'Credit Card'}</option>
                    </select>
                  </div>
                </div>

                {/* Analytic Suffix */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text1)] mb-2">
                    {language === 'ro' ? 'Sufix Analitic' : 'Analytic Suffix'}
                  </label>
                  <input
                    type="text"
                    name="analyticSuffix"
                    defaultValue={
                      editingBankAccount
                        ? (accountAnalytics as any[]).find(
                            (m) => m.iban === editingBankAccount.iban && m.currency === (editingBankAccount.currency || 'RON'),
                          )?.analyticSuffix || ''
                        : ''
                    }
                    placeholder="01"
                    className="w-full px-4 py-3 text-black border border-[var(--text4)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white"
                  />
                  <p className="text-xs text-[var(--text2)] mt-1">
                    {language === 'ro'
                      ? 'Codul sintetic se setează automat: 5121 pentru RON, 5124 pentru alte valute.'
                      : 'Synthetic code is auto-set: 5121 for RON, 5124 for other currencies.'}
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[var(--text4)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border bg-white border-[var(--text4)] text-[var(--text2)] rounded-xl hover:bg-[var(--text4)]/10 transition-colors"
                >
                  {language === 'ro' ? 'Anulează' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary)]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} />
                  {editingBankAccount
                    ? language === 'ro'
                      ? 'Actualizează Cont'
                      : 'Update Account'
                    : language === 'ro'
                      ? 'Creează Cont'
                      : 'Create Account'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BankAccountModal;
