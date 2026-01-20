import { useEffect, useState } from 'react'
import { companyApi, bilancoApi, Company, BilancoData, BilancoItem, NotCodeDetailsData, NotCodeDetail } from '../services/api'
import * as XLSX from 'xlsx'

export default function BilancoRaporlari() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [data, setData] = useState<BilancoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
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
      loadBilancoData(selectedCompanyId, selectedYear)
      setSelectedNotCode(null)
      setNotCodeDetails(null)
    }
  }, [selectedCompanyId, selectedYear, companies])

  useEffect(() => {
    console.log('useEffect tetiklendi:', { selectedNotCode, selectedCompanyId, selectedYear })
    if (selectedNotCode && selectedCompanyId) {
      console.log('loadNotCodeDetails çağrılıyor')
      loadNotCodeDetails(selectedCompanyId, selectedNotCode, selectedYear)
    } else {
      console.log('selectedNotCode veya selectedCompanyId yok, notCodeDetails temizleniyor')
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

  const loadBilancoData = async (companyId: number, year: number) => {
    setDataLoading(true)
    setError(null)
    try {
      const response = await bilancoApi.getBilanco(companyId, year)
      const responseData = response.data as any
      
      // Backend'den gelen veriyi frontend formatına dönüştür
      setData({
        year: responseData.Year || responseData.year || year,
        periods: responseData.Periods || responseData.periods || [],
        varliklar: (responseData.Varliklar || responseData.varliklar || []).map((item: any) => ({
          Name: item.Name || item.name || '',
          AccountCode: item.AccountCode || item.accountCode,
          NotCode: item.NotCode || item.notCode,
          IsCategory: item.IsCategory || item.isCategory || false,
          IsTotal: item.IsTotal || item.isTotal || false,
          Values: item.Values || item.values || {}
        })) as BilancoItem[],
        kaynaklar: (responseData.Kaynaklar || responseData.kaynaklar || []).map((item: any) => ({
          Name: item.Name || item.name || '',
          AccountCode: item.AccountCode || item.accountCode,
          NotCode: item.NotCode || item.notCode,
          IsCategory: item.IsCategory || item.isCategory || false,
          IsTotal: item.IsTotal || item.isTotal || false,
          Values: item.Values || item.values || {}
        })) as BilancoItem[]
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Bilanço yüklenirken bir hata oluştu'
      setError(errorMessage)
      console.error('Bilanço yüklenirken hata:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const loadNotCodeDetails = async (companyId: number, notCode: string, year: number) => {
    setNotCodeDetailsLoading(true)
    setError(null)
    setNotCodeDetails(null) // Önce temizle
    try {
      console.log('NOT detayları yükleniyor:', { companyId, notCode, year })
      const response = await bilancoApi.getNotCodeDetails(companyId, notCode, year)
      const responseData = response.data as any
      console.log('NOT detayları yüklendi:', responseData)
      
      // Backend'den gelen veriyi frontend formatına dönüştür
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

  const formatBalance = (value: number) => {
    if (value === 0) return '0,00'
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const getAllNotCodes = (): string[] => {
    if (!data) return []
    const notCodes = new Set<string>()
    
    // Varlıklar ve kaynaklardan NOT kodlarını topla
    const allItems = (data.varliklar || []).concat(data.kaynaklar || [])
    allItems.forEach(item => {
      if (item.NotCode) {
        notCodes.add(item.NotCode)
      }
    })
    
    return Array.from(notCodes).sort()
  }

  const exportToExcel = () => {
    if (!data || !data.varliklar || !data.kaynaklar) {
      setError('Export edilecek veri bulunamadı')
      return
    }

    const excelData: any[] = []
    
    // Başlık satırı
    const headers = ['Hesap Adı', 'NOT']
    data.periods.forEach(period => {
      headers.push(`${months[period.month - 1]} TL`)
    })
    headers.push('Toplam TL')
    
    excelData.push(headers)

    // VARLIKLAR bölümü
    excelData.push(['VARLIKLAR', ''])
    data.varliklar.forEach(item => {
      const row: any[] = [item.Name, item.NotCode || '']
      data.periods.forEach(period => {
        const value = item.Values[`${period.month}`] || 0
        row.push(value)
      })
      row.push(item.Values.Total || 0)
      excelData.push(row)
    })

    // Boş satır
    excelData.push([])

    // KAYNAKLAR bölümü
    excelData.push(['KAYNAKLAR', ''])
    data.kaynaklar.forEach(item => {
      const row: any[] = [item.Name, item.NotCode || '']
      data.periods.forEach(period => {
        const value = item.Values[`${period.month}`] || 0
        row.push(value)
      })
      row.push(item.Values.Total || 0)
      excelData.push(row)
    })

    // Worksheet oluştur
    const ws = XLSX.utils.aoa_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bilanço')

    // Kolon genişliklerini ayarla
    const colWidths = [{ wch: 40 }, { wch: 8 }] // Hesap Adı, NOT
    data.periods.forEach(() => colWidths.push({ wch: 18 })) // Her ay
    colWidths.push({ wch: 18 }) // Toplam
    ws['!cols'] = colWidths

    // Başlık ve toplam satırlarını formatla
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let row = 0; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 })
      const cell = ws[cellAddress]
      if (cell && (cell.v === 'VARLIKLAR' || cell.v === 'KAYNAKLAR' || 
          (typeof cell.v === 'string' && cell.v.includes('TOPLAM')))) {
        if (!cell.s) cell.s = {}
        cell.s.font = { bold: true }
        cell.s.fill = { fgColor: { rgb: 'FFFF00' } }
      }
    }

    // Dosya adı
    const companyName = selectedCompany?.companyName || 'Bilanco'
    const fileName = `${companyName}_Bilanco_${data.year}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  const renderBilancoSection = (items: BilancoItem[], title: string) => {
    if (!items || items.length === 0) return null

    return (
      <div className="space-y-1">
        <table className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-auto" />
            <col className="w-16" />
            {data?.periods.map((period, idx) => <col key={`period-col-main-${period.year}-${period.month}-${idx}`} className="w-32" />)}
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
              <th className="py-2 px-3 text-center border border-gray-700">NOT</th>
              {data?.periods.map(period => (
                <th key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700">
                  {months[period.month - 1]} TL
                </th>
              ))}
              <th className="py-2 px-3 text-right border border-gray-700">Toplam TL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const isCategory = item.IsCategory && !item.NotCode
              const isTotal = item.IsTotal
              const isSubTotal = item.IsCategory && item.NotCode === null && index > 0 && items[index - 1]?.NotCode
              
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
                  <td className={`py-2 px-3 border border-gray-700 ${
                    isTotal ? 'text-yellow-200' : isCategory || isSubTotal ? 'text-gray-200' : 'text-white'
                  }`}>
                    {item.Name}
                  </td>
                  <td className={`py-2 px-3 text-center border border-gray-700 ${
                    isTotal ? 'text-yellow-200' : isCategory || isSubTotal ? 'text-gray-200' : 'text-gray-300'
                  }`}>
                    {item.NotCode || ''}
                  </td>
                  {data?.periods.map(period => {
                    const value = item.Values[`${period.month}`] || 0
                    const isNegative = value < 0
                    return (
                      <td 
                        key={`${period.year}-${period.month}`} 
                        className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                          isTotal 
                            ? 'text-yellow-200' 
                            : isCategory || isSubTotal
                            ? 'text-gray-200'
                            : isNegative
                            ? 'text-red-400'
                            : 'text-gray-300'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {formatBalance(value)}
                      </td>
                    )
                  })}
                  <td className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                    isTotal 
                      ? 'text-yellow-200' 
                      : isCategory || isSubTotal
                      ? 'text-gray-200'
                      : (item.Values.Total || 0) < 0
                      ? 'text-red-400'
                      : 'text-gray-300'
                  }`}
                  style={{ whiteSpace: 'nowrap' }}
                  >
                    {formatBalance(item.Values.Total || 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
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

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bilanço Raporları</h1>
          <p className="text-gray-400 mt-1">Bilanço raporlarını görüntüleyin</p>
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
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input-field w-auto"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => selectedCompanyId && loadBilancoData(selectedCompanyId, selectedYear)}
            className="btn-secondary"
          >
            🔄 Yenile
          </button>
          {data && data.varliklar && data.varliklar.length > 0 && (
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
      ) : (
        <>
          {/* NOT Kodları Tab'ları */}
          {getAllNotCodes().length > 0 && (
            <div className="card p-0">
              <div className="flex items-center border-b border-gray-700 overflow-x-auto">
                {getAllNotCodes().map((notCode) => {
                  const isActive = selectedNotCode === notCode
                  return (
                    <button
                      key={notCode}
                      onClick={() => {
                        console.log('NOT tab tıklandı:', notCode, 'Aktif:', isActive)
                        const newValue = isActive ? null : notCode
                        console.log('Yeni selectedNotCode:', newValue)
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

          {/* NOT Detayları veya Ana Bilanço */}
          {selectedNotCode ? (
            <div className="card p-0 overflow-hidden">
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
                <div className="overflow-auto max-h-[75vh]">
                  <table className="w-full text-sm border-collapse table-fixed">
                    <colgroup>
                      <col className="w-auto" />
                      <col className="w-auto" />
                      {notCodeDetails.Periods.map((period, idx) => <col key={`period-col-${period.year}-${period.month}-${idx}`} className="w-32" />)}
                      <col className="w-32" />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-800 text-gray-300">
                        <th className="py-2 px-3 text-left border border-gray-700">Hesap Kodu</th>
                        <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
                        {notCodeDetails.Periods.map(period => (
                          <th key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700">
                            {months[period.month - 1]} TL
                          </th>
                        ))}
                        <th className="py-2 px-3 text-right border border-gray-700">Toplam TL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Hesapları ilk 3 haneye göre grupla
                        const groupedAccounts = new Map<string, typeof notCodeDetails.Accounts>()
                        
                        notCodeDetails.Accounts.forEach(account => {
                          // Hesap kodunun ilk 3 hanesini al (örn: "100.1.0" -> "100", "102" -> "102")
                          const codeParts = account.AccountCode.split('.')
                          const firstPart = codeParts.length > 0 ? codeParts[0] : account.AccountCode
                          const groupKey = firstPart.length >= 3 ? firstPart.substring(0, 3) : firstPart
                          
                          if (!groupedAccounts.has(groupKey)) {
                            groupedAccounts.set(groupKey, [])
                          }
                          groupedAccounts.get(groupKey)!.push(account)
                        })
                        
                        // Grupları sırala ve render et
                        const sortedGroups = Array.from(groupedAccounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                        const rows: JSX.Element[] = []
                        
                        sortedGroups.forEach(([groupKey, accounts], groupIndex) => {
                          // Grup hesaplarını ekle
                          accounts.forEach((account, accountIndex) => {
                            const isNegative = account.Total < 0
                            rows.push(
                              <tr
                                key={`${groupKey}-${accountIndex}`}
                                className="hover:bg-gray-900/50 border-b border-gray-800"
                              >
                                <td className="py-2 px-3 border border-gray-700 text-white font-mono text-xs">
                                  {account.AccountCode}
                                </td>
                                <td className="py-2 px-3 border border-gray-700 text-gray-300 text-xs">
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
                          })
                          
                          // Grup toplamını hesapla
                          const groupTotal: { [key: string]: number } = { Total: 0 }
                          notCodeDetails.Periods.forEach(period => {
                            const periodTotal = accounts.reduce((sum, acc) => sum + (acc.Values[`${period.month}`] || 0), 0)
                            groupTotal[`${period.month}`] = periodTotal
                            groupTotal.Total += periodTotal
                          })
                          
                          const isGroupTotalNegative = groupTotal.Total < 0
                          
                          // Grup toplam satırını ekle
                          rows.push(
                            <tr
                              key={`total-${groupKey}`}
                              className="bg-yellow-500/30 font-bold border-b-2 border-gray-600"
                            >
                              <td className="py-2 px-3 border border-gray-700 text-yellow-200 font-mono text-xs">
                                {groupKey} TOPLAM
                              </td>
                              <td className="py-2 px-3 border border-gray-700 text-yellow-200 text-xs">
                                {groupKey} ile başlayan hesapların toplamı
                              </td>
                              {notCodeDetails.Periods.map(period => {
                                const value = groupTotal[`${period.month}`] || 0
                                const isValueNegative = value < 0
                                return (
                                  <td 
                                    key={`${period.year}-${period.month}`} 
                                    className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                                      isValueNegative ? 'text-red-400' : 'text-yellow-200'
                                    }`}
                                    style={{ whiteSpace: 'nowrap' }}
                                  >
                                    {formatBalance(value)}
                                  </td>
                                )
                              })}
                              <td 
                                className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                                  isGroupTotalNegative ? 'text-red-400' : 'text-yellow-200'
                                }`}
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                {formatBalance(groupTotal.Total)}
                              </td>
                            </tr>
                          )
                          
                          // Son grup değilse boş satır ekle
                          if (groupIndex < sortedGroups.length - 1) {
                            rows.push(
                              <tr key={`spacer-${groupKey}`} className="h-2">
                                <td colSpan={2 + notCodeDetails.Periods.length + 1} className="border-0 bg-transparent"></td>
                              </tr>
                            )
                          }
                        })
                        
                        // En altta genel toplam ekle
                        const grandTotal: { [key: string]: number } = { Total: 0 }
                        notCodeDetails.Periods.forEach(period => {
                          const periodTotal = notCodeDetails.Accounts.reduce((sum, acc) => sum + (acc.Values[`${period.month}`] || 0), 0)
                          grandTotal[`${period.month}`] = periodTotal
                          grandTotal.Total += periodTotal
                        })
                        
                        const isGrandTotalNegative = grandTotal.Total < 0
                        
                        rows.push(
                          <tr key="grand-total-spacer" className="h-2">
                            <td colSpan={2 + notCodeDetails.Periods.length + 1} className="border-0 bg-transparent"></td>
                          </tr>
                        )
                        
                        rows.push(
                          <tr
                            key="grand-total"
                            className="bg-blue-500/30 font-bold border-t-2 border-blue-400"
                          >
                            <td className="py-2 px-3 border border-gray-700 text-blue-200 font-mono text-xs">
                              NOT: {selectedNotCode} GENEL TOPLAM
                            </td>
                            <td className="py-2 px-3 border border-gray-700 text-blue-200 text-xs">
                              Tüm hesapların toplamı
                            </td>
                            {notCodeDetails.Periods.map(period => {
                              const value = grandTotal[`${period.month}`] || 0
                              const isValueNegative = value < 0
                              return (
                                <td 
                                  key={`${period.year}-${period.month}`} 
                                  className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                                    isValueNegative ? 'text-red-400' : 'text-blue-200'
                                  }`}
                                  style={{ whiteSpace: 'nowrap' }}
                                >
                                  {formatBalance(value)}
                                </td>
                              )
                            })}
                            <td 
                              className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${
                                isGrandTotalNegative ? 'text-red-400' : 'text-blue-200'
                              }`}
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              {formatBalance(grandTotal.Total)}
                            </td>
                          </tr>
                        )
                        
                        return rows
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-auto max-h-[75vh]">
                <div className="p-6 space-y-6">
                  {renderBilancoSection(data.varliklar, 'VARLIKLAR')}
                  <div className="border-t border-gray-700 my-4"></div>
                  {renderBilancoSection(data.kaynaklar, 'KAYNAKLAR')}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
