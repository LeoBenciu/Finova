import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'

export const finovaApi = createApi({
    reducerPath: 'finovaApi',
    baseQuery: fetchBaseQuery({
        baseUrl: import.meta.env.REACT_APP_BASE_URL || 'http://localhost:3000',
        prepareHeaders: (headers)=>{
            headers.set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYmVuY2l1bGVvbmFyZG81NUBnbWFpbC5jb20iLCJpYXQiOjE3NDE1MjI2OTAsImV4cCI6MTc0MTUyOTg5MH0.jrhOsvnrIvqSPkR9uVwrFmmzHgEx3g1tNYshrpeTlOc');

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
