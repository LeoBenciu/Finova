import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'
import { logout } from '@/app/helper/authHelpers';


const baseQuery = fetchBaseQuery({
    baseUrl: 'https://finova-6eeu.onrender.com',
    prepareHeaders: (headers)=>{
        const token = localStorage.getItem('token');
        if(token){
            headers.set('Authorization', `Bearer ${token}`);
        }
        return headers;
    }
})

const baseQueryWithAuthHandling = async (args:any, api:any, extraOptions:any) =>{
    const result = await baseQuery(args, api, extraOptions);

    if(result.error && result.error.status === 401){
        logout();
    }

    return result;
}

export const finovaApi = createApi({
    reducerPath: 'finovaApi',
    baseQuery: baseQueryWithAuthHandling,
    tagTypes: ['UserAgreements', 'Files', 'DuplicateAlerts', 'ComplianceAlerts', 'BankReconciliation'],
    endpoints: (build) =>({
        signup: build.mutation({
            query:(credentials)=>({
                url: '/auth/signup',
                method: 'POST',
                body: credentials
            }),
        }),

        login: build.mutation({
            query:(credentials)=>({
                url:'/auth/login',
                method: 'POST',
                body: credentials
            })
        }),

        extractData: build.mutation({
            query:({file, clientCompanyEin, phase = 0, phase0Data}:{file: File; clientCompanyEin: string; phase?: number; phase0Data?: { document_type: string; direction?: string; referenced_numbers?: string[] }})=>{
                const formData: FormData = new FormData();
                formData.append('file', file);
                formData.append('ein', clientCompanyEin);
                if (phase !== undefined){
                    formData.append('phase', phase.toString());
                }
                if (phase0Data !== undefined){
                    formData.append('phase0Data', JSON.stringify(phase0Data));
                }
                return{
                    url:'/data-extraction',
                    method: 'POST',
                    body: formData,
                }
            }
        }),

        processBatch: build.mutation({
            query: ({ files, clientCompanyEin }: { files: File[]; clientCompanyEin: string }) => {
                const formData = new FormData();
                files.forEach((file) => {
                    formData.append('files', file);
                });
                formData.append('ein', clientCompanyEin);
                
                return {
                    url: '/data-extraction/batch',
                    method: 'POST',
                    body: formData,
                    headers: {
                    }
                };
            },
            transformResponse: (response: any) => {
                return {
                    categorizedResults: response.categorizedResults || [],
                    incomingInvoices: response.incomingInvoices || [],
                    outgoingInvoices: response.outgoingInvoices || [],
                    otherDocuments: response.otherDocuments || [],
                    processingStats: response.processingStats || {
                        total: 0,
                        categorized: 0,
                        incomingProcessed: 0,
                        outgoingProcessed: 0,
                        othersProcessed: 0,
                        errors: 0
                    }
                };
            }
        }),

        saveFileAndExtractedData: build.mutation({
            query:({clientCompanyEin, processedData, file})=>{
                const formData: FormData = new FormData();
                formData.append('file', file);
                formData.append('clientCompanyEin', clientCompanyEin);
                formData.append('processedData', JSON.stringify(processedData));

                return{
                    url:`/files`,
                    method: 'POST',
                    body: formData,
                    formData: true
                }
            },
            invalidatesTags: ['Files', 'DuplicateAlerts', 'ComplianceAlerts']
        }),

        updateFileAndExtractedData: build.mutation({
            query: ({ processedData, clientCompanyEin, docId }) => {
              return {
                url: `/files`,
                method: 'PUT',
                body: {
                  clientCompanyEin,
                  processedData,
                  docId
                }
              };
            },
            invalidatesTags: ['Files']
          }),

        deleteFileAndExtractedData: build.mutation({
            query:({docId, clientCompanyEin})=>({
                url:`/files`,
                method:'DELETE',
                body:{
                    clientCompanyEin,
                    docId
                }}),
            invalidatesTags: ['Files', 'DuplicateAlerts', 'ComplianceAlerts']
        }),

        getClientCompanies: build.mutation({
            query:()=>({
                url:'/client-companies',
                method:'GET',
            })
        }),

        createClientCompany: build.mutation({
            query:({ein, articles, management})=>{
                const formData: FormData = new FormData();
                formData.append('articles', articles);
                formData.append('management', management);
                formData.append('ein', ein);

                return{
                    url:'/client-companies',
                    method:'POST',
                    body: formData,
                    formData: true
                }
            }
        }),

        deleteClientCompany: build.mutation({
            query:(ein)=>({
                url:'/client-companies',
                method:'DELETE',
                body: {
                    ein
                }
            })
        }),

        getUserData: build.query({
            query:()=>({
                url:'/users/me',
                method:'GET',
            })
        }),

        getRpaData: build.query({
            query:()=>({
                url: '/uipath/data',
                method:'GET',
            })
        }),

        deleteUserAccount: build.mutation({
            query:()=>({
                url:'/users/me',
                method:'DELETE'
            })
        }),

        modifyUserAccount: build.mutation({
            query:({name,email,role,phoneNumber})=>({
                url:'/users/me',
                method:'PUT',
                body:{
                    name,
                    email,
                    role,
                    phoneNumber
                }
            })
        }),

        modifyUserPassword: build.mutation({
            query:({password})=>({
                url:'/users/me/password',
                method:'PUT',
                body:{
                    password
                }
            })
        }),

        modifyRpaCredentials: build.mutation({
            query:({uipathSubfolder,clientInvoiceRk,supplierInvoiceRk,
                clientReceiptRk,supplierReceiptRk})=>({
                url: '/uipath/data',
                method: 'PUT',
                body: {
                    uipathSubfolder,
                    clientInvoiceRk,
                    supplierInvoiceRk,
                    clientReceiptRk,
                    supplierReceiptRk
                }
            })
        }),

        getFiles: build.query({
            query:({company})=>({
                url:`/files/${company}`,
                method:'GET'
            }),
            providesTags: ['Files']
        }),

        getInvoicePayments: build.query({
            query: (docId) => ({
                url: `/files/payments/${docId}`,
                method: 'GET',
            }),
        }),

        getSomeFiles: build.mutation({
            query:({docIds, clientEin})=>({
                url:'/files/some-files',
                method:'POST',
                body: {
                    docIds: [...docIds],
                    clientEin
                }
            })
        }),

        getDuplicateAlerts: build.query({
            query:({company})=>({
                url:`/files/${company}/duplicate-alerts`,
                method:'GET'
            }),
            providesTags: ['DuplicateAlerts']
        }),

        getComplianceAlerts: build.query({
            query:({company})=>({
                url:`/files/${company}/compliance-alerts`,
                method:'GET'
            }),
            providesTags: ['ComplianceAlerts']
        }),

        getRelatedDocuments: build.query<any, { docId: number | string, clientEin: string }>({
            query: ({ docId, clientEin }) => ({
                url: `/files/${docId}/related?clientEin=${clientEin}`,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }),
            // Invalidate this query when the document is updated
            providesTags: (_result, _error, args) => {
                return [{ type: 'Files' as const, id: args.docId }];
            },
            // Force refetch when the arguments change
            forceRefetch({ currentArg, previousArg }) {
                return currentArg?.docId !== previousArg?.docId;
            },
        }),

        updateDocumentReferences: build.mutation({
            query: ({ docId, references }) => ({
                url: `/files/${docId}/references`,
                method: 'PATCH',
                body: { references },
            }),
            invalidatesTags: ['Files']
        }),

        updateDuplicateStatus: build.mutation({
            query:({duplicateCheckId, status})=>({
                url:`/files/duplicate-status/${duplicateCheckId}`,
                method:'PUT',
                body: {
                    status
                }
            }),
            invalidatesTags: ['DuplicateAlerts', 'Files']
        }),

        getServiceHealth: build.query({
            query:()=>({
                url:'/files/service/health',
                method:'GET'
            })
        }),

        forgotPassword: build.mutation({
            query:(email)=>({
                url:'/auth/forgot-password',
                method:'POST',
                body:email
            })
        }),

        resetPassword: build.mutation({
            query:({token, newPassword})=>({
                url:'auth/reset-password',
                method:'POST',
                body: {
                    token,
                    newPassword
                }
            })
        }),

        insertClientInvoice: build.mutation({
            query:({id, currentClientCompanyEin})=>({
                url:`uipath/:${id}`,
                method:'POST',
                body:{
                    currentClientCompanyEin
                }
            })
        }),

        getJobStatus: build.query({
            query: (id) => `uipath/status/:${id}`
        }),

        getManagement: build.query({
            query: (ein) => ({
                url: `uipath/management/${ein}`,
                method: 'GET'
            })
        }),

        getArticles: build.query({
            query: (ein)=>({
                url: `uipath/articles/${ein}`,
                method: 'GET'
            })
        }),

        saveNewManagement: build.mutation({
            query: ({managementCode, managementName, managementType, manager, isSellingPrice, vatRate,currentClientCompanyEin}) => ({
                url: 'client-companies/management',
                method: 'POST',
                body: {
                    code: managementCode,
                    name: managementName,
                    type: managementType, 
                    manager,
                    isSellingPrice,
                    vatRate,
                    currentClientCompanyEin
                }
            })
        }),

        deleteManagement: build.mutation({
            query: ({managementId}) => ({
                url: 'client-companies/delete-management',
                method: 'POST',
                body: {
                    managementId
                }
            })
        }),

        deleteArticle: build.mutation({
            query: ({articleId}) => ({
                url: 'client-companies/delete-article',
                method: 'DELETE',
                body: {
                    articleId
                }
            })
        }),

        getCompanyData: build.query({
            query: ({currentCompanyEin, year})=>({
                url:'client-companies/data',
                method: 'POST',
                body:{
                    currentCompanyEin: currentCompanyEin,
                    year
                }
            })
        }),

        getUserAgreements: build.query({
            query: () => ({
                url: '/users/me/agreements',
                method: 'GET',
            }),
            providesTags: ['UserAgreements']
        }),

        getBankReconciliationStats: build.query({
            query: (clientEin: string) => ({
                url: `/bank/${clientEin}/dashboard`,
                method: 'GET'
            }),
            providesTags: ['BankReconciliation']
        }),

        getFinancialDocuments: build.query({
            query: ({ clientEin, unreconciled, page = 1, size = 25 }: { clientEin: string; unreconciled?: boolean; page?: number; size?: number }) => {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('size', String(size));
                if (unreconciled) params.set('unreconciled', 'true');
                return {
                    url: `/bank/${clientEin}/documents?${params.toString()}`,
                    method: 'GET'
                };
            },
            transformResponse: (response: any) => ({ items: response.items ?? [], total: response.total ?? 0 }),
            providesTags: ['BankReconciliation', 'Files']
        }),

        getBankTransactions: build.query({
            query: ({ clientEin, unreconciled, page = 1, size = 25 }: { clientEin: string; unreconciled?: boolean; page?: number; size?: number }) => {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('size', String(size));
                if (unreconciled) params.set('unreconciled', 'true');
                return {
                    url: `/bank/${clientEin}/transactions?${params.toString()}`,
                    method: 'GET'
                };
            },
            transformResponse: (response: any) => ({ items: response.items ?? [], total: response.total ?? 0 }),
            providesTags: ['BankReconciliation']
        }),

        getReconciliationSuggestions: build.query({
            query: ({ clientEin, page = 1, size = 25 }: { clientEin: string; page?: number; size?: number }) => ({
                url: `/bank/${clientEin}/suggestions?page=${page}&size=${size}`,
                method: 'GET'
            }),
            transformResponse: (response: any) => ({ items: response.items ?? [], total: response.total ?? 0 }),
            providesTags: ['BankReconciliation']
        }),

        createManualMatch: build.mutation({
            query: (matchData: { documentId: number; bankTransactionId: string; notes?: string }) => ({
                url: '/bank/match',
                method: 'POST',
                body: matchData
            }),
            invalidatesTags: ['BankReconciliation', 'Files']
        }),

        createBulkMatches: build.mutation({
            query: (bulkData: { matches: Array<{ documentId: number; bankTransactionId: string; notes?: string }> }) => ({
                url: '/bank/bulk-match',
                method: 'POST',
                body: bulkData
            }),
            invalidatesTags: ['BankReconciliation', 'Files']
        }),

        acceptReconciliationSuggestion: build.mutation({
            query: ({ suggestionId, notes }: { suggestionId: number; notes?: string }) => ({
                url: `/bank/suggestion/${suggestionId}/accept`,
                method: 'PUT',
                body: { notes }
            }),
            invalidatesTags: ['BankReconciliation', 'Files']
        }),

        rejectReconciliationSuggestion: build.mutation({
            query: ({ suggestionId, reason }: { suggestionId: number; reason?: string }) => ({
                url: `/bank/suggestion/${suggestionId}/reject`,
                method: 'PUT',
                body: { reason }
            }),
            invalidatesTags: ['BankReconciliation']
        }),
        
        updateUserConsent: build.mutation({
            query: ({ agreementType, accepted }) => ({
                url: '/users/me/consent',
                method: 'PUT',
                body: {
                    agreementType,
                    accepted
                }
            }),
            invalidatesTags: ['UserAgreements']
        }),

        getReconciliationSummaryReport: build.query({
            query: ({ clientEin, month, year }: { clientEin: string; month: string; year: string }) => ({
              url: `/bank/${clientEin}/reports/reconciliation-summary?month=${month}&year=${year}`,
              method: 'GET'
            })
          }),
          
          getAccountAttributionReport: build.query({
            query: ({ clientEin, month, year }: { clientEin: string; month: string; year: string }) => ({
              url: `/bank/${clientEin}/reports/account-attribution?month=${month}&year=${year}`,
              method: 'GET'
            })
          }),
          
          getExceptionReport: build.query({
            query: ({ clientEin, month, year }: { clientEin: string; month: string; year: string }) => ({
              url: `/bank/${clientEin}/reports/exceptions?month=${month}&year=${year}`,
              method: 'GET'
            })
          })

    })
})

