import { Search, Building, Sparkles, ArrowRight, Plus } from "lucide-react"
import LoadingComponent from "./LoadingComponent"
import { useEffect, useState } from "react";
import { useGetClientCompaniesMutation } from "@/redux/slices/apiSlice";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentCompany } from '@/redux/slices/clientCompanySlice';
import Logo from '@/assets/2solLqZ3AFncSar4MubKNQ4TreZ.svg'
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";

type Company = {
    name: string,
    ein: string
};

const InitialClientCompanyModalSelect = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const language = useSelector((state: { user: { language: string } }) => state.user.language);

    const [companies, setCompanies] = useState<Company[]>();
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>();
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [getCompanies, { isLoading: isClientCompaniesLoading }] = useGetClientCompaniesMutation();

    useEffect(() => {
        const handleFetchClientCompanies = async () => {
            const response: Company[] = await getCompanies({}).unwrap();
            setCompanies(response);
            setFilteredCompanies(response);
            console.log('Client Response', response);
        };

        handleFetchClientCompanies();
    }, [getCompanies])

    const handleFilterCompanies = (str: string) => {
        setSearchTerm(str);
        const filtered = companies?.filter((company) => (
            company.name.toLowerCase().includes(str.toLowerCase()) || company.ein.includes(str)
        ));
        setFilteredCompanies(filtered);
    };

    const handleSelectCompany = (company: Company) => {
        dispatch(setCurrentCompany({ name: company.name, ein: company.ein }));
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[var(--background)] via-[var(--foreground)]/50 to-[var(--background)] 
        backdrop-blur-sm flex flex-col justify-center items-center p-4 z-50">
            
            <div className="absolute inset-0 opacity-5">
                <div className="absolute top-20 left-20 w-64 h-64 bg-[var(--primary)] rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-6"
                    >
                        <img src={Logo} alt="Finova logo" className='h-20 mx-auto drop-shadow-lg' />
                    </motion.div>
                    
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="font-bold text-3xl text-[var(--text1)] mb-2"
                    >
                        {language === 'ro' ? 'Bine ai venit!' : 'Welcome!'}
                    </motion.h2>
                    
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-[var(--text2)] text-lg"
                    >
                        {language === 'ro' ? 'Selectează o companie pentru a continua' : 'Select a company to continue'}
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-[var(--foreground)] rounded-3xl shadow-2xl border border-[var(--text4)] 
                    overflow-hidden w-full max-w-2xl backdrop-blur-xl"
                >
                    <div className="p-8 pb-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center">
                                <Building size={20} className="text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text1)]">
                                {language === 'ro' ? 'Companiile Tale' : 'Your Companies'}
                            </h3>
                        </div>

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
                            <div className="absolute inset-1 bg-gradient-to-r from-white/5 to-transparent rounded-2xl pointer-events-none"></div>
                        </div>
                    </div>

                    <div className="p-6">
                        {isClientCompaniesLoading ? (
                            <div className="flex justify-center py-12">
                                <LoadingComponent />
                            </div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--text4)] scrollbar-track-transparent">
                                <AnimatePresence>
                                    {filteredCompanies?.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center py-12"
                                        >
                                            <div className="w-16 h-16 bg-gradient-to-br from-[var(--text4)] to-[var(--text3)] 
                                            rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <Building size={24} className="text-white" />
                                            </div>
                                            <p className="text-[var(--text2)] mb-4 text-lg">
                                                {searchTerm 
                                                    ? (language === 'ro' ? 'Nu s-au găsit companii' : 'No companies found')
                                                    : (language === 'ro' ? 'Nu sunt companii asociate acestui cont' : 'No companies associated with this account')
                                                }
                                            </p>
                                            {!searchTerm && (
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => navigate('/clients')}
                                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-blue-500 
                                                    text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
                                                >
                                                    <Plus size={18} />
                                                    {language === 'ro' ? 'Creează o companie' : 'Create a company'}
                                                </motion.button>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredCompanies?.map((company: Company, index) => (
                                                <motion.div
                                                    key={company.ein}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleSelectCompany(company)}
                                                    className="group relative bg-gradient-to-r from-[var(--background)] to-[var(--background)]/80 
                                                    rounded-2xl p-4 border border-[var(--text4)] hover:border-[var(--primary)]/50 
                                                    hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/5 to-blue-500/5 
                                                    opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                    
                                                    <div className="relative flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)]/20 to-blue-500/20 
                                                            rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                                <Building size={20} className="text-[var(--primary)]" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-[var(--text1)] group-hover:text-[var(--primary)] 
                                                                transition-colors duration-300 text-lg">
                                                                    {company.name}
                                                                </h4>
                                                                <p className="text-[var(--text3)] text-sm flex items-center gap-1">
                                                                    <Sparkles size={12} />
                                                                    {language === 'ro' ? 'CUI: ' : 'EIN: '}{company.ein}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 text-[var(--text3)] group-hover:text-[var(--primary)] 
                                                        transition-colors duration-300">
                                                            <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                {language === 'ro' ? 'Selectează' : 'Select'}
                                                            </span>
                                                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    <div className="px-8 py-6 border-t border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
                        <div className="flex items-center justify-between text-sm text-[var(--text3)]">
                            <span className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse"></div>
                                {language === 'ro' ? 'Pregătit pentru lucru' : 'Ready to work'}
                            </span>
                            <button
                                onClick={() => navigate('/clients')}
                                className="text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors duration-200 font-medium"
                            >
                                {language === 'ro' ? 'Gestionează companii' : 'Manage companies'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default InitialClientCompanyModalSelect;