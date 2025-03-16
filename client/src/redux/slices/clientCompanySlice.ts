import { createSlice } from "@reduxjs/toolkit";
const clientCompanyName = localStorage.getItem('ClientCompanyName')||'';
const clientCompanyEin = localStorage.getItem('ClientCompanyEin')||'';

const initialState = {
    current: {
        name: clientCompanyName,
        ein: clientCompanyEin
    }
};

const clientCompanySlice = createSlice({
    name: 'clientCompany',
    initialState,
    reducers:{
        setCurrentCompany:(state,action)=>{
            state.current.name = action.payload.name;
            state.current.ein = action.payload.ein;
            localStorage.setItem('ClientCompanyName', action.payload.name);
            localStorage.setItem('ClientCompanyEin',action.payload.ein)
        }
    }
});

export const {setCurrentCompany} = clientCompanySlice.actions;
export default clientCompanySlice.reducer;