import { useEffect, useState } from 'react'
import { companyApi, mizanApi, Company } from '../services/api'
import * as XLSX from 'xlsx'

interface ConsolidatedData {
  periods: Array<{ year: number; month: number }>
  accounts: Array<{
    id: number
    accountCode: string
    accountName: string
    level: number
    property1?: string
    property2?: string
    property3?: string
    property4?: string
    property5?: string
    isLeaf: boolean
    assignedPropertyIndex?: number
    assignedPropertyValue?: string
    costCenter?: string
    balances: Array<{
      periodKey: string
      year: number
      month: number
      debitBalance: number
      creditBalance: number
      netBalance: number
    }>
  }>
}

export default function ConsolidatedMizan() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [data, setData] = useState<ConsolidatedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtreler
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

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ]

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (selectedCompanyId) {
      const company = companies.find(c => c.id === selectedCompanyId)
      setSelectedCompany(company || null)
      loadConsolidatedData(selectedCompanyId)
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

  const loadConsolidatedData = async (companyId: number) => {
    setDataLoading(true)
    setError(null)
    try {
      const response = await mizanApi.getConsolidated(companyId)
      setData(response.data)
      if (!response.data.periods || response.data.periods.length === 0) {
        setError('Henüz mizan yüklenmemiş')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Konsolide mizan yüklenirken bir hata oluştu'
      setError(errorMessage)
      console.error('Konsolide mizan yüklenirken hata:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const getPropertyLabel = (index: number) => {
    if (selectedCompany) {
      const names = [
        selectedCompany.propertyName1,
        selectedCompany.propertyName2,
        selectedCompany.propertyName3,
        selectedCompany.propertyName4,
        selectedCompany.propertyName5
      ]
      return names[index] || `Özellik ${index + 1}`
    }
    return `Özellik ${index + 1}`
  }

  const getLevelColor = (level: number) => {
    const colors = ['text-primary-400', 'text-blue-400', 'text-purple-400', 'text-pink-400', 'text-orange-400']
    return colors[level - 1] || 'text-gray-400'
  }

  const formatBalance = (value: number) => {
    if (value === 0) return '0,00'
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const getBalanceForPeriod = (account: ConsolidatedData['accounts'][0], period: { year: number; month: number }) => {
    const periodKey = `${period.year}-${period.month}`
    const balance = account.balances.find(b => b.periodKey === periodKey)
    return balance ? balance.netBalance : 0
  }

  const filteredAccounts = data?.accounts.filter((a) => {
    const matchCode = !filters.accountCode || a.accountCode.toLowerCase().includes(filters.accountCode.toLowerCase())
    const matchName = !filters.accountName || a.accountName.toLowerCase().includes(filters.accountName.toLowerCase())
    const matchLevel = !filters.level || a.level.toString() === filters.level
    const matchP1 = !filters.property1 || (a.property1 || '').toLowerCase().includes(filters.property1.toLowerCase())
    const matchP2 = !filters.property2 || (a.property2 || '').toLowerCase().includes(filters.property2.toLowerCase())
    const matchP3 = !filters.property3 || (a.property3 || '').toLowerCase().includes(filters.property3.toLowerCase())
    const matchP4 = !filters.property4 || (a.property4 || '').toLowerCase().includes(filters.property4.toLowerCase())
    const matchP5 = !filters.property5 || (a.property5 || '').toLowerCase().includes(filters.property5.toLowerCase())
    return matchCode && matchName && matchLevel && matchP1 && matchP2 && matchP3 && matchP4 && matchP5
  }) || []

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const exportToExcel = () => {
    if (!data || !data.accounts || data.accounts.length === 0) {
      setError('Export edilecek veri bulunamadı')
      return
    }

    // Excel için veri hazırla
    const excelData: any[] = []
    
    // Başlık satırı
    const headers = [
      'Hesap Kodu',
      'Hesap Adı',
      'Seviye',
      'Atama',
      getPropertyLabel(0),
      getPropertyLabel(1),
      getPropertyLabel(2),
      getPropertyLabel(3),
      getPropertyLabel(4)
    ]
    
    // Tarih kolonları ekle
    data.periods.forEach(period => {
      headers.push(`${months[period.month - 1]} ${period.year}`)
    })
    
    excelData.push(headers)

    // Veri satırları
    filteredAccounts.forEach(account => {
      const row: any[] = [
        account.accountCode,
        account.accountName,
        `L${account.level}`,
        account.assignedPropertyValue || 'Oto',
        account.property1 || '',
        account.property2 || '',
        account.property3 || '',
        account.property4 || '',
        account.property5 || ''
      ]

      // Her dönem için bakiye ekle
      data.periods.forEach(period => {
        const balance = getBalanceForPeriod(account, period)
        row.push(balance)
      })

      excelData.push(row)
    })

    // Worksheet oluştur
    const ws = XLSX.utils.aoa_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Konsolide Mizan')

    // Kolon genişliklerini ayarla
    const colWidths = [
      { wch: 15 }, // Hesap Kodu
      { wch: 30 }, // Hesap Adı
      { wch: 8 },  // Seviye
      { wch: 12 }, // Atama
      { wch: 20 }, // Özellik 1
      { wch: 20 }, // Özellik 2
      { wch: 20 }, // Özellik 3
      { wch: 20 }, // Özellik 4
      { wch: 20 }  // Özellik 5
    ]
    
    // Tarih kolonları için genişlik ekle
    data.periods.forEach(() => {
      colWidths.push({ wch: 15 })
    })
    
    ws['!cols'] = colWidths

    // Başlık satırını formatla
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    }

    // Dosya adı oluştur
    const companyName = selectedCompany?.companyName || 'KonsolideMizan'
    const fileName = `${companyName}_KonsolideMizan_${new Date().toISOString().split('T')[0]}.xlsx`

    // Dosyayı indir
    XLSX.writeFile(wb, fileName)
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
          <h1 className="text-2xl font-bold text-white">Konsolide Mizan</h1>
          <p className="text-gray-400 mt-1">Tüm dönemlerin bakiyelerini yan yana görüntüleyin</p>
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
            onClick={() => selectedCompanyId && loadConsolidatedData(selectedCompanyId)}
            className="btn-secondary"
          >
            🔄 Yenile
          </button>
          {data && data.accounts && data.accounts.length > 0 && (
            <button
              onClick={exportToExcel}
              className="btn-primary"
            >
              📥 Excel'e Aktar
            </button>
          )}
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
      ) : !data || (!data.periods || data.periods.length === 0) ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Henüz mizan yüklenmemiş. Mizan yüklemek için "Mizan Yükle" sayfasına gidin.</p>
        </div>
      ) : !data.accounts || data.accounts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Mizan verileri yüklü ancak hesap planı bulunamadı. Lütfen hesap planını kontrol edin.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-auto max-h-[75vh]">
            <table className="w-full text-sm min-w-[1400px]">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  {/* Sol taraf - Hesap bilgileri */}
                  <th className="py-2 px-2 min-w-[120px] sticky left-0 bg-gray-900 z-20 border-r border-gray-700">
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
                  <th className="py-2 px-2 min-w-[200px] sticky left-[120px] bg-gray-900 z-20 border-r border-gray-700">
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
                  <th className="py-2 px-2 w-16 sticky left-[320px] bg-gray-900 z-20 border-r border-gray-700">
                    <div className="space-y-1">
                      <span>Svye</span>
                      <select
                        value={filters.level}
                        onChange={(e) => updateFilter('level', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs text-gray-300"
                      >
                        <option value="">TÜ</option>
                        {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>L{l}</option>)}
                      </select>
                    </div>
                  </th>
                  <th className="py-2 px-2 min-w-[100px] sticky left-[376px] bg-gray-900 z-20 border-r border-gray-700">
                    Atama
                  </th>
                  <th className="py-2 px-2 min-w-[120px] sticky left-[476px] bg-gray-900 z-20 border-r border-gray-700">
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
                  <th className="py-2 px-2 min-w-[120px] sticky left-[596px] bg-gray-900 z-20 border-r border-gray-700">
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
                  <th className="py-2 px-2 min-w-[120px] sticky left-[716px] bg-gray-900 z-20 border-r border-gray-700">
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
                  <th className="py-2 px-2 min-w-[120px] sticky left-[836px] bg-gray-900 z-20 border-r border-gray-700">
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
                  <th className="py-2 px-2 min-w-[120px] sticky left-[956px] bg-gray-900 z-20 border-r border-gray-700">
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
                  
                  {/* Sağ taraf - Tarih kolonları */}
                  {data.periods.map((period) => (
                    <th key={`${period.year}-${period.month}`} className="py-2 px-2 min-w-[120px] text-center">
                      <div className="space-y-1">
                        <span>{months[period.month - 1]}</span>
                        <span className="text-xs text-gray-500">{period.year}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                    {/* Sol taraf - Hesap bilgileri */}
                    <td className="py-2 px-2 sticky left-0 bg-gray-950 z-10 border-r border-gray-700">
                      <span className="font-mono text-xs">{account.accountCode}</span>
                    </td>
                    <td className="py-2 px-2 sticky left-[120px] bg-gray-950 z-10 border-r border-gray-700">
                      <span className={`${getLevelColor(account.level)}`} style={{ paddingLeft: `${(account.level - 1) * 12}px` }}>
                        {account.accountName}
                      </span>
                    </td>
                    <td className="py-2 px-2 sticky left-[320px] bg-gray-950 z-10 border-r border-gray-700 text-center">
                      <span className={`text-xs ${getLevelColor(account.level)}`}>L{account.level}</span>
                    </td>
                    <td className="py-2 px-2 sticky left-[376px] bg-gray-950 z-10 border-r border-gray-700">
                      <span className="text-xs text-gray-400">
                        {account.assignedPropertyValue || 'Oto'}
                      </span>
                    </td>
                    <td className="py-2 px-2 sticky left-[476px] bg-gray-950 z-10 border-r border-gray-700">
                      <span className="text-xs text-gray-300">{account.property1 || '-'}</span>
                    </td>
                    <td className="py-2 px-2 sticky left-[596px] bg-gray-950 z-10 border-r border-gray-700">
                      <span className="text-xs text-gray-300">{account.property2 || '-'}</span>
                    </td>
                    <td className="py-2 px-2 sticky left-[716px] bg-gray-950 z-10 border-r border-gray-700">
                      <span className="text-xs text-gray-300">{account.property3 || '-'}</span>
                    </td>
                    <td className="py-2 px-2 sticky left-[836px] bg-gray-950 z-10 border-r border-gray-700">
                      <span className="text-xs text-gray-300">{account.property4 || '-'}</span>
                    </td>
                    <td className="py-2 px-2 sticky left-[956px] bg-gray-950 z-10 border-r border-gray-700">
                      <span className="text-xs text-gray-300">{account.property5 || '-'}</span>
                    </td>
                    
                    {/* Sağ taraf - Bakiyeler */}
                    {data.periods.map((period) => {
                      const balance = getBalanceForPeriod(account, period)
                      const isPositive = balance >= 0
                      return (
                        <td key={`${account.id}-${period.year}-${period.month}`} className="py-2 px-2 text-right">
                          <span className={`text-xs font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {formatBalance(balance)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <div className="text-sm text-gray-400">
          Toplam Hesap: {data.accounts.length} | Filtreli: {filteredAccounts.length} | Dönem Sayısı: {data.periods.length}
        </div>
      )}
    </div>
  )
}
