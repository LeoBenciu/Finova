import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'
import { logout } from '@/app/helper/authHelpers';


const baseQuery = fetchBaseQuery({
    baseUrl: import.meta.env.REACT_APP_BASE_URL || 'http://localhost:3000',
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
            query:(file)=>{
                const formData: FormData = new FormData();
                formData.append('file', file);

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
            }
        }),

        updateFileAndExtractedData: build.mutation({
            query:({processedData,clientCompanyEin,docId})=>{
                const formData: FormData = new FormData();
                formData.append('clientCompanyEin', clientCompanyEin);
                formData.append('processedData',JSON.stringify(processedData));
                formData.append('documentId',docId);

                return{
                    url:`/files`,
                    method:'PUT',
                    body: {
                        clientCompanyEin,
                        processedData: JSON.stringify(processedData),
                        docId
                    },
                    formData: true
                }
            }
        }),

        deleteFileAndExtractedData: build.mutation({
            query:({docId, clientCompanyEin})=>({
                url:`/files`,
                method:'DELETE',
                body:{
                    clientCompanyEin,
                    docId
                }})
        }),

        getClientCompanies: build.mutation({
            query:()=>({
                url:'/client-companies',
                method:'GET',
            })
        }),

        createClientCompany: build.mutation({
            query:(ein)=>({
                url:'/client-companies',
                method:'POST',
                body:{
                    ein
                }    
            })
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

        getFiles: build.query({
            query:({company})=>({
                url:`/files/${company}`,
                method:'GET'
            })
        }),

    })
})

export const {useLoginMutation, useSignupMutation, useExtractDataMutation, 
    useSaveFileAndExtractedDataMutation, useGetClientCompaniesMutation,
useCreateClientCompanyMutation,useGetUserDataQuery,
useDeleteClientCompanyMutation, useDeleteUserAccountMutation,
useModifyUserAccountMutation,useModifyUserPasswordMutation,
useGetFilesQuery, useUpdateFileAndExtractedDataMutation,
useDeleteFileAndExtractedDataMutation} = finovaApi;
