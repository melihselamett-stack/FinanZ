import { useEffect, useState } from 'react'
import { companyApi, gelirTablosuApi, mizanApi, Company, GelirTablosuData, GelirTablosuItem, NotCodeDetailsData } from '../services/api'
import ExcelJS from 'exceljs'

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
  const [selectedCompareYears, setSelectedCompareYears] = useState<number[]>([])
  const [showCompareYearsDropdown, setShowCompareYearsDropdown] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [multiYearData, setMultiYearData] = useState<GelirTablosuData[] | null>(null)
  const [selectedNotCode, setSelectedNotCode] = useState<string | null>(null)
  const [notCodeDetails, setNotCodeDetails] = useState<NotCodeDetailsData | null>(null)
  const [notCodeDetailsList, setNotCodeDetailsList] = useState<NotCodeDetailsData[]>([])
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
        // Seçili yıl bu şirkette yoksa, mizanı olan ilk yıla geçir ki veri gelsin
        if (years.length > 0 && !years.includes(selectedYear)) {
          setSelectedYear(years[0])
        }
      }).catch(() => setAvailableYears(Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)))
    }
  }, [selectedCompanyId, selectedYear, companies, compareYears])

  useEffect(() => {
    if (!compareYears) setMultiYearData(null)
  }, [compareYears])

  useEffect(() => {
    if (!selectedNotCode || !selectedCompanyId) {
      setNotCodeDetails(null)
      setNotCodeDetailsList([])
      return
    }
    if (compareYears && selectedCompanyId && selectedCompareYears.length > 0) {
      loadNotCodeDetailsCompare(selectedCompanyId, selectedNotCode, selectedCompareYears)
    } else {
      setNotCodeDetailsList([])
      loadNotCodeDetails(selectedCompanyId, selectedNotCode, selectedYear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNotCode, selectedCompanyId, selectedYear, compareYears, selectedCompareYears])

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
    if (!selectedCompanyId || selectedCompareYears.length === 0) return
    setDataLoading(true)
    setError(null)
    setMultiYearData(null)
    try {
      const years = [...selectedCompareYears].sort((a, b) => a - b)
      const responses = await Promise.all(
        years.map(y => gelirTablosuApi.getGelirTablosu(selectedCompanyId, y))
      )
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
      setMultiYearData(responses.map((r, i) => toData(r.data, years[i])))
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
    setNotCodeDetailsList([])
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

  const loadNotCodeDetailsCompare = async (companyId: number, notCode: string, years: number[]) => {
    if (years.length === 0) { setNotCodeDetailsList([]); return }
    setNotCodeDetailsLoading(true)
    setError(null)
    setNotCodeDetails(null)
    setNotCodeDetailsList([])
    try {
      const sortedYears = [...years].sort((a, b) => a - b)
      const responses = await Promise.all(
        sortedYears.map(y => gelirTablosuApi.getNotCodeDetails(companyId, notCode, y))
      )
      const toDetails = (responseData: any, year: number): NotCodeDetailsData => ({
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
      setNotCodeDetailsList(responses.map((r, i) => toDetails(r.data, sortedYears[i])))
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'NOT detayları yüklenirken bir hata oluştu'
      setError(errorMessage)
      setNotCodeDetailsList([])
    } finally {
      setNotCodeDetailsLoading(false)
    }
  }

  const getAllNotCodes = (): string[] => {
    const source = multiYearData ? multiYearData[0] : data
    if (!source || !source.items) return []
    const notCodes = new Set<string>()
    source.items.forEach((item: GelirTablosuItem) => {
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
    if (!multiYearData || multiYearData.length === 0 || multiYearData[0].items.length === 0) return null
    const items0 = multiYearData[0].items
    const maps = multiYearData.map(d => {
      const m = new Map<string, GelirTablosuItem>()
      d.items.forEach(it => m.set(`${it.Name}|${it.NotCode ?? ''}`, it))
      return m
    })
    const colWidth = 120
    return (
      <div className="overflow-x-auto overflow-y-auto min-h-0 h-full">
        <table className="text-sm border-collapse table-fixed" style={{ minWidth: 272 + multiYearData.length * colWidth, width: 'max-content' }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 52 }} />
            {multiYearData.map((_, i) => (
              <col key={i} style={{ width: colWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
              <th className="py-2 px-3 text-center border border-gray-700">NOT</th>
              {multiYearData.map((d, i) => (
                <th key={i} className="py-2 px-3 text-right border border-gray-700 bg-primary-500/20">{d.year} Toplam TL</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items0.map((it1, index) => {
              const isCategory = it1.IsCategory && !it1.NotCode
              const isTotal = it1.IsTotal
              const isSubTotal = it1.IsCategory && it1.NotCode === null && index > 0 && items0[index - 1]?.NotCode
              const key = `${it1.Name}|${it1.NotCode ?? ''}`
              const totals = maps.map(m => m.get(key)?.Values?.['Total'] ?? 0)
              return (
                <tr
                  key={index}
                  className={isTotal ? 'bg-yellow-500/30 font-bold' : isCategory || isSubTotal ? 'bg-gray-700/50 font-bold' : 'hover:bg-gray-900/50'}
                >
                  <td className="py-2 px-3 border border-gray-700 truncate text-white" title={it1.Name}>{it1.Name}</td>
                  <td className="py-2 px-3 text-center border border-gray-700 text-gray-300">{it1.NotCode ?? ''}</td>
                  {totals.map((total, i) => (
                    <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${total < 0 ? 'text-red-400' : 'text-gray-300'}`} style={{ whiteSpace: 'nowrap' }}>{formatBalance(total)}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderNotCodeDetailsCompare = (list: NotCodeDetailsData[]) => {
    if (list.length === 0) return <div className="p-6 text-center text-gray-400">Bu NOT kodu için alt hesap bulunamadı.</div>
    const allCodes = new Set<string>()
    list.forEach(d => d.Accounts.forEach(a => allCodes.add(a.AccountCode)))
    const sortedCodes = Array.from(allCodes).sort()
    const maps = list.map(d => new Map(d.Accounts.map(a => [a.AccountCode, a])))
    const colWidth = 120
    return (
      <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
        <table className="text-sm border-collapse table-fixed" style={{ minWidth: 320 + list.length * colWidth, width: 'max-content' }}>
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 220 }} />
            {list.map((_, i) => (
              <col key={i} style={{ width: colWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Kodu</th>
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
              {list.map((d, i) => (
                <th key={i} className="py-2 px-3 text-right border border-gray-700 bg-primary-500/20">{d.Year} Toplam TL</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCodes.map((code) => {
              const name = list[0]?.Accounts.find(a => a.AccountCode === code)?.AccountName ?? maps.find(m => m.get(code))?.get(code)?.AccountName ?? ''
              return (
                <tr key={code} className="hover:bg-gray-900/50 border-b border-gray-800">
                  <td className="py-2 px-3 border border-gray-700 text-white font-mono text-xs">{code}</td>
                  <td className="py-2 px-3 border border-gray-700 text-gray-300 text-xs truncate" title={name}>{name}</td>
                  {maps.map((m, i) => {
                    const total = m.get(code)?.Total ?? 0
                    return (
                      <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${total < 0 ? 'text-red-400' : 'text-gray-300'}`} style={{ whiteSpace: 'nowrap' }}>{formatBalance(total)}</td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="bg-yellow-500/30 font-bold border-t-2 border-gray-600">
              <td className="py-2 px-3 border border-gray-700 text-yellow-200 font-mono text-xs">TOPLAM</td>
              <td className="py-2 px-3 border border-gray-700 text-yellow-200 text-xs">{selectedNotCode} ile başlayan hesapların toplamı</td>
              {list.map((d, i) => {
                const t = d.Accounts.reduce((s, a) => s + (a.Total || 0), 0)
                return (
                  <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${t < 0 ? 'text-red-400' : 'text-yellow-200'}`} style={{ whiteSpace: 'nowrap' }}>{formatBalance(t)}</td>
                )
              })}
            </tr>
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

  const formatNum = (v: number) => (v == null || Number.isNaN(v) ? 0 : v)

  const exportToExcel = async () => {
    const isCompare = compareYears && multiYearData && multiYearData.length > 0
    const singleData = !isCompare && data?.items?.length

    if (!singleData && !isCompare) {
      setError('Export edilecek veri bulunamadı. Tek yıl için yıl seçin; karşılaştırma için "Yılları karşılaştır"ı işaretleyip yılları seçin ve "Karşılaştırmayı Yükle" deyin.')
      return
    }

    const wb = new ExcelJS.Workbook()
    const companyName = selectedCompany?.companyName || 'Şirket'
    const headerFont = { name: 'Calibri', size: 11, bold: true }
    const titleFont = { name: 'Calibri', size: 14, bold: true }
    const thinBorder = { style: 'thin' as const }
    const borderAll = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }
    const numFmt = '#,##0.00'

    if (isCompare && multiYearData) {
      const years = [...multiYearData].map(d => d.year).sort((a, b) => a - b)
      const sortedData = years.map(y => multiYearData.find(d => d.year === y)!).filter(Boolean) as GelirTablosuData[]
      const colCount = 2 + years.length

      const ws = wb.addWorksheet('Gelir Tablosu', { views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }] })
      ws.mergeCells(1, 1, 1, colCount)
      ws.getCell(1, 1).value = companyName
      ws.getCell(1, 1).font = { ...titleFont, size: 16 }
      ws.getCell(1, 1).alignment = { horizontal: 'left' }
      ws.mergeCells(2, 1, 2, colCount)
      ws.getCell(2, 1).value = 'Gelir Tablosu - Yıllar Karşılaştırmalı (IFRS)'
      ws.getCell(2, 1).font = titleFont
      ws.getCell(2, 1).alignment = { horizontal: 'left' }
      ws.mergeCells(3, 1, 3, colCount)
      ws.getCell(3, 1).value = `Yıllar: ${years.join(', ')}`
      ws.getCell(3, 1).font = headerFont
      ws.getCell(3, 1).alignment = { horizontal: 'left' }

      const headerRow = ws.addRow(['Hesap Adı', 'NOT', ...years.map(y => `${y} Toplam TL`)])
      headerRow.font = { ...headerFont, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      headerRow.eachCell((cell) => { cell.border = borderAll })

      const rowKey = (it: GelirTablosuItem) => `${it.Name}|${it.NotCode ?? ''}`
      const mapsPerYear = sortedData.map(d => {
        const m = new Map<string, GelirTablosuItem>()
        d.items.forEach(it => m.set(rowKey(it), it))
        return m
      })
      const rowOrder = sortedData[0]?.items || []
      rowOrder.forEach(it => {
        const key = rowKey(it)
        const totalVal = (item: GelirTablosuItem | undefined) => item?.Values?.Total ?? item?.Values?.['Total']
        const rowValues: (string | number)[] = [
          it.Name,
          it.NotCode ?? '',
          ...years.map((_, yi) => formatNum(totalVal(mapsPerYear[yi]?.get(key))))
        ]
        const row = ws.addRow(rowValues)
        row.eachCell((cell, colNumber) => {
          cell.border = borderAll
          if (colNumber > 2) cell.numFmt = numFmt
          if (colNumber === 1) cell.alignment = { horizontal: 'left' }
          else if (colNumber > 2) cell.alignment = { horizontal: 'right' }
        })
        if (it.IsTotal) {
          row.font = { bold: true }
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
        } else if (it.IsCategory && !it.NotCode) {
          row.font = { bold: true }
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
        }
      })

      ws.columns = [{ width: 38 }, { width: 8 }, ...years.map(() => ({ width: 16 }))]
    } else if (data?.items) {
      const periods = data.periods || []
      const colCount = 2 + periods.length + 1

      const ws = wb.addWorksheet('Gelir Tablosu', { views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }] })
      ws.mergeCells(1, 1, 1, colCount)
      ws.getCell(1, 1).value = companyName
      ws.getCell(1, 1).font = { ...titleFont, size: 16 }
      ws.getCell(1, 1).alignment = { horizontal: 'left' }
      ws.mergeCells(2, 1, 2, colCount)
      ws.getCell(2, 1).value = 'Gelir Tablosu (IFRS)'
      ws.getCell(2, 1).font = titleFont
      ws.getCell(2, 1).alignment = { horizontal: 'left' }
      ws.mergeCells(3, 1, 3, colCount)
      ws.getCell(3, 1).value = `Rapor yılı: ${data.year}`
      ws.getCell(3, 1).font = headerFont
      ws.getCell(3, 1).alignment = { horizontal: 'left' }

      const headerRow = ws.addRow([
        'Hesap Adı',
        'NOT',
        ...periods.map((p: { month: number }) => (p.month === 0 ? 'Açılış TL' : `${months[p.month - 1]} TL`)),
        'Toplam TL'
      ])
      headerRow.font = { ...headerFont, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      headerRow.eachCell((cell) => { cell.border = borderAll })

      data.items.forEach(it => {
        const row = ws.addRow([
          it.Name,
          it.NotCode ?? '',
          ...periods.map((p: { month: number }) => formatNum(it.Values[`${p.month}`])),
          formatNum(it.Values?.Total ?? it.Values?.['Total'])
        ])
        row.eachCell((cell, colNumber) => {
          cell.border = borderAll
          if (colNumber > 2) cell.numFmt = numFmt
          if (colNumber === 1) cell.alignment = { horizontal: 'left' }
          else if (colNumber > 2) cell.alignment = { horizontal: 'right' }
        })
        if (it.IsTotal) {
          row.font = { bold: true }
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
        } else if (it.IsCategory && !it.NotCode) {
          row.font = { bold: true }
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
        }
      })

      ws.columns = [{ width: 38 }, { width: 8 }, ...Array(periods.length + 1).fill({ width: 14 })]
    }

    const fileName = isCompare && multiYearData?.length
      ? `Gelir_Tablosu_${companyName}_Karsilastirma_${multiYearData.map(d => d.year).sort((a, b) => a - b).join('_')}.xlsx`
      : `Gelir_Tablosu_${companyName}_${data?.year ?? selectedYear}.xlsx`

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    setError(null)
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCompareYearsDropdown(!showCompareYearsDropdown)}
                  className="input-field w-auto min-w-[180px] text-left flex items-center justify-between gap-2"
                >
                  <span>
                    {selectedCompareYears.length === 0
                      ? 'Yılları seçin...'
                      : `${selectedCompareYears.length} yıl seçildi (${[...selectedCompareYears].sort((a,b)=>a-b).join(', ')})`}
                  </span>
                  <span className="text-gray-500">▼</span>
                </button>
                {showCompareYearsDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCompareYearsDropdown(false)} />
                    <div className="absolute left-0 top-full mt-1 z-20 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[200px] py-2">
                      {(availableYears.length > 0 ? availableYears : Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)).map((y) => {
                        const checked = selectedCompareYears.includes(y)
                        return (
                          <label key={y} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedCompareYears(prev =>
                                  prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y].sort((a, b) => a - b)
                                )
                              }}
                              className="rounded border-gray-600"
                            />
                            <span className="text-white">{y}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
              <button type="button" onClick={loadCompareYears} disabled={selectedCompareYears.length === 0 || dataLoading} className="btn-primary">
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
          {((data && data.items && data.items.length > 0) || (multiYearData && multiYearData.length > 0 && (multiYearData[0]?.items?.length ?? 0) > 0)) && (
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
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Yıl karşılaştırmasında da NOT sekmeleri */}
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
          {/* NOT seçiliyse: iki yıl karşılaştırmalı NOT detayı; değilse ana karşılaştırma tablosu */}
          {selectedNotCode ? (
            <div className="card p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-bold text-white">NOT: {selectedNotCode} - Yıllara Göre Alt Hesaplar</h2>
              </div>
              {notCodeDetailsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  <span className="ml-3 text-gray-400">Yükleniyor...</span>
                </div>
              ) : notCodeDetailsList.length > 0 ? (
                renderNotCodeDetailsCompare(notCodeDetailsList)
              ) : !notCodeDetailsLoading ? (
                <div className="card text-center py-12">
                  <p className="text-gray-400">Bu NOT kodu için veri bulunamadı.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto p-6">
                {renderGelirTablosuCompare()}
              </div>
            </div>
          )}
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
