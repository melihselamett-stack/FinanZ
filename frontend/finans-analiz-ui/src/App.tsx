import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CompanySettings from './pages/CompanySettings'
import AccountPlan from './pages/AccountPlan'
import MizanUpload from './pages/MizanUpload'
import ConsolidatedMizan from './pages/ConsolidatedMizan'
import BilancoRaporlari from './pages/BilancoRaporlari'
import BilancoParametreAyarlari from './pages/BilancoParametreAyarlari'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="company" element={<CompanySettings />} />
        <Route path="account-plan" element={<AccountPlan />} />
        <Route path="mizan" element={<MizanUpload />} />
        <Route path="consolidated-mizan" element={<ConsolidatedMizan />} />
        <Route path="bilanco-raporlari" element={<BilancoRaporlari />} />
        <Route path="bilanco-parametre-ayarlari" element={<BilancoParametreAyarlari />} />
      </Route>
    </Routes>
  )
}

export default App

