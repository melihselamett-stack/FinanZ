import { useEffect, useState } from 'react'
import { companyApi, bilancoApi, Company, BilancoData, BilancoItem } from '../services/api'
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
          IsCategory: item.IsCategory || item.isCategory || false,
          IsTotal: item.IsTotal || item.isTotal || false,
          Values: item.Values || item.values || {}
        })) as BilancoItem[],
        kaynaklar: (responseData.Kaynaklar || responseData.kaynaklar || []).map((item: any) => ({
          Name: item.Name || item.name || '',
          AccountCode: item.AccountCode || item.accountCode,
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

  const formatBalance = (value: number) => {
    if (value === 0) return '0,00'
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const exportToExcel = () => {
    if (!data || !data.varliklar || !data.kaynaklar) {
      setError('Export edilecek veri bulunamadı')
      return
    }

    const excelData: any[] = []
    
    // Başlık satırı
    const headers = ['Hesap Adı']
    data.periods.forEach(period => {
      headers.push(`${months[period.month - 1]} ${period.year}`)
    })
    headers.push('Toplam')
    
    excelData.push(headers)

    // VARLIKLAR bölümü
    excelData.push(['VARLIKLAR'])
    data.varliklar.forEach(item => {
      const row: any[] = [item.Name]
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
    excelData.push(['KAYNAKLAR'])
    data.kaynaklar.forEach(item => {
      const row: any[] = [item.Name]
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
    const colWidths = [{ wch: 40 }] // Hesap Adı
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
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
              {data?.periods.map(period => (
                <th key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700">
                  {months[period.month - 1]} {period.year}
                </th>
              ))}
              <th className="py-2 px-3 text-right border border-gray-700">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={index}
                className={`${
                  item.IsTotal || item.IsCategory
                    ? 'bg-yellow-500/20 font-bold'
                    : 'hover:bg-gray-900/50'
                }`}
              >
                <td className="py-2 px-3 border border-gray-700 text-white">
                  {item.Name}
                </td>
                {data?.periods.map(period => {
                  const value = item.Values[`${period.month}`] || 0
                  return (
                    <td key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700 text-gray-300 font-mono text-xs">
                      {formatBalance(value)}
                    </td>
                  )
                })}
                <td className="py-2 px-3 text-right border border-gray-700 text-gray-300 font-mono text-xs">
                  {formatBalance(item.Values.Total || 0)}
                </td>
              </tr>
            ))}
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
    </div>
  )
}
