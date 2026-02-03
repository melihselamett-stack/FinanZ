import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/company', label: 'Şirket Ayarları', icon: '🏢' },
    { to: '/account-plan', label: 'Hesap Planı', icon: '📋' },
    { to: '/mizan', label: 'Mizan Yükle', icon: '📁' },
    { to: '/consolidated-mizan', label: 'Konsolide Mizan', icon: '📈' },
    { to: '/bilanco-raporlari', label: 'Bilanço Raporları', icon: '📑' },
    { to: '/gelir-tablosu-raporlari', label: 'Gelir Tablosu Raporları', icon: '💰' },
    { to: '/gelir-raporlari', label: 'Gelir Raporları', icon: '📈' },
    { to: '/gider-raporlari', label: 'Gider Raporları', icon: '📊' },
  ]

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - Fixed */}
      <aside className="w-64 h-screen bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-yellow-400 bg-clip-text text-transparent">
            FinansAnaliz
          </h1>
        </div>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                  isActive
                    ? 'bg-green-500/20 text-green-400 border-l-2 border-green-500'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        <div className="p-3 border-t border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center text-white text-sm font-medium">
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>🚪</span>
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content - Scrollable */}
      <main className="flex-1 bg-gray-950 overflow-y-auto h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
