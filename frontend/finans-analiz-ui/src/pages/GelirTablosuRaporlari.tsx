import { useEffect, useState } from 'react'
import { companyApi, gelirTablosuApi, Company, GelirTablosuData, GelirTablosuItem } from '../services/api'
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
      loadGelirTablosuData(selectedCompanyId, selectedYear)
    }
  }, [selectedCompanyId, selectedYear, companies])

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

  const formatBalance = (value: number) => {
    if (value === 0) return '0,00'
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const renderGelirTablosu = () => {
    if (!data || !data.items || data.items.length === 0) return null

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
      ['Hesap Adı', 'NOT', ...data.periods.map(p => `${months[p.month - 1]} TL`), 'Toplam TL'],
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="input-field"
          >
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={() => selectedCompanyId && loadGelirTablosuData(selectedCompanyId, selectedYear)}
            className="btn-secondary"
          >
            🔄 Yenile
          </button>
          {data && data.items && data.items.length > 0 && (
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
        <div className="card p-0 overflow-hidden">
          <div className="overflow-auto max-h-[75vh]">
            <div className="p-6">
              {renderGelirTablosu()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
