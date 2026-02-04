import { useEffect, useState } from 'react'
import { companyApi, gelirTablosuApi, mizanApi, Company, GelirTablosuData, GelirTablosuItem, NotCodeDetailsData } from '../services/api'
import * as XLSX from 'xlsx'

export default function GelirTablosuRaporlari() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [data, setData] = useState<GelirTablosuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [compareYears, setCompareYears] = useState(false)
  const [compareYear1, setCompareYear1] = useState<number>(new Date().getFullYear())
  const [compareYear2, setCompareYear2] = useState<number>(new Date().getFullYear() - 1)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [multiYearData, setMultiYearData] = useState<[GelirTablosuData, GelirTablosuData] | null>(null)
  const [selectedNotCode, setSelectedNotCode] = useState<string | null>(null)
  const [notCodeDetails, setNotCodeDetails] = useState<NotCodeDetailsData | null>(null)
  const [notCodeDetailsLoading, setNotCodeDetailsLoading] = useState(false)

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
      if (!compareYears) loadGelirTablosuData(selectedCompanyId, selectedYear)
      setSelectedNotCode(null)
      setNotCodeDetails(null)
      mizanApi.getPeriods(selectedCompanyId).then(res => {
        const years = [...new Set((res.data || []).map((p: { year: number }) => p.year))].sort((a, b) => b - a)
        setAvailableYears(years.length > 0 ? years : Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i))
      }).catch(() => setAvailableYears(Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)))
    }
  }, [selectedCompanyId, selectedYear, companies, compareYears])

  useEffect(() => {
    if (!compareYears) setMultiYearData(null)
  }, [compareYears])

  useEffect(() => {
    if (selectedNotCode && selectedCompanyId) {
      loadNotCodeDetails(selectedCompanyId, selectedNotCode, selectedYear)
    } else {
      setNotCodeDetails(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNotCode, selectedCompanyId, selectedYear])

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

  const loadGelirTablosuData = async (companyId: number, year: number) => {
    setDataLoading(true)
    setError(null)
    try {
      const response = await gelirTablosuApi.getGelirTablosu(companyId, year)
      const responseData = response.data as any
      
      // Backend'den gelen veriyi frontend formatına dönüştür
      setData({
        year: responseData.Year || responseData.year || year,
        periods: responseData.Periods || responseData.periods || [],
        items: (responseData.Items || responseData.items || []).map((item: any) => ({
          Name: item.Name || item.name || '',
          NotCode: item.NotCode || item.notCode,
          IsCategory: item.IsCategory || item.isCategory || false,
          IsTotal: item.IsTotal || item.isTotal || false,
          Values: item.Values || item.values || {}
        })) as GelirTablosuItem[]
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Gelir tablosu yüklenirken bir hata oluştu'
      setError(errorMessage)
      console.error('Gelir tablosu yüklenirken hata:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const loadCompareYears = async () => {
    if (!selectedCompanyId || compareYear1 === compareYear2) return
    setDataLoading(true)
    setError(null)
    setMultiYearData(null)
    try {
      const [res1, res2] = await Promise.all([
        gelirTablosuApi.getGelirTablosu(selectedCompanyId, compareYear1),
        gelirTablosuApi.getGelirTablosu(selectedCompanyId, compareYear2)
      ])
      const toData = (responseData: any, year: number): GelirTablosuData => ({
        year: responseData.Year ?? responseData.year ?? year,
        periods: responseData.Periods ?? responseData.periods ?? [],
        items: (responseData.Items ?? responseData.items ?? []).map((item: any) => ({
          Name: item.Name ?? item.name ?? '',
          NotCode: item.NotCode ?? item.notCode,
          IsCategory: item.IsCategory ?? item.isCategory ?? false,
          IsTotal: item.IsTotal ?? item.isTotal ?? false,
          Values: item.Values ?? item.values ?? {}
        })) as GelirTablosuItem[]
      })
      setMultiYearData([toData(res1.data, compareYear1), toData(res2.data, compareYear2)])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Karşılaştırma yüklenirken hata oluştu')
    } finally {
      setDataLoading(false)
    }
  }

  const loadNotCodeDetails = async (companyId: number, notCode: string, year: number) => {
    setNotCodeDetailsLoading(true)
    setError(null)
    setNotCodeDetails(null)
    try {
      const response = await gelirTablosuApi.getNotCodeDetails(companyId, notCode, year)
      const responseData = response.data as any
      
      setNotCodeDetails({
        NotCode: responseData.NotCode || responseData.notCode || notCode,
        Year: responseData.Year || responseData.year || year,
        Periods: responseData.Periods || responseData.periods || [],
        Accounts: (responseData.Accounts || responseData.accounts || []).map((item: any) => ({
          AccountCode: item.AccountCode || item.accountCode || '',
          AccountName: item.AccountName || item.accountName || '',
          Values: item.Values || item.values || {},
          Total: item.Total || item.total || 0
        }))
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'NOT detayları yüklenirken bir hata oluştu'
      setError(errorMessage)
      console.error('NOT detayları yüklenirken hata:', err)
      setNotCodeDetails(null)
    } finally {
      setNotCodeDetailsLoading(false)
    }
  }

  const getAllNotCodes = (): string[] => {
    if (!data || !data.items) return []
    const notCodes = new Set<string>()
    data.items.forEach(item => {
      if (item.NotCode && item.NotCode.trim() !== '') {
        notCodes.add(item.NotCode)
      }
    })
    return Array.from(notCodes).sort()
  }

  const formatBalance = (value: number) => {
    if (value === 0) return '0,00'
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const monthLabel = (monthNum: number) =>
    monthNum === 0 ? 'Açılış' : months[monthNum - 1]

  const renderGelirTablosuCompare = () => {
    if (!multiYearData || multiYearData[0].items.length === 0) return null
    const [d1, d2] = multiYearData
    const items1 = d1.items
    const items2 = d2.items
    const map2 = new Map<string, GelirTablosuItem>()
    items2.forEach(it => map2.set(`${it.Name}|${it.NotCode ?? ''}`, it))
    const merged = items1.map((it1, index) => ({ it1, it2: map2.get(`${it1.Name}|${it1.NotCode ?? ''}`), index }))
    return (
      <div className="overflow-x-auto overflow-y-auto min-h-0 h-full">
        <table className="text-sm border-collapse table-fixed" style={{ minWidth: 520, width: 'max-content' }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
              <th className="py-2 px-3 text-center border border-gray-700">NOT</th>
              <th className="py-2 px-3 text-right border border-gray-700 bg-primary-500/20">{d1.year} Toplam TL</th>
              <th className="py-2 px-3 text-right border border-gray-700 bg-primary-500/20">{d2.year} Toplam TL</th>
            </tr>
          </thead>
          <tbody>
            {merged.map(({ it1, it2, index }) => {
              const isCategory = it1.IsCategory && !it1.NotCode
              const isTotal = it1.IsTotal
              const isSubTotal = it1.IsCategory && it1.NotCode === null && index > 0 && items1[index - 1]?.NotCode
              const v2 = it2?.Values ?? {}
              const total1 = it1.Values['Total'] ?? 0
              const total2 = v2['Total'] ?? 0
              return (
                <tr
                  key={index}
                  className={isTotal ? 'bg-yellow-500/30 font-bold' : isCategory || isSubTotal ? 'bg-gray-700/50 font-bold' : 'hover:bg-gray-900/50'}
                >
                  <td className="py-2 px-3 border border-gray-700 truncate text-white" title={it1.Name}>{it1.Name}</td>
                  <td className="py-2 px-3 text-center border border-gray-700 text-gray-300">{it1.NotCode ?? ''}</td>
                  <td className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${total1 < 0 ? 'text-red-400' : 'text-gray-300'}`} style={{ whiteSpace: 'nowrap' }}>{formatBalance(total1)}</td>
                  <td className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${total2 < 0 ? 'text-red-400' : 'text-gray-300'}`} style={{ whiteSpace: 'nowrap' }}>{formatBalance(total2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderGelirTablosu = () => {
    if (!data || !data.items || data.items.length === 0) return null

    const colWidths = {
      hesapAdi: 220,
      not: 52,
      ay: 100,
      toplam: 100
    }
    const minTableWidth = colWidths.hesapAdi + colWidths.not + (data.periods?.length || 0) * colWidths.ay + colWidths.toplam

    return (
      <div className="overflow-x-auto overflow-y-auto min-h-0 h-full">
        <table className="text-sm border-collapse table-fixed" style={{ minWidth: minTableWidth, width: 'max-content' }}>
          <colgroup>
            <col style={{ width: colWidths.hesapAdi }} />
            <col style={{ width: colWidths.not }} />
            {data?.periods.map((period, idx) => (
              <col key={`period-col-main-${period.year}-${period.month}-${idx}`} style={{ width: colWidths.ay }} />
            ))}
            <col style={{ width: colWidths.toplam }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
              <th className="py-2 px-3 text-center border border-gray-700">NOT</th>
              {data?.periods.map(period => (
                <th key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700">
                  {monthLabel(period.month)} TL
                </th>
              ))}
              <th className="py-2 px-3 text-right border border-gray-700">Toplam TL</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const isCategory = item.IsCategory && !item.NotCode
              const isTotal = item.IsTotal
              const isSubTotal = item.IsCategory && item.NotCode === null && index > 0 && data.items[index - 1]?.NotCode
              
              return (
                <tr
                  key={index}
                  className={`${
                    isTotal
                      ? 'bg-yellow-500/30 font-bold'
                      : isCategory || isSubTotal
                      ? 'bg-gray-700/50 font-bold'
                      : 'hover:bg-gray-900/50'
                  }`}
                >
                  <td
                    className={`py-2 px-3 border border-gray-700 truncate ${
                      isTotal ? 'text-yellow-200' : isCategory || isSubTotal ? 'text-gray-200' : 'text-white'
                    }`}
                    title={item.Name}
                  >
                    {item.Name}
                  </td>
                  <td 
                    className={`py-2 px-3 text-center border border-gray-700 ${
                      isTotal ? 'text-yellow-200' : isCategory || isSubTotal ? 'text-gray-200' : 'text-gray-300'
                    } ${item.NotCode ? 'cursor-pointer hover:bg-primary-500/20' : ''}`}
                    onClick={() => {
                      if (item.NotCode && item.NotCode.trim() !== '') {
                        const newValue = selectedNotCode === item.NotCode ? null : item.NotCode
                        setSelectedNotCode(newValue)
                      }
                    }}
                    title={item.NotCode ? 'NOT detaylarını görmek için tıklayın' : ''}
                  >
                    {item.NotCode || ''}
                  </td>
                  {data?.periods.map(period => {
                    const periodKey = `${period.month}`
                    const value = item.Values[periodKey] || 0
                    const isNegative = value < 0
                    return (
                      <td 
                        key={`${period.year}-${period.month}`} 
                        className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                          isTotal ? 'text-yellow-200' : isCategory || isSubTotal ? 'text-gray-200' : isNegative ? 'text-red-400' : 'text-gray-300'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {formatBalance(value)}
                      </td>
                    )
                  })}
                  <td 
                    className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                      isTotal ? 'text-yellow-200' : isCategory || isSubTotal ? 'text-gray-200' : (item.Values['Total'] || 0) < 0 ? 'text-red-400' : 'text-gray-300'
                    }`}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {formatBalance(item.Values['Total'] || 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const exportToExcel = () => {
    if (!data || !data.items) {
      setError('Export edilecek veri bulunamadı')
      return
    }

    const wb = XLSX.utils.book_new()
    
    // Gelir Tablosu sayfası
    const gelirTablosuData = [
      ['Hesap Adı', 'NOT', ...data.periods.map(p => `${monthLabel(p.month)} TL`), 'Toplam TL'],
      ...data.items.map(item => [
        item.Name,
        item.NotCode || '',
        ...data.periods.map(p => {
          const periodKey = `${p.month}`
          return item.Values[periodKey] || 0
        }),
        item.Values['Total'] || 0
      ])
    ]
    const gelirTablosuWs = XLSX.utils.aoa_to_sheet(gelirTablosuData)
    XLSX.utils.book_append_sheet(wb, gelirTablosuWs, 'Gelir Tablosu')

    const fileName = `Gelir_Tablosu_${selectedCompany?.companyName || 'Rapor'}_${data.year}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col max-h-[calc(100vh-6rem)] min-h-0 space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Gelir Tablosu Raporları</h1>
          <p className="text-gray-400 mt-1">Gelir tablosu raporlarını görüntüleyin</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedCompanyId || ''}
            onChange={(e) => setSelectedCompanyId(e.target.value ? parseInt(e.target.value) : null)}
            className="input-field"
          >
            <option value="">Şirket Seçin</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.companyName}
              </option>
            ))}
          </select>
          {!compareYears && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="input-field"
            >
              {(availableYears.length > 0 ? availableYears : Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input type="checkbox" checked={compareYears} onChange={(e) => setCompareYears(e.target.checked)} className="rounded border-gray-600" />
            <span className="text-sm">Yılları karşılaştır</span>
          </label>
          {compareYears && (
            <>
              <select value={compareYear1} onChange={(e) => setCompareYear1(Number(e.target.value))} className="input-field w-auto" title="Yıl 1">
                {(availableYears.length > 0 ? availableYears : Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-gray-500">vs</span>
              <select value={compareYear2} onChange={(e) => setCompareYear2(Number(e.target.value))} className="input-field w-auto" title="Yıl 2">
                {(availableYears.length > 0 ? availableYears : Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="button" onClick={loadCompareYears} disabled={compareYear1 === compareYear2 || dataLoading} className="btn-primary">
                {dataLoading ? 'Yükleniyor...' : 'Karşılaştırmayı Yükle'}
              </button>
            </>
          )}
          <button
            onClick={() => compareYears && selectedCompanyId ? loadCompareYears() : selectedCompanyId && loadGelirTablosuData(selectedCompanyId, selectedYear)}
            className="btn-secondary"
          >
            🔄 Yenile
          </button>
          {((data && data.items && data.items.length > 0) || (multiYearData && multiYearData[0].items.length > 0)) && (
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
        <div className="card bg-red-500/10 border border-red-500/20 text-red-400 text-center py-4 flex-shrink-0">
          {error}
        </div>
      )}

      {dataLoading ? (
        <div className="flex justify-center py-12 flex-shrink-0">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : multiYearData ? (
        <div className="card p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto p-6">
            {renderGelirTablosuCompare()}
          </div>
        </div>
      ) : !data || (!data.periods || data.periods.length === 0) ? (
        <div className="card text-center py-12 flex-shrink-0">
          <p className="text-gray-400">Henüz mizan yüklenmemiş. Mizan yüklemek için "Mizan Yükle" sayfasına gidin.</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* NOT Kodları Tab'ları */}
          {getAllNotCodes().length > 0 && (
            <div className="card p-0 flex-shrink-0">
              <div className="flex items-center border-b border-gray-700 overflow-x-auto">
                {getAllNotCodes().map((notCode) => {
                  const isActive = selectedNotCode === notCode
                  return (
                    <button
                      key={notCode}
                      onClick={() => {
                        const newValue = isActive ? null : notCode
                        setSelectedNotCode(newValue)
                      }}
                      className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                        isActive
                          ? 'border-primary-500 text-primary-400 bg-primary-500/10'
                          : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      NOT: {notCode}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* NOT Detayları veya Ana Gelir Tablosu */}
          {selectedNotCode ? (
            <div className="card p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-bold text-white">NOT: {selectedNotCode} - Alt Hesaplar</h2>
              </div>
              {notCodeDetailsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  <span className="ml-3 text-gray-400">Yükleniyor...</span>
                </div>
              ) : !notCodeDetails ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  <span className="ml-3 text-gray-400">Veri hazırlanıyor...</span>
                </div>
              ) : !notCodeDetails.Accounts || notCodeDetails.Accounts.length === 0 ? (
                <div className="card text-center py-12">
                  <p className="text-gray-400">Bu NOT kodu için alt hesap bulunamadı.</p>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                  <table className="text-sm border-collapse table-fixed" style={{ minWidth: 1000, width: 'max-content' }}>
                    <colgroup>
                      <col style={{ width: 100 }} />
                      <col style={{ width: 200 }} />
                      {notCodeDetails.Periods.map((period, idx) => (
                        <col key={`period-col-${period.year}-${period.month}-${idx}`} style={{ width: 100 }} />
                      ))}
                      <col style={{ width: 100 }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-800 text-gray-300">
                        <th className="py-2 px-3 text-left border border-gray-700">Hesap Kodu</th>
                        <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
                        {notCodeDetails.Periods.map(period => (
                          <th key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700">
                            {monthLabel(period.month)} TL
                          </th>
                        ))}
                        <th className="py-2 px-3 text-right border border-gray-700">Toplam TL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notCodeDetails.Accounts.map((account, index) => {
                        const isNegative = account.Total < 0
                        return (
                          <tr
                            key={index}
                            className="hover:bg-gray-900/50 border-b border-gray-800"
                          >
                            <td className="py-2 px-3 border border-gray-700 text-white font-mono text-xs">
                              {account.AccountCode}
                            </td>
                            <td className="py-2 px-3 border border-gray-700 text-gray-300 text-xs truncate" title={account.AccountName}>
                              {account.AccountName}
                            </td>
                            {notCodeDetails.Periods.map(period => {
                              const value = account.Values[`${period.month}`] || 0
                              const isValueNegative = value < 0
                              return (
                                <td 
                                  key={`${period.year}-${period.month}`} 
                                  className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                                    isValueNegative ? 'text-red-400' : 'text-gray-300'
                                  }`}
                                  style={{ whiteSpace: 'nowrap' }}
                                >
                                  {formatBalance(value)}
                                </td>
                              )
                            })}
                            <td 
                              className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                                isNegative ? 'text-red-400' : 'text-gray-300'
                              }`}
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              {formatBalance(account.Total)}
                            </td>
                          </tr>
                        )
                      })}
                      {/* Toplam Satırı */}
                      {notCodeDetails.Accounts.length > 0 && (
                        <tr className="bg-yellow-500/30 font-bold border-t-2 border-gray-600">
                          <td className="py-2 px-3 border border-gray-700 text-yellow-200 font-mono text-xs">
                            TOPLAM
                          </td>
                          <td className="py-2 px-3 border border-gray-700 text-yellow-200 text-xs">
                            {selectedNotCode} ile başlayan hesapların toplamı
                          </td>
                          {notCodeDetails.Periods.map(period => {
                            const periodTotal = notCodeDetails.Accounts.reduce(
                              (sum, acc) => sum + (acc.Values[`${period.month}`] || 0),
                              0
                            )
                            const isTotalNegative = periodTotal < 0
                            return (
                              <td 
                                key={`total-${period.year}-${period.month}`} 
                                className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                                  isTotalNegative ? 'text-red-400' : 'text-yellow-200'
                                }`}
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                {formatBalance(periodTotal)}
                              </td>
                            )
                          })}
                          <td 
                            className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                              (() => {
                                const grandTotal = notCodeDetails.Accounts.reduce((sum, acc) => sum + (acc.Total || 0), 0)
                                return grandTotal < 0 ? 'text-red-400' : 'text-yellow-200'
                              })()
                            }`}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {formatBalance(
                              notCodeDetails.Accounts.reduce((sum, acc) => sum + (acc.Total || 0), 0)
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto p-6">
                {renderGelirTablosu()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
