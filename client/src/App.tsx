import './App.css'
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import MainPage from './app/Pages/Main/page';
import HomePage from './app/Pages/HomePage';
import AuthenticationPage from './app/Pages/AuthenticationPage';
import FileUploadPage from './app/Pages/FileUploadPage';
import FileManagementPage from './app/Pages/FileManagementPage';
import SettingsPage from './app/Pages/SettingsPage';
import ReportsPage from './app/Pages/ReportsPage';
import ResetPasswordPage from './app/Pages/ResetPasswordPage';
import TermsOfServicePage from './app/Pages/TermsOfServicePage';
import CookiesPolicyPage from './app/Pages/CookiesPolicyPage';
import PrivacyPolicyPage from './app/Pages/PrivacyPolicyPage';
import DataProcessingAgreementPage from './app/Pages/DataProcessingAgreementPage';
import ClientsPage from './app/Pages/ClientsPage';
import BankPage from './app/Pages/BankPage';

function App() {
  return (
   <div>
    <BrowserRouter>
      <Routes>
        <Route path='/authentication' element={<AuthenticationPage/>}/>
        <Route path='/terms-of-service' element={<TermsOfServicePage/>}/>
        <Route path='/data-processing-agreement' element={<DataProcessingAgreementPage/>}/>
        <Route path='/cookies-policy' element={<CookiesPolicyPage/>}/>
        <Route path='/privacy-policy' element={<PrivacyPolicyPage/>}/>
        <Route path='/reset-password' element={<ResetPasswordPage/>}/>
        <Route path='/' element={<MainPage/>}>
          <Route path='/home' element={<HomePage/>}></Route>
          <Route path='/file-upload' element={<FileUploadPage/>}></Route>
          <Route path='/file-management' element={<FileManagementPage/>}></Route>
          <Route path='/reports' element={<ReportsPage/>}></Route>
          <Route path='/settings' element={<SettingsPage/>}></Route>
          <Route path='/clients' element={<ClientsPage/>}></Route>
          <Route path='/bank' element={<BankPage/>}></Route>
        </Route>
      </Routes>
    </BrowserRouter>
   </div>
  )
}

export default App
