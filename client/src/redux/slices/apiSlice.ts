import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'

export const finovaApi = createApi({
    reducerPath: 'finovaApi',
    baseQuery: fetchBaseQuery({
        baseUrl: import.meta.env.REACT_APP_BASE_URL || 'http://localhost:3000',
        prepareHeaders: (headers)=>{
            headers.set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYmVuY2l1bGVvbmFyZG9AZ21haWwuY29tIiwiaWF0IjoxNzQxMDA3MDkzLCJleHAiOjE3NDEwMTQyOTN9.bxaimlUSnDliwBBPxecNd9sEcRxfaqLq-osPcsuiu0c');

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
