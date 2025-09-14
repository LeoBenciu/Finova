"use client";
import { useSelector } from "react-redux";
import { useState } from "react";
import InitialClientCompanyModalSelect from "../Components/InitialClientCompanyModalSelect";
import { Download, Calendar, FileText, Database, Filter, CheckCircle } from "lucide-react";

type RootState = {
  clientCompany: { current: { name: string; ein: string } };
  user: { language: string };
};

type ExportFormat = 'excel' | 'csv' | 'pdf' | 'json';
type TimeFrame = 'custom' | 'last7days' | 'last30days' | 'last3months' | 'last6months' | 'lastyear' | 'thisyear';

function ExportsPage() {
  const clientCompanyName = useSelector((state: RootState) => state.clientCompany.current.name);
  const language = useSelector((state: RootState) => state.user.language);

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
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

  const exportFormats = [
    { value: 'excel', label: 'Excel (.xlsx)', icon: FileText },
    { value: 'csv', label: 'CSV (.csv)', icon: Database },
    { value: 'pdf', label: 'PDF (.pdf)', icon: FileText },
    { value: 'json', label: 'JSON (.json)', icon: Database }
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

    // Here you would call the actual export API
    // For now, we'll just simulate the process
    setTimeout(() => {
      clearInterval(progressInterval);
      setIsExporting(false);
      setExportProgress(0);
      alert(language === 'ro' ? 'Exportul a fost inițiat cu succes!' : 'Export initiated successfully!');
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
        <h1 className="text-4xl font-bold text-left text-[var(--text1)]">
          {language === 'ro' ? 'Exporturi' : 'Exports'}
        </h1>
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
          {/* Export Format Selection */}
          <div className="bg-[var(--foreground)] rounded-2xl p-6 border border-[var(--text4)]">
            <h3 className="text-xl font-semibold text-[var(--text1)] mb-4 flex items-center gap-2">
              <FileText size={20} />
              {language === 'ro' ? 'Format de export' : 'Export Format'}
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {exportFormats.map((format) => {
                const IconComponent = format.icon;
                return (
                  <button
                    key={format.value}
                    onClick={() => setSelectedFormat(format.value as ExportFormat)}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                      selectedFormat === format.value
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                        : 'border-[var(--text4)] bg-[var(--background)] text-[var(--text2)] hover:border-[var(--text3)]'
                    }`}
                  >
                    <IconComponent size={20} />
                    <span className="text-sm font-medium">{format.label}</span>
                  </button>
                );
              })}
            </div>
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
                <span className="text-[var(--text2)]">{language === 'ro' ? 'Format' : 'Format'}:</span>
                <span className="text-[var(--text1)] font-medium">
                  {exportFormats.find(f => f.value === selectedFormat)?.label}
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
