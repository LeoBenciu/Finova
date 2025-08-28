import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'
import { logout } from '@/app/helper/authHelpers';


const baseQuery = fetchBaseQuery({
    baseUrl: 'https://finova-6eeu.onrender.com',
    prepareHeaders: (headers)=>{
        const token = localStorage.getItem('token');
        console.log('🔐 API Request - Token:', token ? 'Present' : 'Missing');
        if(token){
            console.log('🔐 Token Preview:', token.substring(0, 50) + '...');
            headers.set('Authorization', `Bearer ${token}`);
        } else {
            console.error('🚨 NO TOKEN FOUND IN LOCALSTORAGE!');
        }
        return headers;
    }
})

const baseQueryWithAuthHandling = async (args:any, api:any, extraOptions:any) =>{
    const result = await baseQuery(args, api, extraOptions);
    
    console.log('🌐 API Response:', {
        url: typeof args === 'string' ? args : args.url,
        status: result.error?.status || 'success',
        hasData: !!result.data
    });

    if(result.error && result.error.status === 401){
        const token = localStorage.getItem('token');
        console.error('🚨 401 UNAUTHORIZED ERROR DETAILS:', {
            url: typeof args === 'string' ? args : args.url,
            method: typeof args === 'object' ? args.method : 'GET',
            errorData: result.error.data,
            token: token ? 'Present' : 'Missing',
            tokenLength: token ? token.length : 0,
            tokenStart: token ? token.substring(0, 20) : 'N/A'
        });
        
        // Try to decode token to check expiration
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const now = Math.floor(Date.now() / 1000);
                console.error('🕰️ TOKEN EXPIRATION CHECK:', {
                    tokenExp: payload.exp,
                    currentTime: now,
                    isExpired: payload.exp < now,
                    expiresIn: payload.exp - now,
                    userId: payload.sub
                });
            } catch (e) {
                console.error('🚨 INVALID TOKEN FORMAT:', e);
            }
        }
        
        console.log('🔄 401 Unauthorized - logging out');
        logout();
    }

    return result;
}

