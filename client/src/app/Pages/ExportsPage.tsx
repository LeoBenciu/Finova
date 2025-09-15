"use client";
import { useSelector } from "react-redux";
import { useState } from "react";
import InitialClientCompanyModalSelect from "../Components/InitialClientCompanyModalSelect";
import { Download, Calendar, Database, Filter, CheckCircle, Settings, Monitor } from "lucide-react";

type RootState = {
  clientCompany: { current: { name: string; ein: string } };
  user: { language: string };
};

type AccountingSoftware = 'saga' | 'winmentor' | 'ciel' | 'smartbill-conta' | 'generic';
type TimeFrame = 'custom' | 'last7days' | 'last30days' | 'last3months' | 'last6months' | 'lastyear' | 'thisyear';

function ExportsPage() {
  const clientCompanyName = useSelector((state: RootState) => state.clientCompany.current.name);
  const language = useSelector((state: RootState) => state.user.language);

  const [selectedSoftware, setSelectedSoftware] = useState<AccountingSoftware>('winmentor');
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('last30days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>(['transactions', 'reports', 'documents']);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);


  const timeFrameOptions = [
    { value: 'last7days', label: language === 'ro' ? 'Ultimele 7 zile' : 'Last 7 days' },
    { value: 'last30days', label: language === 'ro' ? 'Ultimele 30 zile' : 'Last 30 days' },
    { value: 'last3months', label: language === 'ro' ? 'Ultimele 3 luni' : 'Last 3 months' },
    { value: 'last6months', label: language === 'ro' ? 'Ultimele 6 luni' : 'Last 6 months' },
    { value: 'lastyear', label: language === 'ro' ? 'Anul trecut' : 'Last year' },
    { value: 'thisyear', label: language === 'ro' ? 'Anul curent' : 'This year' },
    { value: 'custom', label: language === 'ro' ? 'Perioadă personalizată' : 'Custom period' }
  ];

  const accountingSoftware = [
    {
      value: 'saga',
      label: 'SAGA',
      description: language === 'ro' ? 'Software contabil SAGA - format CSV cu delimitare prin virgulă' : 'SAGA accounting software - CSV format with comma delimiter',
      icon: Monitor,
      format: 'CSV',
      encoding: 'UTF-8',
      delimiter: ',',
      dateFormat: 'DD/MM/YYYY',
      decimalSeparator: ',',
      fields: ['Data', 'Cont', 'Descriere', 'Debit', 'Credit', 'Document', 'Explicatii']
    },
    {
      value: 'winmentor',
      label: 'WinMentor',
      description: language === 'ro' ? 'Software contabil WinMentor - format CSV optimizat' : 'WinMentor accounting software - optimized CSV format',
      icon: Monitor,
      format: 'CSV',
      encoding: 'UTF-8',
      delimiter: ';',
      dateFormat: 'DD/MM/YYYY',
      decimalSeparator: ',',
      fields: ['Data', 'Cont_Debitor', 'Cont_Creditor', 'Suma', 'Explicatii', 'Document', 'Tip_Tranzactie']
    },
    {
      value: 'ciel',
      label: 'CIEL',
      description: language === 'ro' ? 'Software contabil CIEL - format XML și CSV' : 'CIEL accounting software - XML and CSV format',
      icon: Monitor,
      format: 'XML/CSV',
      encoding: 'UTF-8',
      delimiter: ';',
      dateFormat: 'YYYY-MM-DD',
      decimalSeparator: '.',
      fields: ['Date', 'Account_Code', 'Description', 'Debit_Amount', 'Credit_Amount', 'Reference']
    },
    {
      value: 'smartbill-conta',
      label: 'SmartBill Conta',
      description: language === 'ro' ? 'SmartBill Conta - format JSON și CSV' : 'SmartBill Conta - JSON and CSV format',
      icon: Monitor,
      format: 'JSON/CSV',
      encoding: 'UTF-8',
      delimiter: ',',
      dateFormat: 'DD/MM/YYYY',
      decimalSeparator: ',',
      fields: ['data', 'cont_debit', 'cont_credit', 'suma', 'explicatii', 'document', 'categorie']
    },
    {
      value: 'generic',
      label: language === 'ro' ? 'Format Generic' : 'Generic Format',
      description: language === 'ro' ? 'Format universal pentru import în alte software-uri' : 'Universal format for importing into other software',
      icon: Database,
      format: 'CSV/Excel',
      encoding: 'UTF-8',
      delimiter: ',',
      dateFormat: 'DD/MM/YYYY',
      decimalSeparator: ',',
      fields: ['Date', 'Account', 'Description', 'Debit', 'Credit', 'Reference', 'Category']
    }
  ];

  const dataTypes = [
    { value: 'transactions', label: language === 'ro' ? 'Tranzacții bancare' : 'Bank Transactions' },
    { value: 'reports', label: language === 'ro' ? 'Rapoarte financiare' : 'Financial Reports' },
    { value: 'documents', label: language === 'ro' ? 'Documente procesate' : 'Processed Documents' },
    { value: 'clients', label: language === 'ro' ? 'Date clienți' : 'Client Data' },
    { value: 'accounting', label: language === 'ro' ? 'Date contabile' : 'Accounting Data' }
  ];

  const handleDataTypeToggle = (dataType: string) => {
    setSelectedDataTypes(prev => 
      prev.includes(dataType) 
        ? prev.filter(type => type !== dataType)
        : [...prev, dataType]
    );
  };

  const handleExport = async () => {
    if (selectedDataTypes.length === 0) {
      alert(language === 'ro' ? 'Selectați cel puțin un tip de date pentru export' : 'Please select at least one data type for export');
      return;
    }

    if (selectedTimeFrame === 'custom' && (!customStartDate || !customEndDate)) {
      alert(language === 'ro' ? 'Selectați perioada personalizată' : 'Please select custom period');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    // Simulate export progress
    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsExporting(false);
          setExportProgress(0);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Here you would call the actual export API with software-specific format
    // For now, we'll just simulate the process
    setTimeout(() => {
      clearInterval(progressInterval);
      setIsExporting(false);
      setExportProgress(0);
      const selectedSoftwareInfo = accountingSoftware.find(s => s.value === selectedSoftware);
      alert(language === 'ro' 
        ? `Exportul pentru ${selectedSoftwareInfo?.label} a fost generat cu succes!` 
        : `Export for ${selectedSoftwareInfo?.label} generated successfully!`
      );
    }, 2000);
  };

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();

    switch (selectedTimeFrame) {
      case 'last7days':
        start.setDate(end.getDate() - 7);
        break;
      case 'last30days':
        start.setDate(end.getDate() - 30);
        break;
      case 'last3months':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'last6months':
        start.setMonth(end.getMonth() - 6);
        break;
      case 'lastyear':
        start.setFullYear(end.getFullYear() - 1);
        break;
      case 'thisyear':
        start.setMonth(0, 1);
        break;
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : null,
          end: customEndDate ? new Date(customEndDate) : null
        };
    }

    return { start, end };
  };

  const dateRange = getDateRange();

  return (
    <div className="min-h-full max-h-full min-w-full px-10 py-0">
      {clientCompanyName === '' && (
        <div style={{ zIndex: 9999, position: 'fixed', inset: 0 }}>
          <InitialClientCompanyModalSelect />
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-left text-[var(--text1)]">
            {language === 'ro' ? 'Exporturi Software Contabil' : 'Accounting Software Exports'}
          </h1>
          <p className="text-[var(--text2)] mt-2">
            {language === 'ro' 
              ? 'Exportați datele în format compatibil cu software-ul contabil ales' 
              : 'Export data in format compatible with your chosen accounting software'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-[var(--text2)]" />
            <span className="text-[var(--text2)]">
              {language === 'ro' ? 'Perioada selectată' : 'Selected period'}:
            </span>
            <span className="text-[var(--text1)] font-semibold">
              {selectedTimeFrame === 'custom' && customStartDate && customEndDate
                ? `${customStartDate} - ${customEndDate}`
                : selectedTimeFrame !== 'custom' && dateRange.start && dateRange.end
                ? `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                : language === 'ro' ? 'Selectați perioada' : 'Select period'
              }
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Export Configuration */}
        <div className="space-y-6">
          {/* Software Selection */}
          <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)]">
            <h3 className="text-xl font-semibold text-[var(--text1)] mb-4 flex items-center gap-2">
              <Monitor size={20} />
              {language === 'ro' ? 'Selectați Software-ul Contabil' : 'Select Accounting Software'}
            </h3>
            
            <div className="space-y-3">
              {accountingSoftware.map((software) => {
                const IconComponent = software.icon;
                return (
                  <button
                    key={software.value}
                    onClick={() => setSelectedSoftware(software.value as AccountingSoftware)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                      selectedSoftware === software.value
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                        : 'border-[var(--text4)] bg-[var(--background)] text-[var(--text2)] hover:border-[var(--text3)]'
                    }`}
                  >
                    <IconComponent size={24} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-lg">{software.label}</h4>
                        <span className="text-xs bg-[var(--text4)] text-[var(--text1)] px-2 py-1 rounded-full">
                          {software.format}
                        </span>
                      </div>
                      <p className="text-sm opacity-75 mb-2">{software.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-[var(--text4)] text-[var(--text1)] px-2 py-1 rounded">
                          {software.encoding}
                        </span>
                        <span className="bg-[var(--text4)] text-[var(--text1)] px-2 py-1 rounded">
                          {software.delimiter}
                        </span>
                        <span className="bg-[var(--text4)] text-[var(--text1)] px-2 py-1 rounded">
                          {software.dateFormat}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Frame Selection */}
          <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)]">
            <h3 className="text-xl font-semibold text-[var(--text1)] mb-4 flex items-center gap-2">
              <Calendar size={20} />
              {language === 'ro' ? 'Selectați perioada' : 'Select Time Period'}
            </h3>
            
            <div className="space-y-3">
              {timeFrameOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="timeFrame"
                    value={option.value}
                    checked={selectedTimeFrame === option.value}
                    onChange={(e) => setSelectedTimeFrame(e.target.value as TimeFrame)}
                    className="w-4 h-4 text-[var(--primary)] bg-[var(--background)] border-[var(--text4)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-[var(--text2)]">{option.label}</span>
                </label>
              ))}
            </div>

            {selectedTimeFrame === 'custom' && (
              <div className="mt-4 pt-4 border-t border-[var(--text4)]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text2)] mb-2">
                      {language === 'ro' ? 'Data de început' : 'Start Date'}
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--text4)] bg-[var(--background)] text-[var(--text1)] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text2)] mb-2">
                      {language === 'ro' ? 'Data de sfârșit' : 'End Date'}
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--text4)] bg-[var(--background)] text-[var(--text1)] px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Data Types Selection */}
          <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)]">
            <h3 className="text-xl font-semibold text-[var(--text1)] mb-4 flex items-center gap-2">
              <Filter size={20} />
              {language === 'ro' ? 'Tipuri de date' : 'Data Types'}
            </h3>
            
            <div className="space-y-3">
              {dataTypes.map((dataType) => (
                <label key={dataType.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDataTypes.includes(dataType.value)}
                    onChange={() => handleDataTypeToggle(dataType.value)}
                    className="w-4 h-4 text-[var(--primary)] bg-[var(--background)] border-[var(--text4)] rounded focus:ring-[var(--primary)]"
                  />
                  <span className="text-[var(--text2)]">{dataType.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Export Format and Actions */}
        <div className="space-y-6">
          {/* Software Format Details */}
          <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)]">
            <h3 className="text-xl font-semibold text-[var(--text1)] mb-4 flex items-center gap-2">
              <Settings size={20} />
              {language === 'ro' ? 'Detalii Format' : 'Format Details'}
            </h3>
            
            {(() => {
              const selectedSoftwareInfo = accountingSoftware.find(s => s.value === selectedSoftware);
              return selectedSoftwareInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Monitor size={20} className="text-[var(--primary)]" />
                    <div>
                      <h4 className="font-semibold text-[var(--text1)]">{selectedSoftwareInfo.label}</h4>
                      <p className="text-sm text-[var(--text2)]">{selectedSoftwareInfo.description}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--text2)]">
                        {language === 'ro' ? 'Format fișier' : 'File Format'}
                      </label>
                      <p className="text-[var(--text1)] font-semibold">{selectedSoftwareInfo.format}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--text2)]">
                        {language === 'ro' ? 'Codare' : 'Encoding'}
                      </label>
                      <p className="text-[var(--text1)] font-semibold">{selectedSoftwareInfo.encoding}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--text2)]">
                        {language === 'ro' ? 'Delimitator' : 'Delimiter'}
                      </label>
                      <p className="text-[var(--text1)] font-semibold">"{selectedSoftwareInfo.delimiter}"</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--text2)]">
                        {language === 'ro' ? 'Format dată' : 'Date Format'}
                      </label>
                      <p className="text-[var(--text1)] font-semibold">{selectedSoftwareInfo.dateFormat}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[var(--text2)] mb-2 block">
                      {language === 'ro' ? 'Câmpuri exportate' : 'Exported Fields'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedSoftwareInfo.fields.map((field, index) => (
                        <span key={index} className="bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-1 rounded text-xs">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          {/* Export Summary */}
          <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)]">
            <h3 className="text-xl font-semibold text-[var(--text1)] mb-4 flex items-center gap-2">
              <CheckCircle size={20} />
              {language === 'ro' ? 'Rezumat export' : 'Export Summary'}
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[var(--text2)]">{language === 'ro' ? 'Companie' : 'Company'}:</span>
                <span className="text-[var(--text1)] font-medium">{clientCompanyName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text2)]">{language === 'ro' ? 'Software' : 'Software'}:</span>
                <span className="text-[var(--text1)] font-medium">
                  {accountingSoftware.find(s => s.value === selectedSoftware)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text2)]">{language === 'ro' ? 'Format fișier' : 'File Format'}:</span>
                <span className="text-[var(--text1)] font-medium">
                  {accountingSoftware.find(s => s.value === selectedSoftware)?.format}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text2)]">{language === 'ro' ? 'Tipuri de date' : 'Data Types'}:</span>
                <span className="text-[var(--text1)] font-medium">{selectedDataTypes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text2)]">{language === 'ro' ? 'Perioada' : 'Period'}:</span>
                <span className="text-[var(--text1)] font-medium">
                  {selectedTimeFrame === 'custom' && customStartDate && customEndDate
                    ? `${customStartDate} - ${customEndDate}`
                    : timeFrameOptions.find(t => t.value === selectedTimeFrame)?.label
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting || selectedDataTypes.length === 0}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 disabled:bg-[var(--text4)] disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3"
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {language === 'ro' ? 'Se exportă...' : 'Exporting...'} ({exportProgress}%)
              </>
            ) : (
              <>
                <Download size={20} />
                {language === 'ro' ? 'Inițiază Exportul' : 'Start Export'}
              </>
            )}
          </button>

          {isExporting && (
            <div className="w-full bg-[var(--text4)] rounded-full h-2">
              <div 
                className="bg-[var(--primary)] h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExportsPage;
