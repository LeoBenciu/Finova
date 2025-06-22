import { useDeleteArticleMutation, useDeleteManagementMutation, useGetArticlesQuery, useGetManagementQuery, useSaveNewManagementMutation } from "@/redux/slices/apiSlice";
import { Check, Trash, X, Plus, Package, Settings, Save } from "lucide-react";
import { Management } from "./EditExtractedData/LineItems";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";

interface CompanyArticlesParams {
    isArticleSelected: boolean;
    setIsArticleSelected: React.Dispatch<React.SetStateAction<boolean>>;
    setIsCompanyAccountingDetailsModal: React.Dispatch<React.SetStateAction<boolean>>;
    currentClientCompanyEin: string;
}

interface Article {
    id: number,
    code: number,
    name: string,           
    vat: string,           
    unitOfMeasure: string,   
    type: string    
}

const CompanyArticlesModal = ({isArticleSelected, setIsArticleSelected, setIsCompanyAccountingDetailsModal, currentClientCompanyEin}: CompanyArticlesParams) => {
    const language = useSelector((state: {user:{language:string}}) => state.user.language);
    const ein = currentClientCompanyEin;

    // Articles
    const {data: articleList, refetch: refetchArticleList} = useGetArticlesQuery(ein);

    // Management
    const [deleteManagement] = useDeleteManagementMutation();
    const [deleteArticle] = useDeleteArticleMutation();
    const {data: managementList, refetch: refetchManagementList} = useGetManagementQuery(ein);
    const [isNewManagement, setIsNewManagement] = useState<boolean>(false);
    const [saveNewManagement] = useSaveNewManagementMutation();

    const getBiggestCodeNumber = async() => {
        const lis: any[] = await managementList;
        let biggest: number = Number.NEGATIVE_INFINITY;

        for(let i = 0; i <= lis?.length; i++) {
            if(lis?.[i]?.code !== null && lis?.[i]?.code > biggest) biggest = lis[i].code;
        }

        return biggest + 1;
    }
      
    const [managementCode, setManagementCode] = useState<number>(0);

    useEffect(() => {
        getBiggestCodeNumber().then(code => setManagementCode(code));
    }, [managementList]);

    const [managementName, setManagementName] = useState<string>('');
    const [managementType, setManagementType] = useState<string>('CANTITATIV_VALORIC');
    const [manager, setManager] = useState<string>('');
    const [isSellingPrice, setIsSellingPrice] = useState<boolean>(false);
    const [vatRate, setVatRate] = useState<string>('ZERO');

    const handleSaveNewManagement = async() => {
        const response = await saveNewManagement({
            managementCode,
            managementName,
            managementType,
            manager,
            isSellingPrice,
            vatRate,
            currentClientCompanyEin
        }).unwrap();
        console.log('New management:', response);
        setIsNewManagement(false);
        setManagementCode(managementCode + 1);
        setManagementName('');
        setManagementType('CANTITATIV_VALORIC');
        setManager('');
        setIsSellingPrice(false);
        setVatRate('ZERO');
        refetchManagementList();
    };
    
    const handleDeleteManagement = async(managementId: number) => {
        const response = await deleteManagement({managementId}).unwrap();
        console.log('Deleted management:', response);
        refetchManagementList();
    };

    const handleDeleteArticle = async(articleId: number) => {
        const response = await deleteArticle({articleId}).unwrap();
        console.log('Deleted article:', response);
        refetchArticleList();
    };

    const handleCancelNewManagement = () => {
        setIsNewManagement(false);
        setManagementName('');
        setManagementType('CANTITATIV_VALORIC');
        setManager('');
        setIsSellingPrice(false);
        setVatRate('ZERO');
    };

    const getVatDisplay = (vat: string) => {
        switch(vat) {
            case 'NINETEEN': return '19%';
            case 'NINE': return '9%';
            case 'FIVE': return '5%';
            default: return '0%';
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            onClick={() => setIsCompanyAccountingDetailsModal(false)}
        >
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[var(--foreground)] w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl border border-[var(--text4)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-[var(--text4)] bg-gradient-to-r from-[var(--background)] to-[var(--foreground)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-blue-500 rounded-2xl flex items-center justify-center">
                                {isArticleSelected ? <Package size={24} className="text-white" /> : <Settings size={24} className="text-white" />}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--text1)]">
                                    {language === 'ro' ? 'Gestiunea Companiei' : 'Company Management'}
                                </h2>
                                <p className="text-[var(--text3)]">
                                    {language === 'ro' ? 'Articole și gestiuni pentru companie' : 'Articles and management for company'}
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setIsCompanyAccountingDetailsModal(false)}
                            className="p-3 hover:bg-red-500/10 rounded-2xl transition-colors duration-200 text-[var(--text3)] hover:text-red-500"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-1 bg-[var(--background)] p-1 rounded-2xl border border-[var(--text4)] w-fit mt-4">
                        <button
                            onClick={() => setIsArticleSelected(true)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                                isArticleSelected
                                    ? 'bg-[var(--primary)] text-white shadow-md'
                                    : 'text-[var(--text2)] hover:text-[var(--primary)]'
                            }`}
                        >
                            <Package size={18} />
                            {language === 'ro' ? 'Articole' : 'Articles'}
                        </button>
                        <button
                            onClick={() => setIsArticleSelected(false)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                                !isArticleSelected
                                    ? 'bg-[var(--primary)] text-white shadow-md'
                                    : 'text-[var(--text2)] hover:text-[var(--primary)]'
                            }`}
                        >
                            <Settings size={18} />
                            {language === 'ro' ? 'Gestiuni' : 'Management'}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {isArticleSelected ? (
                            <motion.div
                                key="articles"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                {/* Articles Header */}
                                <div className="bg-[var(--background)] rounded-2xl p-4 border border-[var(--text4)]">
                                    <div className="grid grid-cols-6 gap-4 items-center font-semibold text-[var(--text2)]">
                                        <span>{language === 'ro' ? 'Cod' : 'Code'}</span>
                                        <span>{language === 'ro' ? 'Nume' : 'Name'}</span>
                                        <span>TVA</span>
                                        <span>UM</span>
                                        <span>{language === 'ro' ? 'Tip' : 'Type'}</span>
                                        <span className="text-center">{language === 'ro' ? 'Acțiuni' : 'Actions'}</span>
                                    </div>
                                </div>

                                {/* Articles List */}
                                <div className="space-y-2">
                                    {articleList?.map((article: Article, index:number) => (
                                        <motion.div
                                            key={article.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="bg-[var(--background)] rounded-xl p-4 border border-[var(--text4)] hover:border-[var(--primary)]/50 transition-all duration-200"
                                        >
                                            <div className="grid grid-cols-6 gap-4 items-center">
                                                <span className="font-semibold text-[var(--text1)]">{article.code}</span>
                                                <span className="text-[var(--text1)] truncate" title={article.name}>{article.name}</span>
                                                <span className="text-[var(--primary)] font-semibold">{getVatDisplay(article.vat)}</span>
                                                <span className="text-[var(--text2)]">{article.unitOfMeasure}</span>
                                                <span className="text-[var(--text2)] text-sm">{article.type}</span>
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => handleDeleteArticle(article.id || 0)}
                                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                    >
                                                        <Trash size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {articleList?.length === 0 && (
                                    <div className="text-center py-12">
                                        <Package size={48} className="mx-auto text-[var(--text3)] mb-4" />
                                        <p className="text-[var(--text2)] text-lg">
                                            {language === 'ro' ? 'Nu există articole' : 'No articles found'}
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="management"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                {/* Management Header */}
                                <div className="bg-[var(--background)] rounded-2xl p-4 border border-[var(--text4)]">
                                    <div className="grid grid-cols-7 gap-4 items-center font-semibold text-[var(--text2)]">
                                        <span>{language === 'ro' ? 'Cod' : 'Code'}</span>
                                        <span>{language === 'ro' ? 'Nume' : 'Name'}</span>
                                        <span>{language === 'ro' ? 'Tip' : 'Type'}</span>
                                        <span>{language === 'ro' ? 'Gestionar' : 'Manager'}</span>
                                        <span className="text-center">{language === 'ro' ? 'Preț Vânzare' : 'Selling Price'}</span>
                                        <span>TVA</span>
                                        <span className="text-center">{language === 'ro' ? 'Acțiuni' : 'Actions'}</span>
                                    </div>
                                </div>

                                {/* Management List */}
                                <div className="space-y-2">
                                    {managementList?.map((management: Management, index:number) => (
                                        <motion.div
                                            key={management.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="bg-[var(--background)] rounded-xl p-4 border border-[var(--text4)] hover:border-[var(--primary)]/50 transition-all duration-200"
                                        >
                                            <div className="grid grid-cols-7 gap-4 items-center">
                                                <span className="font-semibold text-[var(--text1)]">{management.code}</span>
                                                <span className="text-[var(--text1)] truncate" title={management.name}>{management.name}</span>
                                                <span className="text-[var(--text2)] text-sm">{management.type?.replace('_', ' ')}</span>
                                                <span className="text-[var(--text2)]">{management.manager || '-'}</span>
                                                <div className="flex justify-center">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                        management.isSellingPrice ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                                    }`}>
                                                        {management.isSellingPrice ? <Check size={16} /> : <X size={16} />}
                                                    </div>
                                                </div>
                                                <span className="text-[var(--primary)] font-semibold">{getVatDisplay(management.vatRate || 'ZERO')}</span>
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => handleDeleteManagement(management.id || 0)}
                                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                    >
                                                        <Trash size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {/* New Management Form */}
                                    {isNewManagement && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="bg-gradient-to-r from-[var(--primary)]/10 to-blue-500/10 rounded-xl p-4 border border-[var(--primary)]/30"
                                        >
                                            <div className="grid grid-cols-6 gap-4 items-center">
                                                <input
                                                    value={managementCode}
                                                    readOnly
                                                    className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] font-semibold text-center"
                                                />
                                                <input
                                                    value={managementName}
                                                    onChange={(e) => setManagementName(e.target.value)}
                                                    placeholder={language === 'ro' ? 'Nume gestiune...' : 'Management name...'}
                                                    className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                                />
                                                <select
                                                    value={managementType}
                                                    onChange={(e) => setManagementType(e.target.value)}
                                                    className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                                >
                                                    <option value="GLOBAL_VALORIC">Global Valoric</option>
                                                    <option value="CANTITATIV_VALORIC">Cantitativ Valoric</option>
                                                </select>
                                                <input
                                                    value={manager}
                                                    onChange={(e) => setManager(e.target.value)}
                                                    placeholder={language === 'ro' ? 'Gestionar...' : 'Manager...'}
                                                    className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                                />
                                                <select
                                                    value={isSellingPrice.toString()}
                                                    onChange={(e) => setIsSellingPrice(e.target.value === 'true')}
                                                    className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                                >
                                                    <option value="false">{language === 'ro' ? 'Nu' : 'No'}</option>
                                                    <option value="true">{language === 'ro' ? 'Da' : 'Yes'}</option>
                                                </select>
                                                <select
                                                    value={vatRate}
                                                    onChange={(e) => setVatRate(e.target.value)}
                                                    className="px-3 py-2 bg-[var(--background)] border border-[var(--text4)] rounded-lg text-[var(--text1)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                                >
                                                    <option value="ZERO">0%</option>
                                                    <option value="FIVE">5%</option>
                                                    <option value="NINE">9%</option>
                                                    <option value="NINETEEN">19%</option>
                                                </select>
                                            </div>
                                            
                                            <div className="flex gap-3 mt-4 justify-end">
                                                <button
                                                    onClick={handleCancelNewManagement}
                                                    className="flex items-center gap-2 px-4 py-2 bg-[var(--background)] border border-[var(--text4)] text-[var(--text2)] rounded-xl hover:bg-[var(--text4)]/20 transition-all duration-200"
                                                >
                                                    <X size={16} />
                                                    {language === 'ro' ? 'Anulează' : 'Cancel'}
                                                </button>
                                                <button
                                                    onClick={handleSaveNewManagement}
                                                    disabled={managementName.length === 0}
                                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--primary)] to-blue-500 disabled:from-[var(--text4)] disabled:to-[var(--text4)] text-white rounded-xl disabled:cursor-not-allowed hover:shadow-lg transition-all duration-200"
                                                >
                                                    <Save size={16} />
                                                    {language === 'ro' ? 'Salvează' : 'Save'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {managementList?.length === 0 && !isNewManagement && (
                                    <div className="text-center py-12">
                                        <Settings size={48} className="mx-auto text-[var(--text3)] mb-4" />
                                        <p className="text-[var(--text2)] text-lg mb-4">
                                            {language === 'ro' ? 'Nu există gestiuni' : 'No management found'}
                                        </p>
                                    </div>
                                )}

                                {/* Add New Management Button */}
                                {!isNewManagement && (
                                    <div className="flex justify-center pt-4">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setIsNewManagement(true)}
                                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-blue-500 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
                                        >
                                            <Plus size={20} />
                                            {language === 'ro' ? 'Adaugă Gestiune Nouă' : 'Add New Management'}
                                        </motion.button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default CompanyArticlesModal;