import {combineReducers, configureStore} from '@reduxjs/toolkit'
import userSlice from '@/redux/slices/userSlice'
import { finovaApi } from './slices/apiSlice';

const rootReducer = combineReducers({
    user: userSlice,
    [finovaApi.reducerPath]: finovaApi.reducer,
});

export const store = configureStore({
    reducer: rootReducer,

    middleware:(getDefaultMiddleware) =>
        getDefaultMiddleware().concat(finovaApi.middleware),
});
