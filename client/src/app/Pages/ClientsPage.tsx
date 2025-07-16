import { Search, Trash2, Plus, Building, Upload, FileText, Database } from "lucide-react";
import { motion } from 'framer-motion';
import { useEffect, useState } from "react";
import { useCreateClientCompanyMutation, useDeleteClientCompanyMutation, useGetClientCompaniesMutation } from "@/redux/slices/apiSlice";
import LoadingComponent from "../Components/LoadingComponent";
import { useSelector } from "react-redux";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import CompanyArticlesModal from "../Components/CompanyArticlesModal";

type Company = {
    name: string,
    ein: string
};

type clientCompany = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

const ClientsPage = () => {
    const [einNewCompany, setEinNewCompany] = useState<string>('');
    const [currentClientCompanyEin, setCurrentClientCompanyEin] = useState<string>('');
    const [companies, setCompanies] = useState<Company[]>();
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>();
    const [isCompanyAccountingDetailsModal, setIsCompanyAccountingDetailsModal] = useState<boolean>(false);
    const [IsCreatingNewCompanyComplete, setIsCreatingNewCompanyComplete] = useState<boolean>(false);
    const [articles, setArticles] = useState<File>();
    const [management, setManagement] = useState<File>();
    const [isArticleSelected, setIsArticleSelected] = useState<boolean>(true);
    const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [getCompanies, { isLoading: isClientCompaniesLoading }] = useGetClientCompaniesMutation();
    const [createNewCompany, { isLoading: IsCreatingNewCompany }] = useCreateClientCompanyMutation();
    const [deleteCompany] = useDeleteClientCompanyMutation();
    const language = useSelector((state: { user: { language: string } }) => state.user.language);

    useEffect(() => {
        if (articles && management && einNewCompany.length > 1) {
            setIsCreatingNewCompanyComplete(true);
        } else {
            setIsCreatingNewCompanyComplete(false);
        }
    }, [articles, setArticles, management, setManagement, einNewCompany, setEinNewCompany]);

    useEffect(() => {
        const handleFetchClientCompanies = async () => {
            const response: Company[] = await getCompanies({}).unwrap();
            setCompanies(response);
            setFilteredCompanies(response);
            console.log('Client Response', response);
        };

        handleFetchClientCompanies();
    }, [getCompanies])

    const handleSaveNewCompany = async () => {
        try {
            console.log(articles, management);
            const result = await createNewCompany({
                ein: einNewCompany,
                articles,
                management
            }).unwrap();

            console.log("Result of creating a new company", result);

            if (companies) {
                setFilteredCompanies([...companies, result.company]);
                setCompanies([...companies, result.company]);
                console.log("filtered", filteredCompanies);
            } else {
                setFilteredCompanies([result]);
                setCompanies([result]);
            }

            setEinNewCompany("");
            setArticles(undefined);
            setManagement(undefined);
            setShowCreateForm(false);
            const articlesInput = document.getElementById("articole") as HTMLInputElement;
            const gestiuniInput = document.getElementById("gestiuni") as HTMLInputElement;
            if (articlesInput) articlesInput.value = "";
            if (gestiuniInput) gestiuniInput.value = "";
        } catch (error) {
            console.error(error);
        }
    };

    const deleteClientCompany = async (einToDelete: string) => {
        try {
            const deleted = await deleteCompany(einToDelete).unwrap();
            console.log(deleted);
            setCompanies(companies?.filter(company => company.ein !== deleted.ein));
            setFilteredCompanies(companies?.filter(company => company.ein !== deleted.ein));
        } catch (e) {
            console.error(e);
        }
    };

    const handleFilterCompanies = (str: string) => {
        setSearchTerm(str);
        const filtered = companies?.filter((company) => (
            company.name.toLowerCase().includes(str.toLowerCase()) || company.ein.includes(str)
        ));
        setFilteredCompanies(filtered);
    };

    return (
        <div className="min-h-screen p-8">
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Building size={35} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-[var(--text1)] mb-2 text-left">
                                {language === 'ro' ? 'Companii Clienti' : 'Client Companies'}
                            </h1>
                            <p className="text-[var(--text2)] text-lg text-left">
                                {language === 'ro' 
                                    ? 'Gestionează companiile tale client și documentele lor' 
                                    : 'Manage your client companies and their documents'
                                }
                            </p>
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-blue-500 
                        text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
                    >
                        <Plus size={20} />
                        {language === 'ro' ? 'Companie Nouă' : 'New Company'}
                    </motion.button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                    <div className="bg-[var(--foreground)] rounded-3xl shadow-2xl border border-[var(--text4)] overflow-hidden">
                        <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text3)] z-10" size={20} />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => handleFilterCompanies(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-[var(--background)] border border-[var(--text4)] rounded-2xl 
                                    focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                                    text-[var(--text1)] placeholder:text-[var(--text3)] transition-all duration-300 shadow-sm"
                                    placeholder={language === 'ro' ? "Caută după nume sau CUI..." : "Search by name or EIN..."}
                                />
                            </div>
                        </div>

                        <div className="p-6">
                            {isClientCompaniesLoading ? (
                                <div className="flex justify-center py-12">
                                    <LoadingComponent />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredCompanies?.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Building size={48} className="mx-auto text-[var(--text3)] mb-4" />
                                            <p className="text-[var(--text2)] text-lg">
                                                {searchTerm 
                                                    ? (language === 'ro' ? 'Nu s-au găsit companii' : 'No companies found')
                                                    : (language === 'ro' ? 'Nu există companii încă' : 'No companies yet')
                                                }
                                            </p>
                                        </div>
                                    ) : (
                                        filteredCompanies?.map((company: Company, index) => (
                                            <motion.div
                                                key={company.ein}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="group bg-gradient-to-r from-[var(--background)] to-[var(--background)]/80 
                                                rounded-2xl p-4 border border-[var(--text4)] hover:border-[var(--primary)]/50 
                                                hover:shadow-lg transition-all duration-300 cursor-pointer"
                                                onClick={() => {
                                                    setCurrentClientCompanyEin(company.ein);
                                                    setIsCompanyAccountingDetailsModal(true);
                                                }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)]/20 to-blue-500/20 
                                                        rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                            <Building size={18} className="text-[var(--primary)]" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-[var(--text1)] group-hover:text-[var(--primary)] transition-colors duration-300">
                                                                {company.name}
                                                            </h3>
                                                            <p className="text-[var(--text3)] text-sm">
                                                                {language === 'ro' ? 'CUI: ' : 'EIN: '}{company.ein}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            deleteClientCompany(company.ein);
                                                        }}
                                                        className="p-2 hover:text-white text-red-500 hover:bg-red-500 bg-red-50 
                                                        rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {showCreateForm && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="xl:col-span-1"
                    >
                        <div className="bg-[var(--foreground)] rounded-3xl shadow-2xl border border-[var(--text4)] overflow-hidden sticky top-8">
                            <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--primary)]/10 to-blue-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-xl flex items-center justify-center">
                                        <Plus size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[var(--text1)]">
                                            {language === 'ro' ? 'Companie Nouă' : 'New Company'}
                                        </h3>
                                        <p className="text-[var(--text3)] text-sm">
                                            {language === 'ro' ? 'Completează datele necesare' : 'Fill in the required details'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <Label className="text-[var(--text1)] font-semibold mb-2 block">
                                        {language === 'ro' ? 'CUI' : 'EIN'}
                                    </Label>
                                    <input
                                        type="text"
                                        value={einNewCompany}
                                        onChange={(e) => setEinNewCompany(e.target.value)}
                                        className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
                                        focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                                        text-[var(--text1)] transition-all duration-300"
                                        placeholder={language === 'ro' ? 'Introduceți CUI-ul...' : 'Enter EIN...'}
                                    />
                                </div>

                                <div>
                                    <Label className="text-[var(--text1)] font-semibold mb-2 flex items-center gap-2">
                                        <FileText size={16} />
                                        {language === 'ro' ? 'Articole (CSV)' : 'Articles (CSV)'}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="articole"
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setArticles(e.target.files?.[0])}
                                            className="w-full h-max px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
                                            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                                            text-[var(--text1)] transition-all duration-300 file:mr-4 file:py-2 file:px-4
                                            file:rounded-lg file:border-0 file:text-sm file:font-semibold
                                            file:bg-[var(--primary)] file:text-white hover:file:bg-[var(--primary)]/90"
                                        />
                                        <Upload size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--text3)]" />
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-[var(--text1)] font-semibold mb-2 flex items-center gap-2">
                                        <Database size={16} />
                                        {language === 'ro' ? 'Gestiuni (CSV)' : 'Management (CSV)'}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="gestiuni"
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setManagement(e.target.files?.[0])}
                                            className="w-full h-max px-4 py-3 bg-[var(--background)] border border-[var(--text4)] rounded-xl 
                                            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                                            text-[var(--text1)] transition-all duration-300 file:mr-4 file:py-2 file:px-4
                                            file:rounded-lg file:border-0 file:text-sm file:font-semibold
                                            file:bg-[var(--primary)] file:text-white hover:file:bg-[var(--primary)]/90"
                                        />
                                        <Upload size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--text3)]" />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowCreateForm(false)}
                                        className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--text4)] 
                                        text-[var(--text2)] rounded-xl hover:bg-[var(--text4)]/20 transition-all duration-300"
                                    >
                                        {language === 'ro' ? 'Anulează' : 'Cancel'}
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: IsCreatingNewCompanyComplete && !IsCreatingNewCompany ? 1.02 : 1 }}
                                        whileTap={{ scale: IsCreatingNewCompanyComplete && !IsCreatingNewCompany ? 0.98 : 1 }}
                                        disabled={!IsCreatingNewCompanyComplete || IsCreatingNewCompany}
                                        onClick={handleSaveNewCompany}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-[var(--primary)] to-blue-500 
                                        disabled:from-[var(--text4)] disabled:to-[var(--text4)] text-white rounded-xl 
                                        disabled:cursor-not-allowed transition-all duration-300 font-semibold
                                        hover:shadow-lg disabled:hover:shadow-none"
                                    >
                                        {IsCreatingNewCompany 
                                            ? (language === 'ro' ? 'Se creează...' : 'Creating...') 
                                            : (language === 'ro' ? 'Creează' : 'Create')
                                        }
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {isCompanyAccountingDetailsModal && (
                <CompanyArticlesModal
                    isArticleSelected={isArticleSelected}
                    setIsArticleSelected={setIsArticleSelected}
                    setIsCompanyAccountingDetailsModal={setIsCompanyAccountingDetailsModal}
                    currentClientCompanyEin={currentClientCompanyEin}
                />
            )}
        </div>
    );
};

export default ClientsPage;