import { useEffect, useState } from 'react'
import { companyApi, accountPlanApi, mizanApi, Company, AccountPlanItem, PropertyOption } from '../services/api'

interface Period {
  year: number
  month: number
}

interface BalanceItem {
  id: number
  accountCode: string
  accountName: string
  debit: number
  credit: number
  debitBalance: number
  creditBalance: number
  property1?: string
  property2?: string
  property3?: string
  property4?: string
  property5?: string
  isLeaf: boolean
}

export default function AccountPlan() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null)
  const [accounts, setAccounts] = useState<AccountPlanItem[]>([])
  const [balances, setBalances] = useState<BalanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [periodsLoading, setPeriodsLoading] = useState(false)
  const [showPropertyPanel, setShowPropertyPanel] = useState(false)
  const [propertyNames, setPropertyNames] = useState<string[]>(['', '', '', '', ''])
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([])
  const [newOptionValues, setNewOptionValues] = useState<string[]>(['', '', '', '', ''])
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'all' | 'period'>('all')

  // Sütun filtreleri
  const [filters, setFilters] = useState({
    accountCode: '',
    accountName: '',
    level: '',
    property1: '',
    property2: '',
    property3: '',
    property4: '',
    property5: '',
  })

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (selectedCompanyId) {
      loadAccounts(selectedCompanyId)
      loadPropertyOptions(selectedCompanyId)
      loadPeriods(selectedCompanyId)
      const company = companies.find(c => c.id === selectedCompanyId)
      setSelectedCompany(company || null)
      if (company) {
        setPropertyNames([
          company.propertyName1 || '',
          company.propertyName2 || '',
          company.propertyName3 || '',
          company.propertyName4 || '',
          company.propertyName5 || ''
        ])
      }
    }
  }, [selectedCompanyId, companies])

  useEffect(() => {
    if (selectedCompanyId && selectedPeriod && viewMode === 'period') {
      loadBalances(selectedCompanyId, selectedPeriod.year, selectedPeriod.month)
    }
  }, [selectedCompanyId, selectedPeriod, viewMode])

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

  const loadAccounts = async (companyId: number) => {
    setAccountsLoading(true)
    try {
      const response = await accountPlanApi.getByCompany(companyId)
      setAccounts(response.data)
    } catch (error) {
      console.error('Hesap planı yüklenirken hata:', error)
    } finally {
      setAccountsLoading(false)
    }
  }

  const loadPropertyOptions = async (companyId: number) => {
    try {
      const response = await companyApi.getPropertyOptions(companyId)
      setPropertyOptions(response.data)
    } catch (error) {
      console.error('Özellik seçenekleri yüklenirken hata:', error)
    }
  }

  const loadPeriods = async (companyId: number) => {
    setPeriodsLoading(true)
    try {
      const response = await mizanApi.getPeriods(companyId)
      const loadedPeriods = response.data
      setPeriods(loadedPeriods)
      if (loadedPeriods.length > 0 && !selectedPeriod) {
        setSelectedPeriod(loadedPeriods[0])
        setViewMode('period')
      }
    } catch (error) {
      console.error('Dönemler yüklenirken hata:', error)
    } finally {
      setPeriodsLoading(false)
    }
  }

  const loadBalances = async (companyId: number, year: number, month: number) => {
    setAccountsLoading(true)
    try {
      const response = await mizanApi.getBalances(companyId, year, month)
      setBalances(response.data as BalanceItem[])
    } catch (error) {
      console.error('Bakiyeler yüklenirken hata:', error)
    } finally {
      setAccountsLoading(false)
    }
  }

  const handleRecalculate = async () => {
    if (!selectedCompanyId) return
    try {
      await accountPlanApi.recalculate(selectedCompanyId)
      await loadAccounts(selectedCompanyId)
    } catch (error) {
      console.error('Yeniden hesaplama hatası:', error)
    }
  }

  const handleSavePropertyNames = async () => {
    if (!selectedCompanyId) return
    setSaving(true)
    try {
      await companyApi.updatePropertyNames(selectedCompanyId, {
        propertyName1: propertyNames[0] || undefined,
        propertyName2: propertyNames[1] || undefined,
        propertyName3: propertyNames[2] || undefined,
        propertyName4: propertyNames[3] || undefined,
        propertyName5: propertyNames[4] || undefined
      })
      await loadCompanies()
      setShowPropertyPanel(false)
    } catch (error) {
      console.error('Özellik isimleri kaydedilemedi:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddOption = async (propertyIndex: number) => {
    if (!selectedCompanyId) return
    const value = newOptionValues[propertyIndex - 1].trim()
    if (!value) return

    try {
      await companyApi.addPropertyOption(selectedCompanyId, { propertyIndex, value })
      await loadPropertyOptions(selectedCompanyId)
      const newValues = [...newOptionValues]
      newValues[propertyIndex - 1] = ''
      setNewOptionValues(newValues)
    } catch (error) {
      console.error('Seçenek eklenemedi:', error)
    }
  }

  const handleDeleteOption = async (optionId: number) => {
    if (!selectedCompanyId) return
    try {
      await companyApi.deletePropertyOption(selectedCompanyId, optionId)
      await loadPropertyOptions(selectedCompanyId)
    } catch (error) {
      console.error('Seçenek silinemedi:', error)
    }
  }

  const getPropertyOptionsForIndex = (index: number): PropertyOption[] => {
    return propertyOptions.filter(p => p.propertyIndex === index)
  }

  const handleAssignProperty = async (accountId: number, propertyIndex: number | null, propertyValue: string | null) => {
    if (!selectedCompanyId) return
    try {
      await accountPlanApi.assignProperty(accountId, propertyIndex, propertyValue)
      await loadAccounts(selectedCompanyId)
    } catch (error) {
      console.error('Özellik atama hatası:', error)
    }
  }

  const handlePropertyValueChange = async (accountId: number, account: AccountPlanItem, newValue: string) => {
    await handleAssignProperty(accountId, account.assignedPropertyIndex || null, newValue || null)
  }

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ]
  const MONTH_ACILIS = 0 // Açılış mizanı

  const periodLabel = (p: Period) =>
    p.month === MONTH_ACILIS ? `Açılış ${p.year}` : `${months[p.month - 1]} ${p.year}`

  const displayAccounts = viewMode === 'period' ? balances.map(b => ({
    id: b.id,
    accountCode: b.accountCode,
    accountName: b.accountName,
    level: b.accountCode.split('.').length,
    property1: b.property1,
    property2: b.property2,
    property3: b.property3,
    property4: b.property4,
    property5: b.property5,
    costCenter: '',
    isLeaf: b.isLeaf,
    assignedPropertyIndex: undefined,
    assignedPropertyValue: undefined
  })) : accounts

  const filteredAccounts = displayAccounts.filter((a) => {
    const matchCode = !filters.accountCode || a.accountCode.toLowerCase().includes(filters.accountCode.toLowerCase())
    const matchName = !filters.accountName || a.accountName.toLowerCase().includes(filters.accountName.toLowerCase())
    const matchLevel = !filters.level || a.level.toString() === filters.level
    const matchP1 = !filters.property1 || (a.property1 || '').toLowerCase().includes(filters.property1.toLowerCase())
    const matchP2 = !filters.property2 || (a.property2 || '').toLowerCase().includes(filters.property2.toLowerCase())
    const matchP3 = !filters.property3 || (a.property3 || '').toLowerCase().includes(filters.property3.toLowerCase())
    const matchP4 = !filters.property4 || (a.property4 || '').toLowerCase().includes(filters.property4.toLowerCase())
    const matchP5 = !filters.property5 || (a.property5 || '').toLowerCase().includes(filters.property5.toLowerCase())
    return matchCode && matchName && matchLevel && matchP1 && matchP2 && matchP3 && matchP4 && matchP5
  })

  const getLevelColor = (level: number) => {
    const colors = ['text-primary-400', 'text-blue-400', 'text-purple-400', 'text-pink-400', 'text-orange-400']
    return colors[level - 1] || 'text-gray-400'
  }

  const getPropertyLabel = (index: number) => {
    if (selectedCompany) {
      const names = [selectedCompany.propertyName1, selectedCompany.propertyName2, selectedCompany.propertyName3, selectedCompany.propertyName4, selectedCompany.propertyName5]
      return names[index] || `Özellik ${index + 1}`
    }
    return `Özellik ${index + 1}`
  }

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

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
          <h1 className="text-2xl font-bold text-white">Hesap Planı</h1>
          <p className="text-gray-400 mt-1">Şirketinizin hesap planını görüntüleyin</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPropertyPanel(!showPropertyPanel)} className="btn-secondary">
            ⚙️ Özellik Tanımla
          </button>
          <button onClick={handleRecalculate} className="btn-secondary">
            🔄 Özellikleri Yeniden Hesapla
          </button>
        </div>
      </div>

      {showPropertyPanel && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Özellik Ayarları</h3>
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <label className="block text-xs text-gray-400">Özellik {i} Adı</label>
                <input
                  type="text"
                  value={propertyNames[i - 1]}
                  onChange={(e) => {
                    const newNames = [...propertyNames]
                    newNames[i - 1] = e.target.value
                    setPropertyNames(newNames)
                  }}
                  placeholder={`Özellik ${i}`}
                  className="input-field text-sm"
                />
                <label className="block text-xs text-gray-400 mt-2">Seçenekler</label>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {getPropertyOptionsForIndex(i).map((opt) => (
                    <div key={opt.id} className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
                      <span className="text-xs text-gray-300 flex-1 truncate">{opt.value}</span>
                      <button onClick={() => handleDeleteOption(opt.id)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newOptionValues[i - 1]}
                    onChange={(e) => {
                      const newValues = [...newOptionValues]
                      newValues[i - 1] = e.target.value
                      setNewOptionValues(newValues)
                    }}
                    placeholder="Yeni değer"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOption(i)}
                    className="input-field text-xs flex-1"
                  />
                  <button onClick={() => handleAddOption(i)} className="btn-primary text-xs px-2">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSavePropertyNames} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Kaydediliyor...' : 'İsimleri Kaydet'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={selectedCompanyId || ''}
          onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
          className="input-field w-auto"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setViewMode('period')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'period'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Dönem Bazlı
          </button>
        </div>
        <span className="text-sm text-gray-400">
          Toplam: {displayAccounts.length} | Filtreli: {filteredAccounts.length} | Leaf: {displayAccounts.filter(a => a.isLeaf).length}
        </span>
      </div>

      {viewMode === 'period' && periods.length > 0 && (
        <div className="card p-0">
          <div className="flex items-center border-b border-gray-700 overflow-x-auto">
            {periods.map((period) => {
              const isActive = selectedPeriod?.year === period.year && selectedPeriod?.month === period.month
              return (
                <button
                  key={`${period.year}-${period.month}`}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-500 text-primary-400 bg-primary-500/10'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {periodLabel(period)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {accountsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Hesap planı boş. Mizan yükleyerek hesap planı oluşturabilirsiniz.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm min-w-[1200px]">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2 px-2 min-w-[120px]">
                    <div className="space-y-1">
                      <span>Hesap Kodu</span>
                      <input
                        type="text"
                        value={filters.accountCode}
                        onChange={(e) => updateFilter('accountCode', e.target.value)}
                        placeholder="Filtre..."
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-2 min-w-[150px]">
                    <div className="space-y-1">
                      <span>Hesap Adı</span>
                      <input
                        type="text"
                        value={filters.accountName}
                        onChange={(e) => updateFilter('accountName', e.target.value)}
                        placeholder="Filtre..."
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-2 w-16">
                    <div className="space-y-1">
                      <span>Svye</span>
                      <select
                        value={filters.level}
                        onChange={(e) => updateFilter('level', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      >
                        <option value="">Tümü</option>
                        {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>L{l}</option>)}
                      </select>
                    </div>
                  </th>
                  <th className="py-2 px-2 min-w-[140px]">Atama</th>
                  <th className="py-2 px-2 min-w-[100px]">
                    <div className="space-y-1">
                      <span>{getPropertyLabel(0)}</span>
                      <input
                        type="text"
                        value={filters.property1}
                        onChange={(e) => updateFilter('property1', e.target.value)}
                        placeholder="Filtre..."
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-2 min-w-[100px]">
                    <div className="space-y-1">
                      <span>{getPropertyLabel(1)}</span>
                      <input
                        type="text"
                        value={filters.property2}
                        onChange={(e) => updateFilter('property2', e.target.value)}
                        placeholder="Filtre..."
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-2 min-w-[100px]">
                    <div className="space-y-1">
                      <span>{getPropertyLabel(2)}</span>
                      <input
                        type="text"
                        value={filters.property3}
                        onChange={(e) => updateFilter('property3', e.target.value)}
                        placeholder="Filtre..."
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-2 min-w-[100px]">
                    <div className="space-y-1">
                      <span>{getPropertyLabel(3)}</span>
                      <input
                        type="text"
                        value={filters.property4}
                        onChange={(e) => updateFilter('property4', e.target.value)}
                        placeholder="Filtre..."
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-2 min-w-[100px]">
                    <div className="space-y-1">
                      <span>{getPropertyLabel(4)}</span>
                      <input
                        type="text"
                        value={filters.property5}
                        onChange={(e) => updateFilter('property5', e.target.value)}
                        placeholder="Filtre..."
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      />
                    </div>
                  </th>
                  <th className="py-2 px-2 w-12">Leaf</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-1.5 px-2 font-mono text-white text-xs">
                      <span style={{ paddingLeft: `${(account.level - 1) * 0.5}rem` }}>{account.accountCode}</span>
                    </td>
                    <td className="py-1.5 px-2 text-gray-300 text-xs">{account.accountName}</td>
                    <td className="py-1.5 px-2">
                      <span className={`font-medium text-xs ${getLevelColor(account.level)}`}>L{account.level}</span>
                    </td>
                    <td className="py-1.5 px-2">
                      {(account.level === 2 || account.level === 3) && (
                        <div className="flex gap-1 items-center">
                          <select
                            value={account.assignedPropertyIndex || ''}
                            onChange={(e) => handleAssignProperty(account.id, e.target.value ? Number(e.target.value) : null, account.assignedPropertyValue || null)}
                            className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300 w-14"
                          >
                            <option value="">Oto</option>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <option key={i} value={i}>Ö{i}</option>
                            ))}
                          </select>
                          {account.assignedPropertyIndex && (
                            <>
                              {getPropertyOptionsForIndex(account.assignedPropertyIndex).length > 0 ? (
                                <select
                                  value={account.assignedPropertyValue || ''}
                                  onChange={(e) => handlePropertyValueChange(account.id, account, e.target.value)}
                                  className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                                >
                                  <option value="">Seç</option>
                                  {getPropertyOptionsForIndex(account.assignedPropertyIndex).map((opt) => (
                                    <option key={opt.id} value={opt.value}>{opt.value}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={account.assignedPropertyValue || ''}
                                  placeholder="Değer"
                                  onBlur={(e) => handlePropertyValueChange(account.id, account, e.target.value)}
                                  className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300 w-16"
                                />
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-gray-400 text-xs truncate max-w-[100px]" title={account.property1 || ''}>{account.property1 || '-'}</td>
                    <td className="py-1.5 px-2 text-gray-400 text-xs truncate max-w-[100px]" title={account.property2 || ''}>{account.property2 || '-'}</td>
                    <td className="py-1.5 px-2 text-gray-400 text-xs truncate max-w-[100px]" title={account.property3 || ''}>{account.property3 || '-'}</td>
                    <td className="py-1.5 px-2 text-gray-400 text-xs truncate max-w-[100px]" title={account.property4 || ''}>{account.property4 || '-'}</td>
                    <td className="py-1.5 px-2 text-gray-400 text-xs truncate max-w-[100px]" title={account.property5 || ''}>{account.property5 || '-'}</td>
                    <td className="py-1.5 px-2 text-center">
                      {account.isLeaf ? (
                        <span className="text-xs text-primary-400">✓</span>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
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
