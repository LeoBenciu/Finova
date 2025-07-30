import { useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check,  
  Link,
  AlertCircle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BtLogo from '@/assets/BTLogo.png';
import BCRLogo from '@/assets/BCRLogo.png';
import BRDLogo from '@/assets/BRDLogo.png';
import INGLogo from '@/assets/INGLogo.png';
import RaiffeisenLogo from '@/assets/RaiffeisenLogo.png';
import AlphaLogo from '@/assets/AlfaLogo.png';

interface BankConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (bankData: any) => void;
}

interface Bank {
  id: string;
  name: string;
  displayName: string;
  logo: string;
  apiDocs: string;
  fields: {
    label: string;
    name: string;
    type: string;
    placeholder: string;
    required: boolean;
    helpText?: string;
  }[];
  authMethod: string;
  environment: 'sandbox' | 'production';
}

const BankConnectionModal = ({ isOpen, onClose, onConnect }: BankConnectionModalProps) => {
  const language = useSelector((state: {user:{language:string}}) => state.user.language);
  const [currentStep, setCurrentStep] = useState<'select' | 'configure' | 'confirm'>('select');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');

  const banks: Bank[] = [
    {
      id: 'bt',
      name: 'Banca Transilvania',
      displayName: 'Banca Transilvania',
      logo: BtLogo,
      apiDocs: 'https://apistorebt.ro/bt/sb/',
      authMethod: 'OAuth2 + SCA',
      environment: 'sandbox',
      fields: [
        {
          label: language === 'ro' ? 'Client ID' : 'Client ID',
          name: 'clientId',
          type: 'text',
          placeholder: 'your-client-id',
          required: true,
          helpText: language === 'ro' ? 'Obținut de la API Store BT' : 'Obtained from BT API Store'
        },
        {
          label: language === 'ro' ? 'Client Secret' : 'Client Secret',
          name: 'clientSecret',
          type: 'password',
          placeholder: 'your-client-secret',
          required: true
        },
        {
          label: language === 'ro' ? 'Certificat eIDAS (QWAC)' : 'eIDAS Certificate (QWAC)',
          name: 'qwacCert',
          type: 'file',
          placeholder: '',
          required: environment === 'production',
          helpText: language === 'ro' ? 'Necesar pentru mediul de producție' : 'Required for production environment'
        },
        {
          label: language === 'ro' ? 'Cheia privată' : 'Private Key',
          name: 'privateKey',
          type: 'file',
          placeholder: '',
          required: environment === 'production'
        }
      ]
    },
    {
      id: 'bcr',
      name: 'BCR',
      displayName: 'Banca Comercială Română',
      logo: BCRLogo,
      apiDocs: 'https://developers.erstegroup.com/',
      authMethod: 'NextGenPSD2 OAuth2',
      environment: 'sandbox',
      fields: [
        {
          label: language === 'ro' ? 'Client ID' : 'Client ID',
          name: 'clientId',
          type: 'text',
          placeholder: 'your-client-id',
          required: true
        },
        {
          label: language === 'ro' ? 'Client Secret' : 'Client Secret',
          name: 'clientSecret',
          type: 'password',
          placeholder: 'your-client-secret',
          required: true
        },
        {
          label: language === 'ro' ? 'Certificate ID' : 'Certificate ID',
          name: 'certificateId',
          type: 'text',
          placeholder: 'cert-id-from-bcr',
          required: true,
          helpText: language === 'ro' ? 'ID-ul certificatului înregistrat la BCR' : 'Certificate ID registered with BCR'
        }
      ]
    },
    {
      id: 'brd',
      name: 'BRD',
      displayName: 'BRD - Groupe Société Générale',
      logo: BRDLogo,
      apiDocs: 'https://www.devbrd.ro/brd/apicatalog/',
      authMethod: 'OAuth2 Corporate',
      environment: 'sandbox',
      fields: [
        {
          label: language === 'ro' ? 'Application ID' : 'Application ID',
          name: 'applicationId',
          type: 'text',
          placeholder: 'your-app-id',
          required: true
        },
        {
          label: language === 'ro' ? 'Application Secret' : 'Application Secret',
          name: 'applicationSecret',
          type: 'password',
          placeholder: 'your-app-secret',
          required: true
        },
        {
          label: language === 'ro' ? 'Tip utilizator' : 'User Type',
          name: 'userType',
          type: 'select',
          placeholder: '',
          required: true,
          helpText: language === 'ro' ? 'BRD@ffice pentru companii' : 'BRD@ffice for companies'
        }
      ]
    },
    {
      id: 'ing',
      name: 'ING',
      displayName: 'ING Bank Romania',
      logo: INGLogo,
      apiDocs: 'https://developer.ing.com/',
      authMethod: 'OAuth2 + eIDAS',
      environment: 'sandbox',
      fields: [
        {
          label: language === 'ro' ? 'Client ID' : 'Client ID',
          name: 'clientId',
          type: 'text',
          placeholder: 'your-client-id',
          required: true
        },
        {
          label: language === 'ro' ? 'Client Secret' : 'Client Secret',
          name: 'clientSecret',
          type: 'password',
          placeholder: 'your-client-secret',
          required: true
        },
        {
          label: language === 'ro' ? 'Signing Certificate' : 'Signing Certificate',
          name: 'signingCert',
          type: 'file',
          placeholder: '',
          required: environment === 'production'
        }
      ]
    },
    {
      id: 'raiffeisen',
      name: 'Raiffeisen',
      displayName: 'Raiffeisen Bank Romania',
      logo: RaiffeisenLogo,
      apiDocs: 'https://developer.raiffeisen.at/',
      authMethod: 'XS2A-API + eIDAS',
      environment: 'sandbox',
      fields: [
        {
          label: language === 'ro' ? 'TPP ID' : 'TPP ID',
          name: 'tppId',
          type: 'text',
          placeholder: 'your-tpp-id',
          required: true,
          helpText: language === 'ro' ? 'Third Party Provider ID' : 'Third Party Provider ID'
        },
        {
          label: language === 'ro' ? 'QWAC Certificate' : 'QWAC Certificate',
          name: 'qwacCert',
          type: 'file',
          placeholder: '',
          required: true
        },
        {
          label: language === 'ro' ? 'QSealC Certificate' : 'QSealC Certificate',
          name: 'qsealCert',
          type: 'file',
          placeholder: '',
          required: true
        }
      ]
    },
    {
      id: 'alpha',
      name: 'Alpha Bank',
      displayName: 'Alpha Bank Romania',
      logo: AlphaLogo,
      apiDocs: 'https://developer.api.alphabank.eu/',
      authMethod: 'OAuth2 + QSealC',
      environment: 'sandbox',
      fields: [
        {
          label: language === 'ro' ? 'Client ID' : 'Client ID',
          name: 'clientId',
          type: 'text',
          placeholder: 'your-client-id',
          required: true
        },
        {
          label: language === 'ro' ? 'Client Secret' : 'Client Secret',
          name: 'clientSecret',
          type: 'password',
          placeholder: 'your-client-secret',
          required: true
        },
        {
          label: language === 'ro' ? 'QSealC Certificate' : 'QSealC Certificate',
          name: 'qsealCert',
          type: 'file',
          placeholder: '',
          required: environment === 'production'
        }
      ]
    }
  ];

  const handleBankSelect = (bank: Bank) => {
    setSelectedBank(bank);
    setFormData({});
    setCurrentStep('configure');
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (currentStep === 'configure') {
      setCurrentStep('confirm');
    }
  };

  const handleBack = () => {
    if (currentStep === 'configure') {
      setCurrentStep('select');
      setSelectedBank(null);
    } else if (currentStep === 'confirm') {
      setCurrentStep('configure');
    }
  };

  const handleConnect = () => {
    if (selectedBank) {
      const connectionData = {
        bank: selectedBank,
        credentials: formData,
        environment: environment
      };
      onConnect(connectionData);
      onClose();
      // Reset modal state
      setCurrentStep('select');
      setSelectedBank(null);
      setFormData({});
    }
  };

  const isFormValid = () => {
    if (!selectedBank) return false;
    const requiredFields = selectedBank.fields.filter(field => field.required);
    return requiredFields.every(field => formData[field.name]?.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-[var(--foreground)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--text4)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Link size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text1)] mb-2 text-left">
                {language === 'ro' ? 'Conectează Banca' : 'Connect Bank'}
              </h2>
              <p className="text-[var(--text2)] text-lg text-left">
                {currentStep === 'select' && (language === 'ro' ? 'Alege banca ta' : 'Choose your bank')}
                {currentStep === 'configure' && (language === 'ro' ? 'Configurează conexiunea' : 'Configure connection')}
                {currentStep === 'confirm' && (language === 'ro' ? 'Confirmă setările' : 'Confirm settings')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--background)] rounded-xl transition-colors duration-200"
          >
            <X size={20} className="text-[var(--text2)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <AnimatePresence mode="wait">
            {currentStep === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Environment Toggle */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={16} className="text-blue-600" />
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      {language === 'ro' ? 'Mediu de dezvoltare' : 'Development Environment'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="environment"
                        value="sandbox"
                        checked={environment === 'sandbox'}
                        onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}
                        className="text-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--text2)]">
                        {language === 'ro' ? 'Sandbox (Testare)' : 'Sandbox (Testing)'}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="environment"
                        value="production"
                        checked={environment === 'production'}
                        onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}
                        className="text-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--text2)]">
                        {language === 'ro' ? 'Producție' : 'Production'}
                      </span>
                    </label>
                  </div>
                  {environment === 'production' && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                      <AlertCircle size={12} />
                      <span>
                        {language === 'ro' 
                          ? 'Necesită autorizare BNR și certificate eIDAS' 
                          : 'Requires BNR authorization and eIDAS certificates'
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Banks Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {banks.map((bank) => (
                    <motion.div
                      key={bank.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleBankSelect(bank)}
                      className="aspect-square p-6 border border-[var(--text4)] rounded-xl hover:border-[var(--primary)] 
                      cursor-pointer transition-all duration-300 hover:shadow-lg bg-[var(--background)]
                      flex flex-col items-center justify-center text-center"
                    >
                      <div className="w-44 h-44 mb-4 flex items-center justify-center">
                        <img 
                          src={bank.logo} 
                          alt={bank.displayName}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <h3 className="font-semibold text-[var(--text1)] text-sm leading-tight">
                        {bank.displayName}
                      </h3>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {currentStep === 'configure' && selectedBank && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 flex items-center justify-center">
                      <img 
                        src={selectedBank.logo} 
                        alt={selectedBank.displayName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text1)]">{selectedBank.displayName}</h3>
                      <p className="text-sm text-[var(--text3)]">{selectedBank.authMethod}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedBank.fields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-[var(--text2)] mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      
                      {field.type === 'select' ? (
                        <select
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
                          focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text1)]"
                          required={field.required}
                        >
                          <option value="">
                            {language === 'ro' ? 'Selectează...' : 'Select...'}
                          </option>
                          {field.name === 'userType' && (
                            <>
                              <option value="brd_office">BRD@ffice (Corporate)</option>
                              <option value="mybrd">MyBRD (Retail)</option>
                            </>
                          )}
                        </select>
                      ) : field.type === 'file' ? (
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleInputChange(field.name, file.name);
                            }
                          }}
                          className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
                          focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text1)]"
                          accept=".pem,.crt,.p12,.pfx"
                          required={field.required}
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
                          focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text1)]"
                          required={field.required}
                        />
                      )}
                      
                      {field.helpText && (
                        <p className="text-xs text-[var(--text3)] mt-1">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {currentStep === 'confirm' && selectedBank && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={24} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text1)] mb-2">
                    {language === 'ro' ? 'Confirmare Conexiune' : 'Confirm Connection'}
                  </h3>
                  <p className="text-[var(--text3)]">
                    {language === 'ro' 
                      ? 'Verifică setările înainte de conectare' 
                      : 'Review settings before connecting'
                    }
                  </p>
                </div>

                <div className="bg-[var(--background)] rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">{language === 'ro' ? 'Bancă:' : 'Bank:'}</span>
                    <span className="text-[var(--text1)] font-medium">{selectedBank.displayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">{language === 'ro' ? 'Mediu:' : 'Environment:'}</span>
                    <span className="text-[var(--text1)] font-medium capitalize">{environment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text3)]">{language === 'ro' ? 'Autentificare:' : 'Authentication:'}</span>
                    <span className="text-[var(--text1)] font-medium">{selectedBank.authMethod}</span>
                  </div>
                </div>

                {environment === 'production' && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <AlertCircle size={16} />
                      <span className="text-sm font-medium">
                        {language === 'ro' ? 'Atenție - Producție' : 'Warning - Production'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {language === 'ro'
                        ? 'Asigură-te că ai autorizarea BNR și certificatele eIDAS valide.'
                        : 'Ensure you have BNR authorization and valid eIDAS certificates.'
                      }
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[var(--text4)]">
          <div className="flex items-center gap-2">
            {currentStep !== 'select' && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-[var(--text2)] hover:text-[var(--text1)] 
                hover:bg-[var(--background)] rounded-xl transition-all duration-200"
              >
                <ChevronLeft size={16} />
                {language === 'ro' ? 'Înapoi' : 'Back'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep === 'configure' && (
              <button
                onClick={handleNext}
                disabled={!isFormValid()}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[var(--primary)] to-blue-500 
                text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold
                disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {language === 'ro' ? 'Continuă' : 'Continue'}
                <ChevronRight size={16} />
              </button>
            )}

            {currentStep === 'confirm' && (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 
                text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
              >
                <Link size={16} />
                {language === 'ro' ? 'Conectează' : 'Connect'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BankConnectionModal;