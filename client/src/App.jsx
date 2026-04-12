import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RecoverPasswordPage from './pages/RecoverPasswordPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import TemplatePage from './pages/TemplatePage';
import ContractFormPage from './pages/ContractFormPage';
import ContractEditPage from './pages/ContractEditPage';
import SignaturePage from './pages/SignaturePage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsuariosPage from './pages/AdminUsuariosPage';
import AdminUsuarioDetallePage from './pages/AdminUsuarioDetallePage';
import NotFoundPage from './pages/NotFoundPage';
import TerminosPage from './pages/TerminosPage';
import PrivacidadPage from './pages/PrivacidadPage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/recover" element={<RecoverPasswordPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/plantilla/nueva" element={<TemplatePage />} />
                <Route path="/plantilla/editar/:idPlantilla" element={<TemplatePage />} />
                <Route path="/contrato/nuevo/:idPlantilla" element={<ContractFormPage />} />
                <Route path="/contrato/editar/:idContrato" element={<ContractEditPage />} />
                <Route path="/firmar/:idContrato" element={<SignaturePage />} />
                <Route path="/perfil" element={<ProfilePage />} />
                {/* Admin routes — each page self-guards with 403 redirect */}
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
                <Route path="/admin/usuarios/:id" element={<AdminUsuarioDetallePage />} />
                <Route path="/terminos" element={<TerminosPage />} />
                <Route path="/privacidad" element={<PrivacidadPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