export const {useLoginMutation, useSignupMutation, useExtractDataMutation, useGetInvoicePaymentsQuery, 
    useSaveFileAndExtractedDataMutation, useGetClientCompaniesMutation,
useCreateClientCompanyMutation,useGetUserDataQuery,
useGetRelatedDocumentsQuery,
useUpdateDocumentReferencesMutation,
useDeleteClientCompanyMutation, useDeleteUserAccountMutation,
useModifyUserAccountMutation,useModifyUserPasswordMutation,
useGetFilesQuery, useUpdateFileAndExtractedDataMutation,
useDeleteFileAndExtractedDataMutation, useForgotPasswordMutation,
useResetPasswordMutation, useInsertClientInvoiceMutation,
useGetManagementQuery, useSaveNewManagementMutation , useGetArticlesQuery,
useGetCompanyDataQuery, useDeleteManagementMutation, useDeleteArticleMutation,
useGetJobStatusQuery , useGetUserAgreementsQuery, useUpdateUserConsentMutation,
useModifyRpaCredentialsMutation, useGetRpaDataQuery, useGetDuplicateAlertsQuery,
useGetComplianceAlertsQuery, useUpdateDuplicateStatusMutation, useGetServiceHealthQuery, useProcessBatchMutation,
useGetSomeFilesMutation, useGetBankReconciliationStatsQuery, useGetFinancialDocumentsQuery,
useGetBankTransactionsQuery, useGetReconciliationSuggestionsQuery, useCreateManualMatchMutation,
useCreateBulkMatchesMutation, useAcceptReconciliationSuggestionMutation, useRejectReconciliationSuggestionMutation,
useGetReconciliationSummaryReportQuery, useGetAccountAttributionReportQuery, useGetExceptionReportQuery} = finovaApi;