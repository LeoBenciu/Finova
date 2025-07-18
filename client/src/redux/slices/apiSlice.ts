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
    tagTypes: [
        'UserAgreements', 
        'Files', 
        'DuplicateAlerts', 
        'ComplianceAlerts', 
        'DocumentRelations', 
        'PaymentSummaries',
        'AvailablePayments',
        'RelationshipSuggestions'
    ],
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

        extractData: build.mutation({
            query:({file, clientCompanyEin})=>{
                const formData: FormData = new FormData();
                formData.append('file', file);
                formData.append('ein', clientCompanyEin);

                return{
                    url:'/data-extraction',
                    method: 'POST',
                    body: formData,
                    headers: {

                    }
                }
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
            invalidatesTags: ['Files', 'DuplicateAlerts', 'ComplianceAlerts', 'PaymentSummaries', 'DocumentRelations']
        }),

        getFiles: build.query({
            query:({company})=>({
                url:`/files/${company}`,
                method:'GET'
            }),
            providesTags: ['Files', 'PaymentSummaries', 'DocumentRelations']
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
            invalidatesTags: ['Files', 'PaymentSummaries']
        }),

        deleteFileAndExtractedData: build.mutation({
            query:({docId, clientCompanyEin})=>({
                url:`/files`,
                method:'DELETE',
                body:{
                    clientCompanyEin,
                    docId
                }}),
            invalidatesTags: ['Files', 'DuplicateAlerts', 'ComplianceAlerts', 'DocumentRelations', 'PaymentSummaries']
        }),

        getDocumentWithRelations: build.query({
            query: (documentId) => `/files/document/${documentId}/relations`,
            providesTags: (_, __, documentId) => [
                { type: 'DocumentRelations', id: documentId },
                { type: 'PaymentSummaries', id: documentId }
            ]
        }),

        createDocumentRelation: build.mutation({
            query: (data) => ({
                url: '/files/relations',
                method: 'POST', 
                body: data
            }),
            invalidatesTags: ['Files', 'DocumentRelations', 'PaymentSummaries', 'AvailablePayments']
        }),

        updateDocumentRelation: build.mutation({
            query: ({ relationId, data }) => ({
                url: `/files/relations/${relationId}`,
                method: 'PUT',
                body: data
            }),
            invalidatesTags: ['Files', 'DocumentRelations', 'PaymentSummaries']
        }),

        deleteDocumentRelation: build.mutation({
            query: (relationId) => ({
                url: `/files/relations/${relationId}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['Files', 'DocumentRelations', 'PaymentSummaries', 'AvailablePayments']
        }),

        refreshPaymentSummaries: build.mutation({
            query: (company) => ({
                url: `/files/${company}/refresh-payments`,
                method: 'POST'
            }),
            invalidatesTags: ['Files', 'PaymentSummaries']
        }),

        updatePaymentStatus: build.mutation({
            query: ({ documentId, manualPaidAmount }) => ({
                url: `/files/document/${documentId}/payment-status`,
                method: 'PUT',
                body: { manualPaidAmount }
            }),
            invalidatesTags: ['Files', 'PaymentSummaries', 'DocumentRelations']
        }),

        getPaymentSummaryStats: build.query({
            query: (company) => ({
                url: `/files/${company}/payment-stats`,
                method: 'GET'
            }),
            providesTags: ['PaymentSummaries']
        }),

        getAvailablePaymentDocuments: build.query({
            query: ({ company, invoiceId }) => ({
                url: `/files/${company}/available-payments/${invoiceId}`,
                method: 'GET'
            }),
            providesTags: ['AvailablePayments']
        }),

        suggestDocumentRelationships: build.query({
            query: ({ company, documentId }) => ({
                url: `/files/${company}/suggest-relationships/${documentId}`,
                method: 'GET'
            }),
            providesTags: ['RelationshipSuggestions']
        }),

        createAutomaticRelationships: build.mutation({
            query: ({ company, documentId, suggestions }) => ({
                url: `/files/${company}/auto-relationships/${documentId}`,
                method: 'POST',
                body: { suggestions }
            }),
            invalidatesTags: ['Files', 'DocumentRelations', 'PaymentSummaries', 'AvailablePayments']
        }),

        getUnlinkedDocuments: build.query({
            query: (company) => ({
                url: `/files/${company}/unlinked`,
                method: 'GET'
            }),
            providesTags: ['Files', 'DocumentRelations']
        }),

        bulkCreateRelationships: build.mutation({
            query: ({ company, relationships }) => ({
                url: `/files/${company}/bulk-relationships`,
                method: 'POST',
                body: { relationships }
            }),
            invalidatesTags: ['Files', 'DocumentRelations', 'PaymentSummaries', 'AvailablePayments']
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

        getUserAgreements: build.query({
            query: () => ({
                url: '/users/me/agreements',
                method: 'GET',
            }),
            providesTags: ['UserAgreements']
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

        getRpaData: build.query({
            query:()=>({
                url: '/uipath/data',
                method:'GET',
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
    })
})

export const {
    // Authentication hooks
    useLoginMutation, 
    useSignupMutation, 
    useForgotPasswordMutation,
    useResetPasswordMutation,

    // Data extraction hooks
    useExtractDataMutation, 
    useSaveFileAndExtractedDataMutation,

    // Enhanced file management hooks
    useGetFilesQuery, 
    useUpdateFileAndExtractedDataMutation,
    useDeleteFileAndExtractedDataMutation,

    // NEW: Document relationship hooks
    useGetDocumentWithRelationsQuery,
    useCreateDocumentRelationMutation,
    useUpdateDocumentRelationMutation,
    useDeleteDocumentRelationMutation,

    // NEW: Payment tracking hooks
    useRefreshPaymentSummariesMutation,
    useUpdatePaymentStatusMutation,
    useGetPaymentSummaryStatsQuery,

    // NEW: Relationship suggestion hooks
    useGetAvailablePaymentDocumentsQuery,
    useSuggestDocumentRelationshipsQuery,
    useCreateAutomaticRelationshipsMutation,
    useGetUnlinkedDocumentsQuery,
    useBulkCreateRelationshipsMutation,

    // Client company hooks
    useGetClientCompaniesMutation,
    useCreateClientCompanyMutation,
    useDeleteClientCompanyMutation,

    // User management hooks
    useGetUserDataQuery,
    useDeleteUserAccountMutation,
    useModifyUserAccountMutation,
    useModifyUserPasswordMutation,
    useGetUserAgreementsQuery, 
    useUpdateUserConsentMutation,

    // RPA/UiPath hooks
    useGetRpaDataQuery,
    useModifyRpaCredentialsMutation,
    useInsertClientInvoiceMutation,
    useGetJobStatusQuery,

    // Management & Articles hooks
    useGetManagementQuery, 
    useSaveNewManagementMutation,
    useGetArticlesQuery,
    useDeleteManagementMutation, 
    useDeleteArticleMutation,
    useGetCompanyDataQuery,

    // Alerts & Compliance hooks
    useGetDuplicateAlertsQuery,
    useGetComplianceAlertsQuery, 
    useUpdateDuplicateStatusMutation,

    // Service health hook
    useGetServiceHealthQuery
} = finovaApi;