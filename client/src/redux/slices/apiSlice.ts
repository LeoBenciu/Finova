import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'

export const finovaApi = createApi({
    reducerPath: 'finovaApi',
    baseQuery: fetchBaseQuery({
        baseUrl: import.meta.env.REACT_APP_BASE_URL || 'http://localhost:3000',
        prepareHeaders: (headers)=>{
            headers.set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYmVuY2l1bGVvbmFyZG9AZ21haWwuY29tIiwiaWF0IjoxNzQxMDk1NTQ0LCJleHAiOjE3NDExMDI3NDR9.RkXfK8mc0BdYVWAA-drIisN_-et47gb3x4etXRavlM4');

            return headers;
        }
    }),
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
    })
})

export const {useLoginMutation, useSignupMutation, useExtractDataMutation} = finovaApi;
