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

function App() {
  return (
   <div>
    <BrowserRouter>
      <Routes>
        <Route path='/authentication' element={<AuthenticationPage/>}/>
        <Route path='/reset-password' element={<ResetPasswordPage/>}/>
        <Route path='/' element={<MainPage/>}>
          <Route path='/home' element={<HomePage/>}></Route>
          <Route path='/file-upload' element={<FileUploadPage/>}></Route>
          <Route path='/file-management' element={<FileManagementPage/>}></Route>
          <Route path='/reports' element={<ReportsPage/>}></Route>
          <Route path='/settings' element={<SettingsPage/>}></Route>
        </Route>
      </Routes>
    </BrowserRouter>
   </div>
  )
}

export default App
