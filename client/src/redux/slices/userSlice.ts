import { createSlice } from "@reduxjs/toolkit";

const lang = localStorage.getItem('language')||'en';

const initialState = {
  user: '',
  language: lang,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setCurrentLanguage: (state, action) => {
        const newLanguage = action.payload;
        state.language = newLanguage;
        localStorage.setItem('language', newLanguage);
    }
  }
});

export const { setCurrentLanguage } = userSlice.actions;
export default userSlice.reducer;