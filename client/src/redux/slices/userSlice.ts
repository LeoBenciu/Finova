import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    user: '',
    language: 'en'
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers:{
        setCurrentLanguage:(state,action)=>{
            state.language = action.payload;
        }
    }
});

export const {setCurrentLanguage} = userSlice.actions;
export default userSlice.reducer;