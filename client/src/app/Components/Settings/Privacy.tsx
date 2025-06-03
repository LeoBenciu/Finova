import { useState } from 'react';
import { Shield, CircleCheckBig, Clock, ExternalLink, Check, X } from "lucide-react";
import { useGetUserAgreementsQuery, useUpdateUserConsentMutation } from '@/redux/slices/apiSlice';

interface AgreementData {
    accepted: boolean;
    acceptedAt: string | null;
    version: string | null;
}

interface UserAgreements {
    terms: AgreementData;
    privacy: AgreementData;
    dpa: AgreementData;
    cookies: AgreementData;
    marketing: AgreementData;
}

const Privacy = () => {
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const { 
        data: agreements, 
        isLoading, 
        error,
        refetch 
    } = useGetUserAgreementsQuery({});

    const [updateConsent] = useUpdateUserConsentMutation();

    const openInNewTab = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('ro-RO');
    };

    const handleMarketingConsentChange = async (accepted: boolean) => {
        setIsUpdating('marketing');
        try {
            await updateConsent({
                agreementType: 'marketing',
                accepted: accepted
            }).unwrap();

            console.log('Marketing consent updated successfully');
            
        } catch (error) {
            console.error('Failed to update marketing consent:', error);
        } finally {
            setIsUpdating(null);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg border-[1px] border-neutral-200 mt-10 mx-10 min-w-96 
            min-h-96 px-10 flex flex-col items-center justify-center p-[15px] shadow-md">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                <p className="mt-2 text-neutral-600">Se încarcă datele...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg border-[1px] border-neutral-200 mt-10 mx-10 min-w-96 
            min-h-96 px-10 flex flex-col items-center justify-center p-[15px] shadow-md">
                <p className="text-red-600">Eroare la încărcarea datelor de confidențialitate</p>
                <button 
                    onClick={() => refetch()}
                    className="mt-2 px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:opacity-80"
                >
                    Încearcă din nou
                </button>
            </div>
        );
    }

    const agreementLabels = {
        terms: 'Termeni si Conditii',
        privacy: 'Politica de confidentialitate',
        dpa: 'Acord Prelucrare Date',
        cookies: 'Politica de Cookie-uri',
        marketing: 'Comunicări Marketing'
    };

    const agreementUrls = {
        terms: '/terms-of-service',
        privacy: '/privacy-policy',
        dpa: '/data-processing-agreement',
        cookies: '/cookies-policy',
        marketing: '/marketing-policy'
    };

    const renderAgreementRow = (agreementType: keyof UserAgreements) => {
        const agreement = agreements?.[agreementType];
        const isAccepted = agreement?.accepted || false;
        const acceptedDate = agreement?.acceptedAt;

        return (
            <div key={agreementType} className="my-[15px] min-w-full min-h-16 flex flex-row justify-between
            bg-white rounded-md border-neutral-400 shadow-sm px-[10px] items-center">
                <div className="flex flex-row gap-2 items-center">
                    {isAccepted ? (
                        <CircleCheckBig size={20} className="text-green-500"/>
                    ) : (
                        <Clock size={20} className="text-neutral-500"/>
                    )}
                    <p className="text-black font-bold">{agreementLabels[agreementType]}</p>
                    <div className={`rounded-md flex flex-row items-center shadow-sm max-h-max p-[5px]
                    justify-center font-bold text-sm ${
                        isAccepted 
                            ? 'bg-black text-white' 
                            : 'bg-neutral-300 text-black'
                    }`}>
                        <p>{isAccepted ? 'Acceptat' : 'Refuzat'}</p>
                    </div>
                </div>

                <div className="flex flex-row gap-2 items-center">
                    <p className="text-neutral-600">{formatDate(acceptedDate)}</p>
                    
                    {agreementType === 'marketing' ? (
                        <div className="flex gap-2">
                            {!isAccepted ? (
                                <button
                                    onClick={() => handleMarketingConsentChange(true)}
                                    disabled={isUpdating === 'marketing'}
                                    className="flex flex-row items-center rounded-md border-[1px] justify-center
                                    border-green-500 bg-green-50 shadow-sm p-[5px] max-h-max cursor-pointer 
                                    hover:bg-green-100 gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUpdating === 'marketing' ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                                    ) : (
                                        <Check size={15} className="text-green-600"/>
                                    )}
                                    <p className="font-bold text-green-600 text-sm">Accept</p>
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleMarketingConsentChange(false)}
                                    disabled={isUpdating === 'marketing'}
                                    className="flex flex-row items-center rounded-md border-[1px] justify-center
                                    border-red-500 bg-red-50 shadow-sm p-[5px] max-h-max cursor-pointer 
                                    hover:bg-red-100 gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUpdating === 'marketing' ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                                    ) : (
                                        <X size={15} className="text-red-600"/>
                                    )}
                                    <p className="font-bold text-red-600 text-sm">Refuz</p>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-row items-center rounded-md border-[1px] justify-center
                         border-neutral-300 shadow-sm p-[5px] max-h-max cursor-pointer hover:bg-neutral-300
                         gap-1" onClick={() => openInNewTab(agreementUrls[agreementType])}>
                            <ExternalLink size={15} className="text-black"/>
                            <p className="font-bold text-black text-base">Vezi Documentul</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border-[1px] border-neutral-200 mt-10 mx-10 min-w-96 
        min-h-96 px-10 flex flex-col items-start col-start-1 p-[15px] shadow-md">
            <div className="flex flex-row gap-1">
                <Shield size={25} className="text-[var(--primary)]"/>
                <h3 className="text-black font-bold text-2xl">Confidențialitate și Date Personale</h3>
            </div>
            <h4 className="text-neutral-700 text-sm mb-5">Gestionați-vă datele personale și drepturile de confidențialitate</h4>

            {agreements && Object.keys(agreementLabels).map((agreementType) => 
                renderAgreementRow(agreementType as keyof UserAgreements)
            )}

            <div className="mt-4 w-full flex justify-end">
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 text-sm bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200
                    border border-neutral-300"
                >
                    Actualizează
                </button>
            </div>
        </div>
    );
};

export default Privacy;