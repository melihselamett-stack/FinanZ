import { useEffect, useState } from 'react'
import { companyApi, Company } from '../services/api'

export default function CompanySettings() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    companyName: '',
    taxNumber: '',
    accountCodeSeparator: '.'
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  const resetForm = () => {
    setFormData({ companyName: '', taxNumber: '', accountCodeSeparator: '.' })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const handleEdit = (company: Company) => {
    setFormData({
      companyName: company.companyName,
      taxNumber: company.taxNumber,
      accountCodeSeparator: company.accountCodeSeparator
    })
    setEditingId(company.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (editingId) {
        await companyApi.update(editingId, formData)
      } else {
        await companyApi.create(formData)
      }
      await loadCompanies()
      resetForm()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'İşlem başarısız'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bu şirketi silmek istediğinizden emin misiniz?')) return

    try {
      await companyApi.delete(id)
      await loadCompanies()
    } catch (error) {
      console.error('Silme hatası:', error)
    }
  }

  const separatorOptions = [
    { value: '.', label: 'Nokta (.)' },
    { value: '-', label: 'Tire (-)' },
    { value: ' ', label: 'Boşluk' },
    { value: '/', label: 'Eğik Çizgi (/)' }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Şirket Ayarları</h1>
          <p className="text-gray-400 mt-1">Şirketlerinizi yönetin</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          + Yeni Şirket
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingId ? 'Şirketi Düzenle' : 'Yeni Şirket Ekle'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Şirket Adı</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="input-field"
                  placeholder="ABC Ltd. Şti."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vergi Numarası</label>
                <input
                  type="text"
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  className="input-field"
                  placeholder="1234567890"
                  maxLength={11}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Hesap Planı Ayracı</label>
                <select
                  value={formData.accountCodeSeparator}
                  onChange={(e) => setFormData({ ...formData, accountCodeSeparator: e.target.value })}
                  className="input-field"
                >
                  {separatorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hesap kodlarındaki ayraç karakteri (örn: 102.10.001)
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 btn-secondary"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Companies List */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Henüz şirket eklemediniz</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                  <th className="pb-3">Şirket Adı</th>
                  <th className="pb-3">Vergi No</th>
                  <th className="pb-3">Ayraç</th>
                  <th className="pb-3">Kayıt Tarihi</th>
                  <th className="pb-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-gray-800">
                    <td className="py-3 font-medium text-white">{company.companyName}</td>
                    <td className="py-3 text-gray-300">{company.taxNumber}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs">
                        {company.accountCodeSeparator || '.'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">
                      {new Date(company.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleEdit(company)}
                        className="text-primary-400 hover:text-primary-300 mr-3"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(company.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

