import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    current: {
        name: '',
        ein: '9324593'
    }
};

const clientCompanySlice = createSlice({
    name: 'clientCompany',
    initialState,
    reducers:{
        setCurrentCompany:(state,action)=>{
            state.current.name = action.payload.name;
            state.current.ein = action.payload.ein;
        }
    }
});

export const {setCurrentCompany} = clientCompanySlice.actions;
export default clientCompanySlice.reducer;