export const finovaApi = createApi({
    reducerPath: 'finovaApi',
    baseQuery: baseQueryWithAuthHandling,
    tagTypes: ['UserAgreements', 'Files', 'DuplicateAlerts', 'ComplianceAlerts', 'BankReconciliation', 'BankAccounts', 'BankTransactions', 'BankAccountAnalytics', 'Todos'],
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

        // Optional: company users listing (used for assignee dropdown). If backend lacks this route, UI will degrade gracefully.
        getCompanyUsers: build.query<any[], void>({
            query: () => ({
                url: '/users/company',
                method: 'GET'
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
            query: ({ company, page = 1, limit = 25, q, type, paymentStatus, dateFrom, dateTo, sort }: {
                company: string;
                page?: number;
                limit?: number;
                q?: string;
                type?: string;
                paymentStatus?: string;
                dateFrom?: string;
                dateTo?: string;
                sort?: string; // e.g., 'createdAt_desc'
            }) => {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('limit', String(limit));
                if (q) params.set('q', q);
                if (type) params.set('type', type);
                if (paymentStatus) params.set('paymentStatus', paymentStatus);
                if (dateFrom) params.set('dateFrom', dateFrom);
                if (dateTo) params.set('dateTo', dateTo);
                params.set('sort', sort || 'createdAt_desc');

                return {
                    url: `/files/${company}?${params.toString()}`,
                    method: 'GET'
                };
            },
            transformResponse: (response: any) => {
                if (!response) return { items: [], total: 0 };
                // Backward compatibility in case older backend returns {documents: []}
                const items = response.items ?? response.documents ?? [];
                const total = response.totalCount ?? response.total ?? (Array.isArray(response.documents) ? response.documents.length : 0) ?? 0;
                return { items, total, accountingCompany: response.accountingCompany, clientCompany: response.clientCompany };
            },
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
        
        getBalanceReconciliationStatement: build.query<any, { clientEin: string; startDate?: string; endDate?: string }>({
          query: ({ clientEin, startDate, endDate }) => ({
            url: `/bank/${clientEin}/balance-reconciliation`,
            params: { startDate, endDate }
          }),
          providesTags: ['BankReconciliation']
        }),

        getBankReconciliationSummaryReport: build.query<any, { clientEin: string; startDate?: string; endDate?: string }>({
          query: ({ clientEin, startDate, endDate }) => ({
            url: `/bank/${clientEin}/reports/summary`,
            params: { startDate, endDate }
          }),
          providesTags: ['BankReconciliation']
        }),

        getOutstandingItemsAging: build.query<any, { clientEin: string }>({
          query: ({ clientEin }) => ({
            url: `/bank/${clientEin}/reports/outstanding-items`
          }),
          providesTags: ['BankReconciliation']
        }),

        getReconciliationHistoryAndAuditTrail: build.query<any, { clientEin: string; startDate?: string; endDate?: string; page?: number; size?: number }>({
          query: ({ clientEin, startDate, endDate, page, size }) => ({
            url: `/bank/${clientEin}/reports/audit-trail`,
            params: { startDate, endDate, page, size }
          }),
          providesTags: ['BankReconciliation']
        }),

        getFinancialDocuments: build.query({
            query: ({ clientEin, status = 'all', unreconciled, page = 1, size = 25 }: { clientEin: string; status?: 'all' | 'reconciled' | 'unreconciled' | 'ignored'; unreconciled?: boolean; page?: number; size?: number }) => {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('size', String(size));
                
                // Support both new status parameter and legacy unreconciled parameter for backwards compatibility
                if (status && status !== 'all') {
                    params.set('status', status);
                } else if (unreconciled) {
                    params.set('unreconciled', 'true');
                }
                
                return {
                    url: `/bank/${clientEin}/documents?${params.toString()}`,
                    method: 'GET'
                };
            },
            transformResponse: (response: any) => {
                if (!response) return { items: [], total: 0 };
                return { items: response.items ?? [], total: response.total ?? 0 };
            },
            providesTags: ['BankReconciliation', 'Files']
        }),

        getBankTransactions: build.query({
            query: ({ clientEin, status = 'all', unreconciled, page = 1, size = 25 }: { clientEin: string; status?: 'all' | 'reconciled' | 'unreconciled'; unreconciled?: boolean; page?: number; size?: number }) => {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('size', String(size));
                
                // Support both new status parameter and legacy unreconciled parameter for backwards compatibility
                if (status && status !== 'all') {
                    params.set('status', status);
                } else if (unreconciled) {
                    params.set('unreconciled', 'true');
                }
                
                return {
                    url: `/bank/${clientEin}/transactions?${params.toString()}`,
                    method: 'GET'
                };
            },
            transformResponse: (response: any) => {
                if (!response) return { items: [], total: 0 };
                return { items: response.items ?? [], total: response.total ?? 0 };
            },
            providesTags: ['BankReconciliation']
        }),

        getReconciliationSuggestions: build.query({
            query: ({ clientEin, page = 1, size = 25 }: { clientEin: string; page?: number; size?: number }) => ({
                url: `/bank/${clientEin}/suggestions?page=${page}&size=${size}`,
                method: 'GET'
            }),
            transformResponse: (response: any) => {
                if (!response) return { items: [], total: 0 };
                return { items: response.items ?? [], total: response.total ?? 0 };
            },
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

        createManualAccountReconciliation: build.mutation({
            query: ({ transactionId, accountCode, notes }: { transactionId: string; accountCode: string; notes?: string }) => ({
                url: `/bank/transaction/${transactionId}/reconcile-account`,
                method: 'PUT',
                body: { accountCode, notes }
            }),
            invalidatesTags: ['BankReconciliation']
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
        
        unreconcileTransaction: build.mutation({
            query: ({ transactionId, reason }: { transactionId: string; reason?: string }) => ({
                url: `/bank/transaction/${transactionId}/unreconcile`,
                method: 'PUT',
                body: { reason }
            }),
            invalidatesTags: ['BankReconciliation', 'Files']
        }),
        
        unreconcileDocument: build.mutation({
            query: ({ documentId, reason }: { documentId: number; reason?: string }) => ({
                url: `/bank/document/${documentId}/unreconcile`,
                method: 'PUT',
                body: { reason }
            }),
            invalidatesTags: ['BankReconciliation', 'Files']
        }),
        
        regenerateAllSuggestions: build.mutation({
            query: (clientEin: string) => ({
                url: `/bank/${clientEin}/suggestions/regenerate`,
                method: 'POST'
            }),
            invalidatesTags: ['BankReconciliation']
        }),
        
        regenerateTransactionSuggestions: build.mutation({
            query: (transactionId: string) => ({
                url: `/bank/transaction/${transactionId}/suggestions/regenerate`,
                method: 'POST'
            }),
            invalidatesTags: ['BankReconciliation']
        }),

        // ==================== TRANSACTION SPLITS API HOOKS ====================
        getTransactionSplits: build.query<any, { transactionId: string }>({
          query: ({ transactionId }) => ({
            url: `/bank/transaction/${transactionId}/splits`,
            method: 'GET'
          }),
          providesTags: ['BankReconciliation', 'BankTransactions']
        }),

        setTransactionSplits: build.mutation<
          any,
          { transactionId: string; splits: { amount: number; accountCode: string; notes?: string }[] }
        >({
          query: ({ transactionId, splits }) => ({
            url: `/bank/transaction/${transactionId}/splits`,
            method: 'PUT',
            body: { splits }
          }),
          invalidatesTags: ['BankReconciliation', 'BankTransactions']
        }),

        suggestTransactionSplits: build.mutation<any, { transactionId: string }>({
          query: ({ transactionId }) => ({
            url: `/bank/transaction/${transactionId}/splits/suggest`,
            method: 'POST'
          })
        }),

        deleteTransactionSplit: build.mutation<any, { splitId: number }>({
          query: ({ splitId }) => ({
            url: `/bank/split/${splitId}`,
            method: 'DELETE'
          }),
          invalidatesTags: ['BankReconciliation', 'BankTransactions']
        }),
        
        // ==================== TRANSFER RECONCILIATION API HOOKS ====================
        getTransferReconciliationCandidates: build.query<
          { total: number; items: Array<{ sourceTransactionId: string; destinationTransactionId: string; amount: number; dateDiffDays: number; score: number }> },
          { clientEin: string; daysWindow?: number; maxResults?: number }
        >({
          query: ({ clientEin, daysWindow = 2, maxResults = 50 }) => ({
            url: `/bank/${clientEin}/transfer-candidates`,
            method: 'GET',
            params: { daysWindow, maxResults }
          }),
          providesTags: ['BankReconciliation']
        }),

        // Per-transaction transfer candidates
        getTransferReconciliationCandidatesForTransaction: build.query<
          { total: number; items: Array<{
            counterpartyTransactionId: string;
            sourceTransactionId?: string;
            destinationTransactionId?: string;
            amount: number;
            dateDiffDays: number;
            score: number;
            sourceCurrency?: string;
            destinationCurrency?: string;
            inferredFxRate?: number;
            direction?: 'DEBIT_TO_CREDIT' | 'CREDIT_TO_DEBIT';
            counterparty?: { description?: string; transactionDate?: string; accountName?: string; amount?: number; transactionType?: 'debit' | 'credit' };
          }> },
          { clientEin: string; transactionId: string; daysWindow?: number; maxResults?: number; allowCrossCurrency?: boolean; fxTolerancePct?: number }
        >({
          query: ({ clientEin, transactionId, daysWindow = 3, maxResults = 50, allowCrossCurrency = true, fxTolerancePct }) => ({
            url: `/bank/${clientEin}/transaction/${transactionId}/transfer-candidates`,
            method: 'GET',
            params: { daysWindow, maxResults, allowCrossCurrency, ...(fxTolerancePct !== undefined ? { fxTolerancePct } : {}) }
          }),
          providesTags: ['BankReconciliation']
        }),

        createTransferReconciliation: build.mutation<
          any,
          {
            clientEin: string;
            data: {
              sourceTransactionId: string;
              destinationTransactionId: string;
              sourceAccountCode?: string;
              destinationAccountCode?: string;
              fxRate?: number;
              notes?: string;
            };
          }
        >({
          query: ({ clientEin, data }) => ({
            url: `/bank/${clientEin}/transfer-reconcile`,
            method: 'POST',
            body: data,
          }),
          invalidatesTags: ['BankReconciliation', 'BankTransactions']
        }),

        getPendingTransferReconciliations: build.query<any[], { clientEin: string }>({
          query: ({ clientEin }) => ({
            url: `/bank/${clientEin}/pending-transfers`,
            method: 'GET'
          }),
          providesTags: ['BankReconciliation']
        }),

        deleteTransferReconciliation: build.mutation<
          { id: number; deleted: true },
          { clientEin: string; id: number }
        >({
          query: ({ clientEin, id }) => ({
            url: `/bank/${clientEin}/transfer-reconcile/${id}`,
            method: 'DELETE'
          }),
          invalidatesTags: ['BankReconciliation', 'BankTransactions']
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
          }),

          // Outstanding Items Management endpoints
          getOutstandingItems: build.query({
            query: ({ clientEin, type, status, startDate, endDate }: { 
              clientEin: string; 
              type?: string; 
              status?: string; 
              startDate?: string; 
              endDate?: string; 
            }) => {
              const params = new URLSearchParams();
              if (type) params.append('type', type);
              if (status) params.append('status', status);
              if (startDate) params.append('startDate', startDate);
              if (endDate) params.append('endDate', endDate);
              
              return {
                url: `/bank/${clientEin}/outstanding-items${params.toString() ? '?' + params.toString() : ''}`,
                method: 'GET'
              };
            },
            providesTags: ['BankReconciliation']
          }),



          createOutstandingItem: build.mutation({
            query: ({ clientEin, data }: { 
              clientEin: string; 
              data: {
                type: 'OUTSTANDING_CHECK' | 'DEPOSIT_IN_TRANSIT' | 'PENDING_TRANSFER';
                referenceNumber: string;
                description: string;
                amount: number;
                issueDate: string;
                expectedClearDate?: string;
                payeeBeneficiary?: string;
                bankAccount?: string;
                notes?: string;
                relatedDocumentId?: number;
              }
            }) => ({
              url: `/bank/${clientEin}/outstanding-items`,
              method: 'POST',
              body: data
            }),
            invalidatesTags: ['BankReconciliation']
          }),

          updateOutstandingItem: build.mutation({
            query: ({ itemId, data }: { 
              itemId: number; 
              data: {
                status?: 'OUTSTANDING' | 'CLEARED' | 'STALE' | 'VOIDED';
                actualClearDate?: string;
                notes?: string;
                relatedTransactionId?: string;
              }
            }) => ({
              url: `/bank/outstanding-items/${itemId}`,
              method: 'PUT',
              body: data
            }),
            invalidatesTags: ['BankReconciliation']
          }),

          markOutstandingItemAsCleared: build.mutation({
            query: ({ itemId, data }: { 
              itemId: number; 
              data: { transactionId?: string; clearDate?: string }
            }) => ({
              url: `/bank/outstanding-items/${itemId}/clear`,
              method: 'PUT',
              body: data
            }),
            invalidatesTags: ['BankReconciliation']
          }),

          markOutstandingItemAsStale: build.mutation({
            query: ({ itemId, data }: { 
              itemId: number; 
              data: { notes?: string }
            }) => ({
              url: `/bank/outstanding-items/${itemId}/stale`,
              method: 'PUT',
              body: data
            }),
            invalidatesTags: ['BankReconciliation']
          }),

          voidOutstandingItem: build.mutation({
            query: ({ itemId, data }: { 
              itemId: number; 
              data: { notes?: string }
            }) => ({
              url: `/bank/outstanding-items/${itemId}/void`,
              method: 'PUT',
              body: data
            }),
            invalidatesTags: ['BankReconciliation']
          }),

          deleteOutstandingItem: build.mutation({
            query: ({ itemId }: { itemId: number }) => ({
              url: `/bank/outstanding-items/${itemId}/delete`,
              method: 'PUT'
            }),
            invalidatesTags: ['BankReconciliation']
          }),

          // ==================== MULTI-BANK ACCOUNT API HOOKS ====================

          getBankAccounts: build.query({
            query: (clientEin: string) => `/bank/${clientEin}/accounts`,
            providesTags: ['BankAccounts']
          }),

          createBankAccount: build.mutation({
            query: ({ clientEin, accountData }: {
              clientEin: string;
              accountData: {
                iban: string;
                accountName: string;
                bankName: string;
                currency?: string;
                accountType?: 'CURRENT' | 'SAVINGS' | 'BUSINESS' | 'CREDIT';
              }
            }) => ({
              url: `/bank/${clientEin}/accounts`,
              method: 'POST',
              body: accountData
            }),
            invalidatesTags: ['BankReconciliation', 'BankAccounts']
          }),

          updateBankAccount: build.mutation({
            query: ({ accountId, updateData }: {
              accountId: number;
              updateData: {
                accountName?: string;
                bankName?: string;
                currency?: string;
                accountType?: 'CURRENT' | 'SAVINGS' | 'BUSINESS' | 'CREDIT';
                isActive?: boolean;
              }
            }) => ({
              url: `/bank/accounts/${accountId}`,
              method: 'PUT',
              body: updateData
            }),
            invalidatesTags: ['BankReconciliation', 'BankAccounts', 'BankTransactions']
          }),

          deactivateBankAccount: build.mutation<{ success: boolean }, { accountId: number }>({
            query: ({ accountId }) => ({
              url: `/bank/accounts/${accountId}/deactivate`,
              method: 'PUT'
            }),
            invalidatesTags: ['BankReconciliation', 'BankAccounts', 'BankTransactions']
          }),

          getBankTransactionsByAccount: build.query({
            query: ({ clientEin, accountId, status = 'all', page = 1, size = 25 }: {
              clientEin: string;
              accountId?: number;
              status?: 'all' | 'reconciled' | 'unreconciled';
              page?: number;
              size?: number;
            }) => {
              const params = new URLSearchParams({
                status,
                page: page.toString(),
                size: size.toString()
              });
              if (accountId) {
                params.append('accountId', accountId.toString());
              }
              return `/bank/${clientEin}/transactions/by-account?${params}`;
            },
            providesTags: ['BankTransactions']
          }),

          getConsolidatedAccountView: build.query({
            query: (clientEin: string) => `/bank/${clientEin}/accounts/consolidated-view`,
            providesTags: ['BankReconciliation']
          }),

          associateTransactionsWithAccounts: build.mutation({
          query: (clientEin: string) => ({
            url: `/bank/${clientEin}/accounts/associate-transactions`,
            method: 'POST'
          }),
          invalidatesTags: ['BankReconciliation', 'BankTransactions']
        }),

        // ==================== BANK ACCOUNT ANALYTIC MAPPINGS API HOOKS ====================
        getBankAccountAnalytics: build.query<any[], { clientEin: string }>({
          query: ({ clientEin }) => ({
            url: `/bank/${clientEin}/account-analytics`,
            method: 'GET'
          }),
          providesTags: ['BankAccountAnalytics']
        }),

        createBankAccountAnalytic: build.mutation<
          any,
          {
            clientEin: string;
            data: {
              iban: string;
              currency: string;
              syntheticCode: string;
              analyticSuffix: string;
              bankName?: string;
              accountAlias?: string;
            };
          }
        >({
          query: ({ clientEin, data }) => ({
            url: `/bank/${clientEin}/account-analytics`,
            method: 'POST',
            body: data
          }),
          invalidatesTags: ['BankAccountAnalytics', 'BankReconciliation']
        }),

        updateBankAccountAnalytic: build.mutation<
          any,
          {
            id: number;
            data: {
              currency?: string;
              syntheticCode?: string;
              analyticSuffix?: string;
              bankName?: string;
              accountAlias?: string;
            };
          }
        >({
          query: ({ id, data }) => ({
            url: `/bank/account-analytics/${id}`,
            method: 'PUT',
            body: data
          }),
          invalidatesTags: ['BankAccountAnalytics', 'BankReconciliation']
        }),

        deleteBankAccountAnalytic: build.mutation<{ id: number; deleted: true }, { id: number }>({
          query: ({ id }) => ({
            url: `/bank/account-analytics/${id}`,
            method: 'DELETE'
          }),
          invalidatesTags: ['BankAccountAnalytics', 'BankReconciliation']
        }),

        updateDocumentReconciliationStatus: build.mutation<
          { id: number; reconciliationStatus: string },
          { clientEin: string; documentId: number; status: 'IGNORED' | 'UNRECONCILED' }
        >({
          query: ({ clientEin, documentId, status }) => ({
            url: `/bank/${clientEin}/document/${documentId}/status`,
            method: 'PUT',
            body: { status }
          }),
          invalidatesTags: ['BankReconciliation', 'Files']
        }),

        // ==================== TODOS API ====================
        getTodos: build.query<
          { items: any[]; total: number },
          { clientEin: string; page?: number; size?: number; q?: string; status?: string; priority?: string; assigneeId?: number; assigneeIds?: number[]; dueFrom?: string; dueTo?: string; tags?: string[] }
        >({
          query: ({ clientEin, page = 1, size = 25, q = '', status = 'all', priority = 'all', assigneeId, assigneeIds, dueFrom, dueTo, tags }) => {
            const params = new URLSearchParams({ page: String(page), size: String(size), status, priority });
            if (q) params.append('q', q);
            // Prefer multi-assignee query param when provided; keep backward compatibility with assigneeId
            if (assigneeIds && assigneeIds.length) params.append('assigneeIds', assigneeIds.join(','));
            else if (assigneeId) params.append('assigneeId', String(assigneeId));
            if (dueFrom) params.append('dueFrom', dueFrom);
            if (dueTo) params.append('dueTo', dueTo);
            if (tags && tags.length) params.append('tags', tags.join(','));
            return `/todos/${clientEin}?${params.toString()}`;
          },
          providesTags: ['Todos']
        }),

        getTodo: build.query<any, { clientEin: string; id: number }>({
          query: ({ clientEin, id }) => `/todos/${clientEin}/${id}`,
          providesTags: ['Todos']
        }),

        createTodo: build.mutation<any, { clientEin: string; data: any }>({
          query: ({ clientEin, data }) => ({ url: `/todos/${clientEin}`, method: 'POST', body: data }),
          invalidatesTags: ['Todos']
        }),

        updateTodo: build.mutation<any, { clientEin: string; id: number; data: any }>({
          query: ({ clientEin, id, data }) => ({ url: `/todos/${clientEin}/${id}`, method: 'PUT', body: data }),
          invalidatesTags: ['Todos']
        }),

        deleteTodo: build.mutation<{ id: number; deleted: true }, { clientEin: string; id: number }>({
          query: ({ clientEin, id }) => ({ url: `/todos/${clientEin}/${id}`, method: 'DELETE' }),
          invalidatesTags: ['Todos']
        }),

        // Reorder todos (batch update of sortOrder)
        reorderTodos: build.mutation<
          { updated: number },
          { clientEin: string; items: Array<{ id: number; sortOrder: number }> }
        >({
          query: ({ clientEin, items }) => ({
            url: `/todos/${clientEin}/reorder`,
            method: 'PUT',
            body: { items }
          }),
          // Optimistically update Todos cache
          async onQueryStarted({ clientEin, items }, { dispatch, queryFulfilled, getState }) {
            // Build a list of patches for ALL cached getTodos queries that share this clientEin (any page/filters)
            const state: any = getState();
            const patches: Array<{ undo: () => void }> = [];
            try {
              const queries = state.finovaApi?.queries || {};
              const orderMap = new Map(items.map((i: any) => [i.id, i.sortOrder]));
              for (const key of Object.keys(queries)) {
                const entry = queries[key];
                if (entry?.endpointName === 'getTodos') {
                  const args = entry.originalArgs;
                  if (args && args.clientEin === clientEin) {
                    const patch = dispatch(
                      finovaApi.util.updateQueryData('getTodos', args, (draft: any) => {
                        if (!draft || !Array.isArray(draft.items)) return;
                        // Update sortOrder only for items included in the batch; leave others untouched
                        draft.items = draft.items.map((it: any) => ({
                          ...it,
                          sortOrder: orderMap.has(it.id) ? (orderMap.get(it.id) as number) : it.sortOrder,
                        }));
                        // Re-sort by sortOrder, pushing undefined to the end (consistent with UI)
                        draft.items.sort(
                          (a: any, b: any) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
                        );

                      }) as any
                    );
                    patches.push(patch);
                  }
                }
              }

              await queryFulfilled;
            } catch (e) {
              // Rollback all patches on error
              patches.forEach((p) => p.undo());
            }
          },
        }),

        // ==================== ACCOUNTING / LEDGER ====================
        getLedgerEntries: build.query<
          { items: any[]; total: number; page: number; size: number },
          { clientEin: string; startDate?: string; endDate?: string; accountCode?: string; page?: number; size?: number }
        >({
          query: ({ clientEin, startDate, endDate, accountCode, page = 1, size = 50 }) => {
            const params = new URLSearchParams({ page: String(page), size: String(size) });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (accountCode) params.append('accountCode', accountCode);
            return `/accounting/${clientEin}/ledger?${params.toString()}`;
          },
        }),

        // ==================== CHAT API ====================
        sendChatMessage: build.mutation<
          { reply: string },
          { clientEin: string; message: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> }
        >({
          query: ({ clientEin, message, history }) => ({
            url: `/chat/${clientEin}/message`,
            method: 'POST',
            body: { message, history: history || [] },
          }),
        }),

      }),
  });

export const {
  useLoginMutation,
  useSignupMutation,
  useExtractDataMutation,
  useGetInvoicePaymentsQuery,
  useSaveFileAndExtractedDataMutation,
  useGetClientCompaniesMutation,
  useCreateClientCompanyMutation,
  useGetUserDataQuery,
  useGetRelatedDocumentsQuery,
  useUpdateDocumentReferencesMutation,
  useDeleteClientCompanyMutation,
  useDeleteUserAccountMutation,
  useModifyUserAccountMutation,
  useModifyUserPasswordMutation,
  useGetFilesQuery,
  useUpdateFileAndExtractedDataMutation,
  useDeleteFileAndExtractedDataMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useInsertClientInvoiceMutation,
  useGetManagementQuery,
  useSaveNewManagementMutation,
  useGetArticlesQuery,
  useGetCompanyDataQuery,
  useDeleteManagementMutation,
  useDeleteArticleMutation,
  useGetJobStatusQuery,
  useGetUserAgreementsQuery,
  useUpdateUserConsentMutation,
  useModifyRpaCredentialsMutation,
  useGetRpaDataQuery,
  useGetDuplicateAlertsQuery,
  useGetComplianceAlertsQuery,
  useUpdateDuplicateStatusMutation,
  useGetServiceHealthQuery,
  useProcessBatchMutation,
  useGetSomeFilesMutation,
  useGetBankReconciliationStatsQuery,
  useGetFinancialDocumentsQuery,
  useGetBankTransactionsQuery,
  useGetReconciliationSuggestionsQuery,
  useCreateManualMatchMutation,
  useCreateBulkMatchesMutation,
  useCreateManualAccountReconciliationMutation,
  useAcceptReconciliationSuggestionMutation,
  useRejectReconciliationSuggestionMutation,
  useGetBalanceReconciliationStatementQuery,
  useUnreconcileTransactionMutation,
  useUnreconcileDocumentMutation,
  useRegenerateAllSuggestionsMutation,
  useRegenerateTransactionSuggestionsMutation,
  useGetReconciliationSummaryReportQuery,
  useGetAccountAttributionReportQuery,
  useGetExceptionReportQuery,
  useGetBankReconciliationSummaryReportQuery,
  useGetOutstandingItemsQuery,
  useGetOutstandingItemsAgingQuery,
  useCreateOutstandingItemMutation,
  useUpdateOutstandingItemMutation,
  useMarkOutstandingItemAsClearedMutation,
  useMarkOutstandingItemAsStaleMutation,
  useVoidOutstandingItemMutation,
  useDeleteOutstandingItemMutation,
  useGetReconciliationHistoryAndAuditTrailQuery,
  useGetBankAccountsQuery,
  useCreateBankAccountMutation,
  useUpdateBankAccountMutation,
  useGetBankTransactionsByAccountQuery,
  useGetConsolidatedAccountViewQuery,
  useAssociateTransactionsWithAccountsMutation,
  useDeactivateBankAccountMutation,
  useGetBankAccountAnalyticsQuery,
  useCreateBankAccountAnalyticMutation,
  useUpdateBankAccountAnalyticMutation,
  useDeleteBankAccountAnalyticMutation,
  useUpdateDocumentReconciliationStatusMutation,
  useGetTransactionSplitsQuery,
  useSetTransactionSplitsMutation,
  useSuggestTransactionSplitsMutation,
  useDeleteTransactionSplitMutation,
  useGetTransferReconciliationCandidatesQuery,
  useCreateTransferReconciliationMutation,
  useGetPendingTransferReconciliationsQuery,
  useDeleteTransferReconciliationMutation,
  useGetTransferReconciliationCandidatesForTransactionQuery,
  useGetTodosQuery,
  useGetTodoQuery,
  useCreateTodoMutation,
  useUpdateTodoMutation,
  useDeleteTodoMutation,
  useReorderTodosMutation,
  useGetCompanyUsersQuery,
  useSendChatMessageMutation,
  useGetLedgerEntriesQuery,
} = finovaApi;