import './App.css'
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import MainPage from './app/Pages/Main/page';
import HomePage from './app/Pages/HomePage';
import AuthenticationPage from './app/Pages/AuthenticationPage';

function App() {
  return (
   <div>
    <BrowserRouter>
      <Routes>
        <Route path='/authentication' element={<AuthenticationPage/>}/>
        <Route path='/' element={<MainPage/>}>
          <Route path='/home' element={<HomePage/>}></Route>
        </Route>
      </Routes>
    </BrowserRouter>
   </div>
  )
}

export default App
