import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { companyApi, Company } from '../services/api'

export default function Dashboard() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      const response = await companyApi.getAll()
      setCompanies(response.data)
    } catch (error) {
      console.error('Şirketler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Hoş Geldiniz, {user?.fullName}</h1>
          <p className="text-gray-400 mt-1">Mali analiz platformunuza genel bakış</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <span className="text-xl">🏢</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">Şirketler</p>
              <p className="text-2xl font-bold text-white">{companies.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-500/20 flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">Abonelik Durumu</p>
              <p className="text-lg font-bold text-white">
                {user?.hasSubscription ? 'Aktif' : 'Pasif'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-xl">📁</span>
            </div>
            <div>
              <p className="text-sm text-gray-400">Paket</p>
              <p className="text-lg font-bold text-white">Temel Paket</p>
            </div>
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Şirketleriniz</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Henüz şirket eklemediniz</p>
            <a href="/company" className="btn-primary inline-block">
              Şirket Ekle
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div>
                  <p className="font-medium text-white">{company.companyName}</p>
                  <p className="text-sm text-gray-400">VKN: {company.taxNumber}</p>
                </div>
                <div className="text-sm text-gray-500">
                  Ayraç: {company.accountCodeSeparator || '.'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="/mizan" className="card hover:border-primary-500/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              📁
            </div>
            <div>
              <p className="font-medium text-white">Mizan Yükle</p>
              <p className="text-sm text-gray-400">Excel dosyanızı yükleyin</p>
            </div>
          </div>
        </a>
        
        <a href="/account-plan" className="card hover:border-accent-500/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              📋
            </div>
            <div>
              <p className="font-medium text-white">Hesap Planı</p>
              <p className="text-sm text-gray-400">Hesap planınızı görüntüleyin</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}

