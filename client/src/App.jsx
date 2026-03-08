import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import TemplatePage from './pages/TemplatePage';
import ContractFormPage from './pages/ContractFormPage';
import SignaturePage from './pages/SignaturePage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsuariosPage from './pages/AdminUsuariosPage';
import AdminUsuarioDetallePage from './pages/AdminUsuarioDetallePage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/plantilla/nueva" element={<TemplatePage />} />
                <Route path="/plantilla/editar/:idPlantilla" element={<TemplatePage />} />
                <Route path="/contrato/nuevo/:idPlantilla" element={<ContractFormPage />} />
                <Route path="/firmar/:idContrato" element={<SignaturePage />} />
                <Route path="/perfil" element={<ProfilePage />} />
                {/* Admin routes — each page self-guards with 403 redirect */}
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
                <Route path="/admin/usuarios/:id" element={<AdminUsuarioDetallePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
