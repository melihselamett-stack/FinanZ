import { useEffect, useState } from 'react'
import { companyApi, bilancoParameterApi, Company, BilancoParameter } from '../services/api'

export default function BilancoParametreAyarlari() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [parameters, setParameters] = useState<BilancoParameter[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingParam, setEditingParam] = useState<BilancoParameter | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (selectedCompanyId) {
      const company = companies.find(c => c.id === selectedCompanyId)
      setSelectedCompany(company || null)
      loadParameters(selectedCompanyId)
    }
  }, [selectedCompanyId, companies])

  const loadCompanies = async () => {
    try {
      const response = await companyApi.getAll()
      setCompanies(response.data)
      if (response.data.length > 0) {
        setSelectedCompanyId(response.data[0].id)
      }
    } catch (error) {
      console.error('Şirketler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadParameters = async (companyId: number) => {
    setDataLoading(true)
    setError(null)
    try {
      const response = await bilancoParameterApi.getParameters(companyId)
      setParameters(response.data)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Parametreler yüklenirken bir hata oluştu'
      setError(errorMessage)
      console.error('Parametreler yüklenirken hata:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedCompanyId) return

    setSaving(true)
    setError(null)
    try {
      await bilancoParameterApi.updateParameters(selectedCompanyId, parameters)
      setEditingParam(null)
      alert('Parametreler başarıyla kaydedildi!')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Parametreler kaydedilirken bir hata oluştu'
      setError(errorMessage)
      console.error('Parametreler kaydedilirken hata:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!selectedCompanyId) return
    if (!confirm('Tüm parametreler varsayılan değerlere sıfırlanacak. Devam etmek istiyor musunuz?')) return

    setSaving(true)
    setError(null)
    try {
      await bilancoParameterApi.resetToDefaults(selectedCompanyId)
      await loadParameters(selectedCompanyId)
      alert('Parametreler varsayılan değerlere sıfırlandı!')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Parametreler sıfırlanırken bir hata oluştu'
      setError(errorMessage)
      console.error('Parametreler sıfırlanırken hata:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (param: BilancoParameter) => {
    setEditingParam({ ...param })
    setShowAddForm(false)
  }

  const handleAdd = () => {
    setEditingParam({
      NotCode: '',
      Section: 'Varliklar',
      AccountName: '',
      DisplayOrder: parameters.length + 1,
      AccountCodePrefixes: []
    })
    setShowAddForm(true)
  }

  const handleDelete = (notCode: string, section: string) => {
    if (!confirm('Bu parametreyi silmek istediğinizden emin misiniz?')) return
    setParameters(prev => prev.filter(p => !(p.NotCode === notCode && p.Section === section)))
  }

  const handleSaveEdit = () => {
    if (!editingParam) return

    if (!editingParam.NotCode || !editingParam.AccountName) {
      setError('NOT kodu ve Hesap Adı zorunludur')
      return
    }

    const existingIndex = parameters.findIndex(
      p => p.NotCode === editingParam.NotCode && p.Section === editingParam.Section
    )

    if (existingIndex >= 0) {
      // Güncelle
      setParameters(prev => {
        const updated = [...prev]
        updated[existingIndex] = editingParam
        return updated
      })
    } else {
      // Yeni ekle
      setParameters(prev => [...prev, editingParam])
    }

    setEditingParam(null)
    setShowAddForm(false)
  }

  const handleAddPrefix = (prefix: string) => {
    if (!editingParam || !prefix.trim()) return
    if (editingParam.AccountCodePrefixes.includes(prefix.trim())) return

    setEditingParam({
      ...editingParam,
      AccountCodePrefixes: [...editingParam.AccountCodePrefixes, prefix.trim()]
    })
  }

  const handleRemovePrefix = (prefix: string) => {
    if (!editingParam) return
    setEditingParam({
      ...editingParam,
      AccountCodePrefixes: editingParam.AccountCodePrefixes.filter(p => p !== prefix)
    })
  }

  const varliklarParams = parameters.filter(p => p.Section === 'Varliklar').sort((a, b) => a.DisplayOrder - b.DisplayOrder)
  const kaynaklarParams = parameters.filter(p => p.Section === 'Kaynaklar').sort((a, b) => a.DisplayOrder - b.DisplayOrder)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Önce bir şirket eklemeniz gerekiyor</p>
        <a href="/company" className="btn-primary inline-block">Şirket Ekle</a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bilanço Parametre Ayarları</h1>
          <p className="text-gray-400 mt-1">Bilanço raporlarındaki hesap adlarını ve NOT kodlarını düzenleyin</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedCompanyId || ''}
            onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
            className="input-field w-auto"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            className="btn-secondary"
          >
            ➕ Yeni Parametre
          </button>
          <button
            onClick={handleReset}
            className="btn-secondary"
          >
            🔄 Varsayılanlara Sıfırla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card bg-red-500/10 border border-red-500/20 text-red-400 text-center py-4">
          {error}
        </div>
      )}

      {dataLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* VARLIKLAR Bölümü */}
          <div className="card">
            <h2 className="text-xl font-bold text-white mb-4">VARLIKLAR</h2>
            <div className="space-y-2">
              {varliklarParams.map((param, index) => (
                <div key={`${param.NotCode}-${param.Section}`} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded border border-gray-700">
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <span className="text-primary-400 font-bold">NOT: {param.NotCode}</span>
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={param.AccountName}
                        onChange={(e) => {
                          const updated = [...parameters]
                          const idx = updated.findIndex(p => p.NotCode === param.NotCode && p.Section === param.Section)
                          if (idx >= 0) {
                            updated[idx] = { ...updated[idx], AccountName: e.target.value }
                            setParameters(updated)
                          }
                        }}
                        className="input-field text-sm"
                        placeholder="Hesap Adı"
                      />
                    </div>
                    <div className="col-span-5">
                      <div className="flex flex-wrap gap-2">
                        {param.AccountCodePrefixes.map(prefix => (
                          <span key={prefix} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                            {prefix}
                            <button
                              onClick={() => {
                                const updated = [...parameters]
                                const idx = updated.findIndex(p => p.NotCode === param.NotCode && p.Section === param.Section)
                                if (idx >= 0) {
                                  updated[idx] = {
                                    ...updated[idx],
                                    AccountCodePrefixes: updated[idx].AccountCodePrefixes.filter(p => p !== prefix)
                                  }
                                  setParameters(updated)
                                }
                              }}
                              className="ml-2 text-red-400 hover:text-red-300"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="Hesap kodu ekle (örn: 100)"
                          className="input-field text-xs w-24"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.currentTarget as HTMLInputElement
                              if (input.value.trim()) {
                                const updated = [...parameters]
                                const idx = updated.findIndex(p => p.NotCode === param.NotCode && p.Section === param.Section)
                                if (idx >= 0 && !updated[idx].AccountCodePrefixes.includes(input.value.trim())) {
                                  updated[idx] = {
                                    ...updated[idx],
                                    AccountCodePrefixes: [...updated[idx].AccountCodePrefixes, input.value.trim()]
                                  }
                                  setParameters(updated)
                                  input.value = ''
                                }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={() => handleEdit(param)}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        ✏️ Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(param.NotCode, param.Section)}
                        className="btn-secondary text-xs px-2 py-1 text-red-400"
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KAYNAKLAR Bölümü */}
          <div className="card">
            <h2 className="text-xl font-bold text-white mb-4">KAYNAKLAR</h2>
            <div className="space-y-2">
              {kaynaklarParams.map((param, index) => (
                <div key={`${param.NotCode}-${param.Section}`} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded border border-gray-700">
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <span className="text-primary-400 font-bold">NOT: {param.NotCode}</span>
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={param.AccountName}
                        onChange={(e) => {
                          const updated = [...parameters]
                          const idx = updated.findIndex(p => p.NotCode === param.NotCode && p.Section === param.Section)
                          if (idx >= 0) {
                            updated[idx] = { ...updated[idx], AccountName: e.target.value }
                            setParameters(updated)
                          }
                        }}
                        className="input-field text-sm"
                        placeholder="Hesap Adı"
                      />
                    </div>
                    <div className="col-span-5">
                      <div className="flex flex-wrap gap-2">
                        {param.AccountCodePrefixes.map(prefix => (
                          <span key={prefix} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                            {prefix}
                            <button
                              onClick={() => {
                                const updated = [...parameters]
                                const idx = updated.findIndex(p => p.NotCode === param.NotCode && p.Section === param.Section)
                                if (idx >= 0) {
                                  updated[idx] = {
                                    ...updated[idx],
                                    AccountCodePrefixes: updated[idx].AccountCodePrefixes.filter(p => p !== prefix)
                                  }
                                  setParameters(updated)
                                }
                              }}
                              className="ml-2 text-red-400 hover:text-red-300"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="Hesap kodu ekle (örn: 500)"
                          className="input-field text-xs w-24"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.currentTarget as HTMLInputElement
                              if (input.value.trim()) {
                                const updated = [...parameters]
                                const idx = updated.findIndex(p => p.NotCode === param.NotCode && p.Section === param.Section)
                                if (idx >= 0 && !updated[idx].AccountCodePrefixes.includes(input.value.trim())) {
                                  updated[idx] = {
                                    ...updated[idx],
                                    AccountCodePrefixes: [...updated[idx].AccountCodePrefixes, input.value.trim()]
                                  }
                                  setParameters(updated)
                                  input.value = ''
                                }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={() => handleEdit(param)}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        ✏️ Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(param.NotCode, param.Section)}
                        className="btn-secondary text-xs px-2 py-1 text-red-400"
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yeni Parametre Ekleme Formu */}
          {showAddForm && editingParam && (
            <div className="card border-2 border-primary-500">
              <h3 className="text-lg font-bold text-white mb-4">Yeni Parametre Ekle</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">NOT Kodu</label>
                    <input
                      type="text"
                      value={editingParam.NotCode}
                      onChange={(e) => setEditingParam({ ...editingParam, NotCode: e.target.value })}
                      className="input-field"
                      placeholder="örn: 10, 22, 50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bölüm</label>
                    <select
                      value={editingParam.Section}
                      onChange={(e) => setEditingParam({ ...editingParam, Section: e.target.value })}
                      className="input-field"
                    >
                      <option value="Varliklar">Varliklar</option>
                      <option value="Kaynaklar">Kaynaklar</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hesap Adı</label>
                  <input
                    type="text"
                    value={editingParam.AccountName}
                    onChange={(e) => setEditingParam({ ...editingParam, AccountName: e.target.value })}
                    className="input-field"
                    placeholder="örn: Nakit Ve Nakit Benzerleri"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hesap Kodları (Enter ile ekle)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editingParam.AccountCodePrefixes.map(prefix => (
                      <span key={prefix} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                        {prefix}
                        <button
                          onClick={() => handleRemovePrefix(prefix)}
                          className="ml-2 text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Hesap kodu ekle (örn: 100) ve Enter'a bas"
                    className="input-field"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget as HTMLInputElement
                        if (input.value.trim()) {
                          handleAddPrefix(input.value.trim())
                          input.value = ''
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="btn-primary">
                    💾 Kaydet
                  </button>
                  <button
                    onClick={() => {
                      setEditingParam(null)
                      setShowAddForm(false)
                    }}
                    className="btn-secondary"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
