import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BriefForm } from './pages/BriefForm';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BriefDetail } from './pages/BriefDetail';
import { AdminLayout } from './components/AdminLayout';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BriefForm />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="briefs/:id" element={<BriefDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
