import { useEffect, useState } from 'react'
import { companyApi, bilancoApi, bilancoParameterApi, mizanApi, Company, BilancoData, BilancoItem, NotCodeDetailsData, NotCodeDetail, BilancoParameter, BilancoReportRow, BilancoReportRowsData } from '../services/api'
import ExcelJS from 'exceljs'

export default function BilancoRaporlari() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [data, setData] = useState<BilancoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [compareYears, setCompareYears] = useState(false)
  const [selectedCompareYears, setSelectedCompareYears] = useState<number[]>([])
  const [showCompareYearsDropdown, setShowCompareYearsDropdown] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [multiYearData, setMultiYearData] = useState<BilancoData[] | null>(null)
  const [selectedNotCode, setSelectedNotCode] = useState<string | null>(null)
  const [notCodeDetails, setNotCodeDetails] = useState<NotCodeDetailsData | null>(null)
  const [notCodeDetailsList, setNotCodeDetailsList] = useState<NotCodeDetailsData[]>([])
  const [notCodeDetailsLoading, setNotCodeDetailsLoading] = useState(false)
  // Bilanço Parametre Ayarları state'leri
  const [parameters, setParameters] = useState<BilancoParameter[]>([])
  const [parametersLoading, setParametersLoading] = useState(false)
  const [parametersSaving, setParametersSaving] = useState(false)
  const [parametersError, setParametersError] = useState<string | null>(null)
  const [editingParam, setEditingParam] = useState<BilancoParameter | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showParametersSection, setShowParametersSection] = useState(false)
  const [reportRows, setReportRows] = useState<BilancoReportRowsData | null>(null)
  const [reportRowsLoading, setReportRowsLoading] = useState(false)
  const [showReportRows, setShowReportRows] = useState(false)
  const [editingReportRow, setEditingReportRow] = useState<BilancoReportRow | null>(null)

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
      if (!compareYears) {
        loadBilancoData(selectedCompanyId, selectedYear)
      }
      loadParameters(selectedCompanyId)
      if (showParametersSection) {
        loadReportRows(selectedCompanyId, selectedYear)
      }
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
    if (compareYears && selectedCompareYears.length > 0) {
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

  const loadCompareYears = async () => {
    if (!selectedCompanyId || selectedCompareYears.length === 0) return
    setDataLoading(true)
    setError(null)
    setMultiYearData(null)
    try {
      const years = [...selectedCompareYears].sort((a, b) => a - b)
      const responses = await Promise.all(
        years.map(y => bilancoApi.getBilanco(selectedCompanyId, y))
      )
      const toData = (responseData: any, year: number): BilancoData => ({
        year: responseData.Year ?? responseData.year ?? year,
        periods: responseData.Periods ?? responseData.periods ?? [],
        varliklar: (responseData.Varliklar ?? responseData.varliklar ?? []).map((item: any) => ({
          Name: item.Name ?? item.name ?? '',
          AccountCode: item.AccountCode ?? item.accountCode,
          NotCode: item.NotCode ?? item.notCode,
          IsCategory: item.IsCategory ?? item.isCategory ?? false,
          IsTotal: item.IsTotal ?? item.isTotal ?? false,
          Values: item.Values ?? item.values ?? {}
        })) as BilancoItem[],
        kaynaklar: (responseData.Kaynaklar ?? responseData.kaynaklar ?? []).map((item: any) => ({
          Name: item.Name ?? item.name ?? '',
          AccountCode: item.AccountCode ?? item.accountCode,
          NotCode: item.NotCode ?? item.notCode,
          IsCategory: item.IsCategory ?? item.isCategory ?? false,
          IsTotal: item.IsTotal ?? item.isTotal ?? false,
          Values: item.Values ?? item.values ?? {}
        })) as BilancoItem[]
      })
      setMultiYearData(responses.map((r, i) => toData(r.data, years[i])))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Karşılaştırma yüklenirken hata oluştu'
      setError(msg)
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

  const loadNotCodeDetailsCompare = async (companyId: number, notCode: string, years: number[]) => {
    if (years.length === 0) {
      setNotCodeDetailsList([])
      return
    }
    setNotCodeDetailsLoading(true)
    setError(null)
    setNotCodeDetails(null)
    setNotCodeDetailsList([])
    try {
      const sortedYears = [...years].sort((a, b) => a - b)
      const responses = await Promise.all(
        sortedYears.map(y => bilancoApi.getNotCodeDetails(companyId, notCode, y))
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

  const loadParameters = async (companyId: number) => {
    setParametersLoading(true)
    setParametersError(null)
    try {
      const response = await bilancoParameterApi.getParameters(companyId)
      setParameters(response.data)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Parametreler yüklenirken bir hata oluştu'
      setParametersError(errorMessage)
      console.error('Parametreler yüklenirken hata:', err)
    } finally {
      setParametersLoading(false)
    }
  }

  const loadReportRows = async (companyId: number, year: number) => {
    setReportRowsLoading(true)
    try {
      const response = await bilancoParameterApi.getReportRows(companyId, year)
      console.log('Report rows response:', response)
      // Response'u kontrol et ve varsayılan değerler ekle
      const data = response.data as any
      console.log('Report rows data:', data)
      console.log('Varliklar raw:', data?.Varliklar || data?.varliklar)
      console.log('Kaynaklar raw:', data?.Kaynaklar || data?.kaynaklar)
      
      // Veriyi normalize et - backend'den gelen veri yapısını kontrol et
      const varliklar = (data?.Varliklar || data?.varliklar || []).map((row: any) => ({
        NotCode: row.NotCode || row.notCode || '',
        AccountName: row.AccountName || row.accountName || '',
        Section: row.Section || row.section || 'Varliklar',
        SubSection: row.SubSection || row.subSection || '',
        AccountCodes: row.AccountCodes || row.accountCodes || [],
        AccountCodePrefixes: row.AccountCodePrefixes || row.accountCodePrefixes || []
      }))
      
      const kaynaklar = (data?.Kaynaklar || data?.kaynaklar || []).map((row: any) => ({
        NotCode: row.NotCode || row.notCode || '',
        AccountName: row.AccountName || row.accountName || '',
        Section: row.Section || row.section || 'Kaynaklar',
        SubSection: row.SubSection || row.subSection || '',
        AccountCodes: row.AccountCodes || row.accountCodes || [],
        AccountCodePrefixes: row.AccountCodePrefixes || row.accountCodePrefixes || []
      }))
      
      const reportData = {
        Year: data?.Year || data?.year || year,
        Varliklar: varliklar,
        Kaynaklar: kaynaklar
      }
      console.log('Processed report data:', reportData)
      console.log('Varliklar processed:', varliklar)
      console.log('Kaynaklar processed:', kaynaklar)
      setReportRows(reportData)
    } catch (err: unknown) {
      console.error('Bilanço rapor satırları yüklenirken hata:', err)
      setReportRows(null)
    } finally {
      setReportRowsLoading(false)
    }
  }

  const handleSaveParameters = async (showAlert: boolean = true) => {
    if (!selectedCompanyId) return

    setParametersSaving(true)
    setParametersError(null)
    try {
      await bilancoParameterApi.updateParameters(selectedCompanyId, parameters)
      setEditingParam(null)
      setShowAddForm(false)
      
      // Önce parametreleri yeniden yükle (güncel veriyi almak için)
      await loadParameters(selectedCompanyId)
      
      // Bilanço verisini yeniden yükle (yeni parametreler bilanço raporuna eklenecek)
      await loadBilancoData(selectedCompanyId, selectedYear)
      
      // Rapor satırlarını yeniden yükle (yeni parametreler burada görünecek)
      await loadReportRows(selectedCompanyId, selectedYear)
      
      if (selectedNotCode) {
        if (compareYears && selectedCompareYears.length > 0) {
          await loadNotCodeDetailsCompare(selectedCompanyId, selectedNotCode, selectedCompareYears)
        } else {
          await loadNotCodeDetails(selectedCompanyId, selectedNotCode, selectedYear)
        }
      }
      
      // Eğer rapor satırları bölümü açıksa, otomatik olarak göster
      if (!showReportRows) {
        setShowReportRows(true)
      }
      
      if (showAlert) {
        alert('Parametreler başarıyla kaydedildi! Bilanço raporu, NOT sekmeleri ve rapor satırları güncellendi.')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Parametreler kaydedilirken bir hata oluştu'
      setParametersError(errorMessage)
      console.error('Parametreler kaydedilirken hata:', err)
    } finally {
      setParametersSaving(false)
    }
  }

  const handleResetParameters = async () => {
    if (!selectedCompanyId) return
    if (!confirm('Tüm parametreler varsayılan değerlere sıfırlanacak. Devam etmek istiyor musunuz?')) return

    setParametersSaving(true)
    setParametersError(null)
    try {
      await bilancoParameterApi.resetToDefaults(selectedCompanyId)
      await loadParameters(selectedCompanyId)
      // Parametreler sıfırlandıktan sonra bilanço verisini yeniden yükle
      await loadBilancoData(selectedCompanyId, selectedYear)
      alert('Parametreler varsayılan değerlere sıfırlandı!')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Parametreler sıfırlanırken bir hata oluştu'
      setParametersError(errorMessage)
      console.error('Parametreler sıfırlanırken hata:', err)
    } finally {
      setParametersSaving(false)
    }
  }

  const handleEditParam = (param: BilancoParameter) => {
    setEditingParam({ ...param })
    setShowAddForm(true)
  }

  const handleAddParam = () => {
    setEditingParam({
      NotCode: '',
      Section: 'Varliklar',
      AccountName: '',
      DisplayOrder: parameters.length + 1,
      AccountCodePrefixes: []
    })
    setShowAddForm(true)
  }

  const handleDeleteParam = (notCode: string, section: string) => {
    if (!confirm('Bu parametreyi silmek istediğinizden emin misiniz?')) return
    setParameters(prev => prev.filter(p => !(p.NotCode === notCode && p.Section === section)))
  }

  const handleSaveEditParam = async () => {
    if (!editingParam) return

    if (!editingParam.NotCode || !editingParam.AccountName) {
      setParametersError('NOT kodu ve Hesap Adı zorunludur')
      return
    }

    const existingIndex = parameters.findIndex(
      p => p.NotCode === editingParam.NotCode && p.Section === editingParam.Section
    )

    if (existingIndex >= 0) {
      // Güncelle - eğer NOT kodu değiştiyse, eski kaydı sil ve yeni ekle
      const oldParam = parameters[existingIndex]
      if (oldParam.NotCode !== editingParam.NotCode || oldParam.Section !== editingParam.Section) {
        // NOT kodu veya bölüm değişti, eski kaydı sil
        setParameters(prev => prev.filter(p => !(p.NotCode === oldParam.NotCode && p.Section === oldParam.Section)))
        // Yeni kayıt ekle
        setParameters(prev => [...prev, editingParam])
      } else {
        // Sadece içerik güncellendi
        setParameters(prev => {
          const updated = [...prev]
          updated[existingIndex] = editingParam
          return updated
        })
      }
    } else {
      // Yeni ekle
      setParameters(prev => [...prev, editingParam])
    }

    setEditingParam(null)
    setShowAddForm(false)
    setParametersError(null)
    
    // Parametreleri backend'e kaydet ve tüm verileri güncelle (alert gösterme, çünkü modal'dan çağrılıyor)
    await handleSaveParameters(false)
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

  const formatBalance = (value: number) => {
    if (value === 0) return '0,00'
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const getAllNotCodes = (): string[] => {
    const source = multiYearData ? multiYearData[0] : data
    if (!source) return []
    const notCodes = new Set<string>()
    const allItems = (source.varliklar || []).concat(source.kaynaklar || [])
    allItems.forEach((item: BilancoItem) => {
      if (item.NotCode) notCodes.add(item.NotCode)
    })
    return Array.from(notCodes).sort()
  }

  const formatNum = (v: number) => (v == null || Number.isNaN(v) ? 0 : v)

  const exportToExcel = async () => {
    const isCompare = compareYears && multiYearData && multiYearData.length > 0
    const singleData = !isCompare && data && data.varliklar && data.kaynaklar

    if (!singleData && !isCompare) {
      setError('Export edilecek veri bulunamadı. Tek yıl için yıl seçin; karşılaştırma için "Yılları karşılaştır"ı işaretleyip yılları seçin.')
      return
    }

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Bilanço', { views: [{ state: 'frozen', ySplit: 5, activeCell: 'A6' }] })

    const companyName = selectedCompany?.companyName || 'Şirket'
    const headerFont = { name: 'Calibri', size: 11, bold: true }
    const titleFont = { name: 'Calibri', size: 14, bold: true }
    const thinBorder = { style: 'thin' as const }
    const borderAll = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }
    const numFmt = '#,##0.00'

    let dataStartRow = 1

    if (isCompare && multiYearData) {
      const years = [...multiYearData].map(d => d.year).sort((a, b) => a - b)
      const sortedData = years.map(y => multiYearData!.find(d => d.year === y)!).filter(Boolean) as BilancoData[]
      const colCountCompare = 2 + years.length

      ws.mergeCells(1, 1, 1, colCountCompare)
      const titleCell = ws.getCell(1, 1)
      titleCell.value = companyName
      titleCell.font = { ...titleFont, size: 16 }
      titleCell.alignment = { horizontal: 'left' }

      ws.mergeCells(2, 1, 2, colCountCompare)
      ws.getCell(2, 1).value = 'Bilanço - Yıllar Karşılaştırmalı (IFRS)'
      ws.getCell(2, 1).font = titleFont
      ws.getCell(2, 1).alignment = { horizontal: 'left' }

      ws.mergeCells(3, 1, 3, colCountCompare)
      ws.getCell(3, 1).value = `Yıllar: ${years.join(', ')}`
      ws.getCell(3, 1).font = headerFont
      ws.getCell(3, 1).alignment = { horizontal: 'left' }
      dataStartRow = 5

      // Başlıklar ekrandaki gibi: "2024 Toplam TL", "2025 Toplam TL"
      const headerRow = ws.addRow(['Hesap Adı', 'NOT', ...years.map(y => `${y} Toplam TL`)])
      headerRow.font = { ...headerFont, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      headerRow.eachCell((cell) => { cell.border = borderAll })

      // Satır sırası ve değerler ekrandaki gibi: ilk yılın satır sırası, her yıl için Total (Hesap Adı+NOT ile eşleşen)
      const addCompareRows = (itemsPerYear: BilancoItem[][]) => {
        const rowKey = (it: BilancoItem) => `${it.Name}|${it.NotCode ?? ''}`
        const mapsPerYear = itemsPerYear.map(arr => {
          const m = new Map<string, BilancoItem>()
          arr.forEach(it => m.set(rowKey(it), it))
          return m
        })
        const rowOrder = itemsPerYear[0] || []
        rowOrder.forEach(it => {
          const key = rowKey(it)
          const rowValues: (string | number)[] = [
            it.Name,
            it.NotCode ?? '',
            ...years.map((_, yi) => {
              const item = mapsPerYear[yi]?.get(key)
              const total = item?.Values?.Total ?? item?.Values?.['Total']
              return formatNum(total)
            })
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
      }

      const varlikTitleRow = ws.addRow(['VARLIKLAR', '', ...Array(years.length).fill('')])
      varlikTitleRow.font = headerFont
      varlikTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      varlikTitleRow.eachCell((cell) => { cell.border = borderAll })
      addCompareRows(sortedData.map(yd => yd.varliklar || []))

      ws.addRow([]).height = 8

      const kaynakTitleRow = ws.addRow(['KAYNAKLAR', '', ...Array(years.length).fill('')])
      kaynakTitleRow.getCell(1).value = 'KAYNAKLAR'
      kaynakTitleRow.font = headerFont
      kaynakTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      kaynakTitleRow.eachCell((cell) => { cell.border = borderAll })
      addCompareRows(sortedData.map(yd => yd.kaynaklar || []))

      // Toplam Varlıklar, Toplam Kaynaklar, Dönem Karı (karşılaştırmalı) - yıl sırasına göre
      const tvRow = ws.addRow(['Toplam Varlıklar', '', ...years.map((_, yi) => formatNum(sortedData[yi]?.varliklar?.find(x => x.IsTotal)?.Values?.Total ?? sortedData[yi]?.varliklar?.find(x => x.IsTotal)?.Values?.['Total']))])
      tvRow.font = { bold: true }
      tvRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      tvRow.eachCell((cell, colNumber) => { cell.border = borderAll; if (colNumber > 2) cell.numFmt = numFmt; cell.alignment = { horizontal: colNumber === 1 ? 'left' : colNumber === 2 ? 'center' : 'right' } })
      const tkRow = ws.addRow(['Toplam Kaynaklar', '', ...years.map((_, yi) => formatNum(sortedData[yi]?.kaynaklar?.find(x => x.IsTotal)?.Values?.Total ?? sortedData[yi]?.kaynaklar?.find(x => x.IsTotal)?.Values?.['Total']))])
      tkRow.font = { bold: true }
      tkRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      tkRow.eachCell((cell, colNumber) => { cell.border = borderAll; if (colNumber > 2) cell.numFmt = numFmt; cell.alignment = { horizontal: colNumber === 1 ? 'left' : colNumber === 2 ? 'center' : 'right' } })
      const donemKariCompare = years.map((_, yi) => {
        const tv = sortedData[yi]?.varliklar?.find(x => x.IsTotal)?.Values?.Total ?? sortedData[yi]?.varliklar?.find(x => x.IsTotal)?.Values?.['Total'] ?? 0
        const tk = sortedData[yi]?.kaynaklar?.find(x => x.IsTotal)?.Values?.Total ?? sortedData[yi]?.kaynaklar?.find(x => x.IsTotal)?.Values?.['Total'] ?? 0
        return formatNum(tv + tk)
      })
      const dkRow = ws.addRow(['Dönem Karı', '', ...donemKariCompare])
      dkRow.font = { bold: true }
      dkRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }
      dkRow.eachCell((cell, colNumber) => { cell.border = borderAll; if (colNumber > 2) cell.numFmt = numFmt; cell.alignment = { horizontal: colNumber === 1 ? 'left' : colNumber === 2 ? 'center' : 'right' } })

      ws.columns = [
        { width: 38 },
        { width: 8 },
        ...years.map(() => ({ width: 16 }))
      ]
    } else if (data) {
      ws.mergeCells(1, 1, 1, 2 + (data.periods?.length || 0) + 1)
      ws.getCell(1, 1).value = companyName
      ws.getCell(1, 1).font = { ...titleFont, size: 16 }
      ws.getCell(1, 1).alignment = { horizontal: 'left' }

      ws.mergeCells(2, 1, 2, 2 + (data.periods?.length || 0) + 1)
      ws.getCell(2, 1).value = 'Bilanço (IFRS)'
      ws.getCell(2, 1).font = titleFont
      ws.getCell(2, 1).alignment = { horizontal: 'left' }

      ws.mergeCells(3, 1, 3, 2 + (data.periods?.length || 0) + 1)
      ws.getCell(3, 1).value = `Rapor tarihi: ${data.year}`
      ws.getCell(3, 1).font = headerFont
      ws.getCell(3, 1).alignment = { horizontal: 'left' }
      dataStartRow = 5

      const periods = data.periods || []
      const headerRow = ws.addRow([
        'Hesap Adı',
        'NOT',
        ...periods.map((p: { month: number }) => p.month === 0 ? 'Açılış TL' : `${months[p.month - 1]} TL`),
        'Toplam TL'
      ])
      headerRow.font = { ...headerFont, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      headerRow.eachCell((cell) => { cell.border = borderAll })

      const addRows = (items: BilancoItem[]) => {
        items.forEach(item => {
          const row = ws.addRow([
            item.Name,
            item.NotCode ?? '',
            ...periods.map((p: { month: number }) => formatNum(item.Values[`${p.month}`])),
            formatNum(item.Values.Total)
          ])
          const isTotal = item.IsTotal
          const isCategory = item.IsCategory && !item.NotCode
          row.eachCell((cell, colNumber) => {
            cell.border = borderAll
            if (colNumber > 2) cell.numFmt = numFmt
            if (colNumber === 1) cell.alignment = { horizontal: 'left' }
            else if (colNumber > 2) cell.alignment = { horizontal: 'right' }
          })
          if (isTotal) {
            row.font = { bold: true }
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
          } else if (isCategory) {
            row.font = { bold: true }
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
          }
        })
      }

      const varlikTitle = ws.addRow(['VARLIKLAR', ''])
      varlikTitle.font = headerFont
      varlikTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      varlikTitle.eachCell((cell) => { cell.border = borderAll })
      addRows(data.varliklar)

      ws.addRow([]).height = 8

      const kaynakTitle = ws.addRow(['KAYNAKLAR', ''])
      kaynakTitle.font = headerFont
      kaynakTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      kaynakTitle.eachCell((cell) => { cell.border = borderAll })
      addRows(data.kaynaklar)

      // Toplam Varlıklar, Toplam Kaynaklar, Dönem Karı (tek yıl)
      const toplamVarlik = data.varliklar?.find(x => x.IsTotal)?.Values ?? {}
      const toplamKaynak = data.kaynaklar?.find(x => x.IsTotal)?.Values ?? {}
      const donemKariValues: { [key: string]: number } = {}
      periods.forEach((p: { month: number }) => {
        donemKariValues[`${p.month}`] = (toplamVarlik[`${p.month}`] ?? 0) + (toplamKaynak[`${p.month}`] ?? 0)
      })
      donemKariValues['Total'] = (toplamVarlik.Total ?? 0) + (toplamKaynak.Total ?? 0)

      const tvRow = ws.addRow(['Toplam Varlıklar', '', ...periods.map((p: { month: number }) => formatNum(toplamVarlik[`${p.month}`])), formatNum(toplamVarlik.Total)])
      tvRow.font = { bold: true }
      tvRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      tvRow.eachCell((cell, colNumber) => { cell.border = borderAll; if (colNumber > 2) cell.numFmt = numFmt; cell.alignment = { horizontal: colNumber === 1 ? 'left' : colNumber === 2 ? 'center' : 'right' } })
      const tkRow = ws.addRow(['Toplam Kaynaklar', '', ...periods.map((p: { month: number }) => formatNum(toplamKaynak[`${p.month}`])), formatNum(toplamKaynak.Total)])
      tkRow.font = { bold: true }
      tkRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
      tkRow.eachCell((cell, colNumber) => { cell.border = borderAll; if (colNumber > 2) cell.numFmt = numFmt; cell.alignment = { horizontal: colNumber === 1 ? 'left' : colNumber === 2 ? 'center' : 'right' } })
      const dkRow = ws.addRow(['Dönem Karı', '', ...periods.map((p: { month: number }) => formatNum(donemKariValues[`${p.month}`])), formatNum(donemKariValues['Total'])])
      dkRow.font = { bold: true }
      dkRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }
      dkRow.eachCell((cell, colNumber) => { cell.border = borderAll; if (colNumber > 2) cell.numFmt = numFmt; cell.alignment = { horizontal: colNumber === 1 ? 'left' : colNumber === 2 ? 'center' : 'right' } })

      ws.columns = [
        { width: 38 },
        { width: 8 },
        ...(periods.length + 1) ? Array(periods.length + 1).fill({ width: 14 }) : [{ width: 14 }]
      ]
    }

    // NOT detaylarını aynı dosyada ayrı sheetler olarak ekle
    const notCodes = getAllNotCodes()
    const companyId = selectedCompanyId!

    for (const notCode of notCodes) {
      try {
        if (isCompare && multiYearData?.length) {
          const years = multiYearData.map(d => d.year).sort((a, b) => a - b)
          const responses = await Promise.all(
            years.map(y => bilancoApi.getNotCodeDetails(companyId, notCode, y))
          )
          const detailsList = responses.map((r, i) => {
            const d = r.data as any
            return {
              NotCode: d.NotCode ?? d.notCode ?? notCode,
              Year: d.Year ?? d.year ?? years[i],
              Periods: d.Periods ?? d.periods ?? [],
              Accounts: (d.Accounts ?? d.accounts ?? []).map((a: any) => ({
                AccountCode: a.AccountCode ?? a.accountCode ?? '',
                AccountName: a.AccountName ?? a.accountName ?? '',
                Values: a.Values ?? a.values ?? {},
                Total: a.Total ?? a.total ?? 0
              }))
            } as NotCodeDetailsData
          })
          if (detailsList.every(d => !d.Accounts?.length)) continue
          const sheetName = `NOT ${notCode}`.slice(0, 31)
          const notWs = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }] })
          notWs.mergeCells(1, 1, 1, 2 + years.length)
          notWs.getCell(1, 1).value = companyName
          notWs.getCell(1, 1).font = { ...titleFont, size: 16 }
          notWs.getCell(2, 1).value = `NOT ${notCode} - Yıllar Karşılaştırmalı`
          notWs.getCell(2, 1).font = titleFont
          notWs.mergeCells(2, 1, 2, 2 + years.length)
          notWs.getCell(3, 1).value = `Yıllar: ${years.join(', ')}`
          notWs.getCell(3, 1).font = headerFont
          notWs.mergeCells(3, 1, 3, 2 + years.length)
          const notHeaderRow = notWs.addRow(['Hesap Kodu', 'Hesap Adı', ...years.map(y => `${y} Toplam TL`)])
          notHeaderRow.font = { ...headerFont, color: { argb: 'FFFFFFFF' } }
          notHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
          notHeaderRow.eachCell((cell) => { cell.border = borderAll })
          const allCodes = new Set<string>()
          detailsList.forEach(d => d.Accounts?.forEach(a => allCodes.add(a.AccountCode)))
          const sortedCodes = Array.from(allCodes).sort()
          const maps = detailsList.map(d => new Map(d.Accounts?.map(a => [a.AccountCode, a]) ?? []))
          for (const code of sortedCodes) {
            const name = detailsList[0]?.Accounts?.find(a => a.AccountCode === code)?.AccountName ?? maps.find(m => m.get(code))?.get(code)?.AccountName ?? ''
            const rowValues: (string | number)[] = [code, name]
            detailsList.forEach((d, i) => {
              const total = maps[i]?.get(code)?.Total ?? 0
              rowValues.push(total)
            })
            const row = notWs.addRow(rowValues)
            row.eachCell((cell, colNumber) => {
              cell.border = borderAll
              if (colNumber > 2) cell.numFmt = numFmt
              if (colNumber <= 2) cell.alignment = { horizontal: 'left' }
              else cell.alignment = { horizontal: 'right' }
            })
          }
          const totalRow = notWs.addRow([
            'TOPLAM',
            `NOT ${notCode} genel toplamı`,
            ...detailsList.map(d => d.Accounts?.reduce((s, a) => s + (a.Total || 0), 0) ?? 0)
          ])
          totalRow.font = { bold: true }
          totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
          totalRow.eachCell((cell, colNumber) => {
            cell.border = borderAll
            if (colNumber > 2) cell.numFmt = numFmt
            cell.alignment = colNumber <= 2 ? { horizontal: 'left' } : { horizontal: 'right' }
          })
          notWs.columns = [{ width: 16 }, { width: 36 }, ...years.map(() => ({ width: 14 }))]
        } else if (data) {
          const res = await bilancoApi.getNotCodeDetails(companyId, notCode, data.year)
          const d = res.data as any
          const detail: NotCodeDetailsData = {
            NotCode: d.NotCode ?? d.notCode ?? notCode,
            Year: d.Year ?? d.year ?? data.year,
            Periods: d.Periods ?? d.periods ?? data.periods ?? [],
            Accounts: (d.Accounts ?? d.accounts ?? []).map((a: any) => ({
              AccountCode: a.AccountCode ?? a.accountCode ?? '',
              AccountName: a.AccountName ?? a.accountName ?? '',
              Values: a.Values ?? a.values ?? {},
              Total: a.Total ?? a.total ?? 0
            }))
          }
          if (!detail.Accounts?.length) continue
          const sheetName = `NOT ${notCode}`.slice(0, 31)
          const notWs = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }] })
          const periods = detail.Periods || []
          notWs.mergeCells(1, 1, 1, 2 + periods.length + 1)
          notWs.getCell(1, 1).value = companyName
          notWs.getCell(1, 1).font = { ...titleFont, size: 16 }
          notWs.getCell(2, 1).value = `NOT ${notCode}`
          notWs.getCell(2, 1).font = titleFont
          notWs.mergeCells(2, 1, 2, 2 + periods.length + 1)
          notWs.getCell(3, 1).value = `Rapor yılı: ${detail.Year}`
          notWs.getCell(3, 1).font = headerFont
          notWs.mergeCells(3, 1, 3, 2 + periods.length + 1)
          const notHeaderRow = notWs.addRow([
            'Hesap Kodu',
            'Hesap Adı',
            ...periods.map((p: { month: number }) => p.month === 0 ? 'Açılış TL' : `${months[p.month - 1]} TL`),
            'Toplam TL'
          ])
          notHeaderRow.font = { ...headerFont, color: { argb: 'FFFFFFFF' } }
          notHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
          notHeaderRow.eachCell((cell) => { cell.border = borderAll })
          for (const acc of detail.Accounts) {
            const row = notWs.addRow([
              acc.AccountCode,
              acc.AccountName,
              ...periods.map((p: { month: number }) => formatNum(acc.Values[`${p.month}`])),
              formatNum(acc.Total)
            ])
            row.eachCell((cell, colNumber) => {
              cell.border = borderAll
              if (colNumber > 2) cell.numFmt = numFmt
              if (colNumber <= 2) cell.alignment = { horizontal: 'left' }
              else cell.alignment = { horizontal: 'right' }
            })
          }
          const totalRow = notWs.addRow([
            'TOPLAM',
            `NOT ${notCode} genel toplamı`,
            ...periods.map((p: { month: number }) => detail.Accounts!.reduce((s, a) => s + formatNum(a.Values[`${p.month}`]), 0)),
            detail.Accounts!.reduce((s, a) => s + (a.Total || 0), 0)
          ])
          totalRow.font = { bold: true }
          totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
          totalRow.eachCell((cell, colNumber) => {
            cell.border = borderAll
            if (colNumber > 2) cell.numFmt = numFmt
            cell.alignment = colNumber <= 2 ? { horizontal: 'left' } : { horizontal: 'right' }
          })
          notWs.columns = [{ width: 16 }, { width: 36 }, ...Array(periods.length + 1).fill({ width: 14 })]
        }
      } catch (err) {
        console.warn(`NOT ${notCode} export atlandı:`, err)
      }
    }

    const fileName = isCompare && multiYearData?.length
      ? `${companyName}_Bilanco_Karsilastirma_${multiYearData.map(d => d.year).sort((a, b) => a - b).join('_')}.xlsx`
      : `${companyName}_Bilanco_${data?.year ?? selectedYear}.xlsx`

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

  const renderBilancoSection = (
    items: BilancoItem[],
    title: string,
    extraRows?: { toplamVarlik: { [key: string]: number }; toplamKaynak: { [key: string]: number }; donemKari: { [key: string]: number } }
  ) => {
    if (!items || items.length === 0) return null

    return (
      <div className="space-y-1">
        <table className="text-sm border-collapse table-fixed min-w-[1200px]" style={{ width: 'max-content' }}>
          <colgroup>
            <col style={{ width: '220px', minWidth: '220px' }} />
            <col style={{ width: '52px', minWidth: '52px' }} />
            {data?.periods.map((period, idx) => (
              <col key={`period-col-main-${period.year}-${period.month}-${idx}`} style={{ width: '90px', minWidth: '90px' }} />
            ))}
            <col style={{ width: '100px', minWidth: '100px' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-800 text-gray-300">
              <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
              <th className="py-2 px-3 text-center border border-gray-700">NOT</th>
              {data?.periods.map(period => (
                <th key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700">
                  {period.month === 0 ? 'Açılış' : months[period.month - 1]} TL
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
                  <td className={`py-2 px-3 border border-gray-700 truncate max-w-[220px] ${
                    isTotal ? 'text-yellow-200' : isCategory || isSubTotal ? 'text-gray-200' : 'text-white'
                  }`} title={item.Name}>
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
            {title === 'KAYNAKLAR' && extraRows && data?.periods && (
              <>
                <tr className="bg-gray-700/50 font-bold border-t border-gray-600">
                  <td className="py-2 px-3 border border-gray-700 text-yellow-200">Toplam Varlıklar</td>
                  <td className="py-2 px-3 text-center border border-gray-700 text-yellow-200"></td>
                  {data.periods.map(period => (
                    <td key={`tv-${period.month}`} className="py-2 px-3 text-right border border-gray-700 font-mono text-xs text-yellow-200" style={{ whiteSpace: 'nowrap' }}>
                      {formatBalance(extraRows.toplamVarlik[`${period.month}`] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right border border-gray-700 font-mono text-xs text-yellow-200" style={{ whiteSpace: 'nowrap' }}>
                    {formatBalance(extraRows.toplamVarlik['Total'] ?? 0)}
                  </td>
                </tr>
                <tr className="bg-gray-700/50 font-bold">
                  <td className="py-2 px-3 border border-gray-700 text-yellow-200">Toplam Kaynaklar</td>
                  <td className="py-2 px-3 text-center border border-gray-700 text-yellow-200"></td>
                  {data.periods.map(period => (
                    <td key={`tk-${period.month}`} className="py-2 px-3 text-right border border-gray-700 font-mono text-xs text-yellow-200" style={{ whiteSpace: 'nowrap' }}>
                      {formatBalance(extraRows.toplamKaynak[`${period.month}`] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right border border-gray-700 font-mono text-xs text-yellow-200" style={{ whiteSpace: 'nowrap' }}>
                    {formatBalance(extraRows.toplamKaynak['Total'] ?? 0)}
                  </td>
                </tr>
                <tr className="bg-primary-500/20 font-bold border-t-2 border-primary-500/50">
                  <td className="py-2 px-3 border border-gray-700 text-primary-200">Dönem Karı</td>
                  <td className="py-2 px-3 text-center border border-gray-700 text-primary-200"></td>
                  {data.periods.map(period => {
                    const value = extraRows.donemKari[`${period.month}`] ?? 0
                    const isNegative = value < 0
                    return (
                      <td
                        key={`donem-${period.year}-${period.month}`}
                        className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${isNegative ? 'text-red-400' : 'text-primary-200'}`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {formatBalance(value)}
                      </td>
                    )
                  })}
                  <td
                    className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs align-top ${(extraRows.donemKari['Total'] ?? 0) < 0 ? 'text-red-400' : 'text-primary-200'}`}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {formatBalance(extraRows.donemKari['Total'] ?? 0)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  const renderBilancoSectionCompare = (dataArr: BilancoData[], title: string) => {
    const itemsKey = title === 'VARLIKLAR' ? 'varliklar' : 'kaynaklar'
    const items0 = (dataArr[0]?.[itemsKey] || []) as BilancoItem[]
    const mapsByKey = dataArr.map(d => {
      const m = new Map<string, BilancoItem>()
      ;(d[itemsKey] || []).forEach((it: BilancoItem) => m.set(`${it.Name}|${it.NotCode ?? ''}`, it))
      return m
    })
    const colWidth = 120
    return (
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: 280 + dataArr.length * colWidth }}>
            <colgroup>
              <col style={{ width: '220px', minWidth: '220px' }} />
              <col style={{ width: '52px', minWidth: '52px' }} />
              {dataArr.map((d, i) => (
                <col key={i} style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-gray-800 text-gray-300">
                <th className="py-2 px-3 text-left border border-gray-700">Hesap Adı</th>
                <th className="py-2 px-3 text-center border border-gray-700">NOT</th>
                {dataArr.map((d, i) => (
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
                const totals = dataArr.map((_, i) => mapsByKey[i].get(key)?.Values?.Total ?? 0)
                return (
                  <tr
                    key={index}
                    className={`${
                      isTotal ? 'bg-yellow-500/30 font-bold'
                        : isCategory || isSubTotal ? 'bg-gray-700/50 font-bold' : 'hover:bg-gray-900/50'
                    }`}
                  >
                    <td className="py-2 px-3 border border-gray-700 truncate max-w-[220px] text-white" title={it1.Name}>{it1.Name}</td>
                    <td className="py-2 px-3 text-center border border-gray-700 text-gray-300">{it1.NotCode ?? ''}</td>
                    {totals.map((total, i) => (
                      <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${total < 0 ? 'text-red-400' : 'text-gray-300'}`} style={{ whiteSpace: 'nowrap' }}>
                        {formatBalance(total)}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {title === 'KAYNAKLAR' && dataArr.length > 0 && (
                <tr className="bg-primary-500/20 font-bold border-t-2 border-primary-500/50">
                  <td className="py-2 px-3 border border-gray-700 text-primary-200">Dönem Karı</td>
                  <td className="py-2 px-3 text-center border border-gray-700 text-primary-200"></td>
                  {dataArr.map((d, i) => {
                    const tv = d.varliklar?.find(x => x.IsTotal)?.Values?.Total ?? 0
                    const tk = d.kaynaklar?.find(x => x.IsTotal)?.Values?.Total ?? 0
                    const donemKari = tv + tk
                    return (
                      <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${donemKari < 0 ? 'text-red-400' : 'text-primary-200'}`} style={{ whiteSpace: 'nowrap' }}>
                        {formatBalance(donemKari)}
                      </td>
                    )
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
      <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
        <table className="text-sm border-collapse table-fixed" style={{ minWidth: 320 + list.length * colWidth, width: 'max-content' }}>
          <colgroup>
            <col style={{ width: '100px' }} />
            <col style={{ width: '220px' }} />
            {list.map((_, i) => (
              <col key={i} style={{ width: `${colWidth}px` }} />
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
                      <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${total < 0 ? 'text-red-400' : 'text-gray-300'}`} style={{ whiteSpace: 'nowrap' }}>
                        {formatBalance(total)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="bg-yellow-500/30 font-bold border-t-2 border-gray-600">
              <td className="py-2 px-3 border border-gray-700 text-yellow-200 font-mono text-xs">TOPLAM</td>
              <td className="py-2 px-3 border border-gray-700 text-yellow-200 text-xs">NOT: {selectedNotCode} genel toplamı</td>
              {list.map((d, i) => {
                const t = d.Accounts.reduce((s, a) => s + (a.Total || 0), 0)
                return (
                  <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${t < 0 ? 'text-red-400' : 'text-yellow-200'}`} style={{ whiteSpace: 'nowrap' }}>
                    {formatBalance(t)}
                  </td>
                )
              })}
            </tr>
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

  const years = availableYears.length > 0 ? availableYears : Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

  const varliklarParams = parameters.filter(p => p.Section === 'Varliklar').sort((a, b) => a.DisplayOrder - b.DisplayOrder)
  const kaynaklarParams = parameters.filter(p => p.Section === 'Kaynaklar').sort((a, b) => a.DisplayOrder - b.DisplayOrder)

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
          {!compareYears && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="input-field w-auto"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={compareYears}
              onChange={(e) => setCompareYears(e.target.checked)}
              className="rounded border-gray-600"
            />
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
                      {years.map((y) => {
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
              <button
                type="button"
                onClick={loadCompareYears}
                disabled={selectedCompareYears.length === 0 || dataLoading}
                className="btn-primary"
              >
                {dataLoading ? 'Yükleniyor...' : 'Karşılaştırmayı Yükle'}
              </button>
            </>
          )}
          <button
            onClick={() => {
              setShowParametersSection(!showParametersSection)
              if (!showParametersSection && selectedCompanyId) {
                loadReportRows(selectedCompanyId, selectedYear)
              }
            }}
            className={`btn-secondary ${showParametersSection ? 'bg-primary-500/20' : ''}`}
          >
            {showParametersSection ? '📋 Parametreleri Gizle' : '⚙️ Parametre Ayarları'}
          </button>
          {showParametersSection && (
            <button
              onClick={() => {
                setShowReportRows(!showReportRows)
                if (!showReportRows && selectedCompanyId) {
                  loadReportRows(selectedCompanyId, selectedYear)
                }
              }}
              className={`btn-secondary text-sm ${showReportRows ? 'bg-primary-500/20' : ''}`}
            >
              {showReportRows ? '📊 Rapor Satırlarını Gizle' : '📊 Rapor Satırlarını Göster'}
            </button>
          )}
          <button
            onClick={() => {
              if (compareYears && selectedCompanyId) loadCompareYears()
              else if (selectedCompanyId) loadBilancoData(selectedCompanyId, selectedYear)
            }}
            className="btn-secondary"
          >
            🔄 Yenile
          </button>
          {((data && data.varliklar && data.varliklar.length > 0) || (multiYearData && multiYearData[0].varliklar.length > 0)) && (
            <button
              onClick={exportToExcel}
              className="btn-primary"
            >
              📥 Excel'e Aktar
            </button>
          )}
        </div>
      </div>

      {/* Bilanço Parametre Ayarları Bölümü */}
      {showParametersSection && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-gray-700 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Bilanço Parametre Ayarları</h2>
              <p className="text-gray-400 mt-1 text-sm">Bilanço raporlarındaki hesap adlarını ve NOT kodlarını düzenleyin</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedCompanyId) {
                    setShowReportRows(true)
                    loadReportRows(selectedCompanyId, selectedYear)
                  }
                }}
                className="btn-secondary text-sm"
                title="Tüm var olan parametreleri (varsayılan + özel) göster"
              >
                📋 Var Olan Parametreleri Göster
              </button>
              <button
                onClick={handleAddParam}
                className="btn-secondary text-sm"
              >
                ➕ Yeni Parametre
              </button>
              <button
                onClick={handleResetParameters}
                className="btn-secondary text-sm"
                disabled={parametersSaving}
              >
                🔄 Varsayılanlara Sıfırla
              </button>
              <button
                onClick={handleSaveParameters}
                disabled={parametersSaving}
                className="btn-primary text-sm"
              >
                {parametersSaving ? 'Kaydediliyor...' : '💾 Kaydet'}
              </button>
            </div>
          </div>

          {parametersError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-center py-2 px-4 rounded">
              {parametersError}
            </div>
          )}

          {parametersLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* VARLIKLAR Bölümü */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">VARLIKLAR</h3>
                {varliklarParams.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Henüz Varlıklar bölümü için parametre tanımlanmamış. "Yeni Parametre" butonuna tıklayarak ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {varliklarParams.map((param) => (
                    <div key={`${param.NotCode}-${param.Section}`} className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700 hover:bg-gray-800/70 transition-colors">
                      <div className="flex-1 flex items-center gap-4">
                        <div className="w-16">
                          <span className="text-primary-400 font-bold text-sm">NOT: {param.NotCode}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-white font-medium">{param.AccountName}</span>
                        </div>
                        <div className="w-32">
                          <span className="text-gray-400 text-xs">
                            {param.AccountCodePrefixes.length} prefix
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 relative">
                        <button
                          onClick={() => handleEditParam(param)}
                          className="p-2 hover:bg-gray-700 rounded transition-colors"
                          title="Düzenle"
                        >
                          <span className="text-gray-400 text-xl">⋯</span>
                        </button>
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </div>

              {/* KAYNAKLAR Bölümü */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">KAYNAKLAR</h3>
                {kaynaklarParams.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Henüz Kaynaklar bölümü için parametre tanımlanmamış. "Yeni Parametre" butonuna tıklayarak ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {kaynaklarParams.map((param) => (
                    <div key={`${param.NotCode}-${param.Section}`} className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700 hover:bg-gray-800/70 transition-colors">
                      <div className="flex-1 flex items-center gap-4">
                        <div className="w-16">
                          <span className="text-primary-400 font-bold text-sm">NOT: {param.NotCode}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-white font-medium">{param.AccountName}</span>
                        </div>
                        <div className="w-32">
                          <span className="text-gray-400 text-xs">
                            {param.AccountCodePrefixes.length} prefix
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 relative">
                        <button
                          onClick={() => handleEditParam(param)}
                          className="p-2 hover:bg-gray-700 rounded transition-colors"
                          title="Düzenle"
                        >
                          <span className="text-gray-400 text-xl">⋯</span>
                        </button>
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Parametre Ekleme/Düzenleme Modal/Form */}
              {showAddForm && editingParam && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
                  setEditingParam(null)
                  setShowAddForm(false)
                }}>
                  <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white">
                        {parameters.find(p => p.NotCode === editingParam.NotCode && p.Section === editingParam.Section) 
                          ? 'Parametre Düzenle - NOT: ' + editingParam.NotCode
                          : 'Yeni Parametre Ekle'}
                      </h3>
                      <button
                        onClick={() => {
                          setEditingParam(null)
                          setShowAddForm(false)
                        }}
                        className="text-gray-400 hover:text-white text-2xl"
                      >
                        ×
                      </button>
                    </div>
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
                    <div className="flex gap-2 pt-4 border-t border-gray-700">
                      {parameters.find(p => p.NotCode === editingParam.NotCode && p.Section === editingParam.Section) && (
                        <button
                          onClick={() => {
                            if (confirm('Bu parametreyi silmek istediğinizden emin misiniz?')) {
                              handleDeleteParam(editingParam.NotCode, editingParam.Section)
                              setEditingParam(null)
                              setShowAddForm(false)
                            }
                          }}
                          className="btn-secondary text-red-400 hover:bg-red-500/20"
                        >
                          🗑️ Sil
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingParam(null)
                          setShowAddForm(false)
                        }}
                        className="btn-secondary flex-1"
                      >
                        İptal
                      </button>
                      <button onClick={handleSaveEditParam} className="btn-primary flex-1">
                        💾 Kaydet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bilanço Rapor Satırları Bölümü */}
      {showParametersSection && showReportRows && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-gray-700 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Bilanço Rapor Satırları</h2>
              <p className="text-gray-400 mt-1 text-sm">Bilanço raporunda görünen tüm satırlar ve onlara giden hesap kodları</p>
            </div>
          </div>

          {reportRowsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : reportRows ? (
            <div className="space-y-6">
              {(!reportRows.Varliklar || reportRows.Varliklar.length === 0) && 
               (!reportRows.Kaynaklar || reportRows.Kaynaklar.length === 0) ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-2">
                    Bu yıl ({reportRows.Year}) için mizan verisi bulunamadı veya leaf hesap bulunamadı.
                  </p>
                  <p className="text-gray-500 text-sm">
                    Lütfen önce mizan verilerini yükleyin.
                  </p>
                </div>
              ) : (
                <>
              {/* VARLIKLAR Bölümü */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">VARLIKLAR</h3>
                {!reportRows.Varliklar || reportRows.Varliklar.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Varlıklar bölümü için satır bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reportRows.Varliklar.map((row, idx) => {
                      const notCode = row?.NotCode || row?.notCode || ''
                      const accountName = row?.AccountName || row?.accountName || ''
                      const subSection = row?.SubSection || row?.subSection || ''
                      const accountCodes = row?.AccountCodes || row?.accountCodes || []
                      
                      // Eğer veri boşsa, bu satırı render etme
                      if (!notCode && !accountName) {
                        console.warn('Boş satır bulundu:', row)
                        return null
                      }
                      
                      return (
                        <div 
                          key={`varlik-${notCode}-${idx}`} 
                          className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer"
                          onDoubleClick={() => setEditingReportRow(row)}
                          title="Çift tıklayarak düzenleyebilirsiniz"
                        >
                          <div className="flex-1 flex items-center gap-4">
                            <div className="w-16">
                              <span className="text-primary-400 font-bold text-sm">NOT: {notCode || '-'}</span>
                            </div>
                            <div className="w-32">
                              <span className="text-gray-400 text-xs">{subSection || '-'}</span>
                            </div>
                            <div className="flex-1">
                              <span className="text-white font-medium">{accountName || '-'}</span>
                            </div>
                            <div className="w-24 text-right">
                              <span className="text-gray-400 text-xs">{accountCodes.length} hesap</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <button
                              onClick={() => setEditingReportRow(row)}
                              className="p-2 hover:bg-gray-700 rounded transition-colors"
                              title="Düzenle"
                            >
                              <span className="text-gray-400 text-xl">⋯</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* KAYNAKLAR Bölümü */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">KAYNAKLAR</h3>
                {!reportRows.Kaynaklar || reportRows.Kaynaklar.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Kaynaklar bölümü için satır bulunamadı. Bu yıl ({reportRows.Year}) için mizan verisi yüklenmiş mi kontrol edin.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reportRows.Kaynaklar.map((row, idx) => {
                      const notCode = row?.NotCode || row?.notCode || ''
                      const accountName = row?.AccountName || row?.accountName || ''
                      const subSection = row?.SubSection || row?.subSection || ''
                      const accountCodes = row?.AccountCodes || row?.accountCodes || []
                      
                      // Eğer veri boşsa, bu satırı render etme
                      if (!notCode && !accountName) {
                        console.warn('Boş satır bulundu:', row)
                        return null
                      }
                      
                      return (
                        <div 
                          key={`kaynak-${notCode}-${idx}`} 
                          className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700 hover:bg-gray-800/70 transition-colors cursor-pointer"
                          onDoubleClick={() => setEditingReportRow(row)}
                          title="Çift tıklayarak düzenleyebilirsiniz"
                        >
                          <div className="flex-1 flex items-center gap-4">
                            <div className="w-16">
                              <span className="text-primary-400 font-bold text-sm">NOT: {notCode || '-'}</span>
                            </div>
                            <div className="w-32">
                              <span className="text-gray-400 text-xs">{subSection || '-'}</span>
                            </div>
                            <div className="flex-1">
                              <span className="text-white font-medium">{accountName || '-'}</span>
                            </div>
                            <div className="w-24 text-right">
                              <span className="text-gray-400 text-xs">{accountCodes.length} hesap</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <button
                              onClick={() => setEditingReportRow(row)}
                              className="p-2 hover:bg-gray-700 rounded transition-colors"
                              title="Düzenle"
                            >
                              <span className="text-gray-400 text-xl">⋯</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Rapor satırları yüklenemedi. Lütfen konsolu kontrol edin.
            </div>
          )}

          {/* Düzenleme Modal/Form */}
          {editingReportRow && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingReportRow(null)}>
              <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Satır Düzenle - NOT: {editingReportRow.NotCode}</h3>
                  <button
                    onClick={() => setEditingReportRow(null)}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Alt Bölüm</label>
                    <input
                      type="text"
                      value={editingReportRow.SubSection}
                      disabled
                      className="input-field bg-gray-900 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Hesap Adı</label>
                    <input
                      type="text"
                      value={editingReportRow.AccountName}
                      onChange={(e) => {
                        setEditingReportRow({ ...editingReportRow, AccountName: e.target.value })
                        // Parametreleri de güncelle
                        const updated = [...parameters]
                        const existing = updated.find(p => p.NotCode === editingReportRow.NotCode && p.Section === editingReportRow.Section)
                        if (existing) {
                          existing.AccountName = e.target.value
                        } else {
                          updated.push({
                            NotCode: editingReportRow.NotCode,
                            Section: editingReportRow.Section,
                            AccountName: e.target.value,
                            DisplayOrder: updated.length + 1,
                            AccountCodePrefixes: editingReportRow.AccountCodePrefixes || []
                          })
                        }
                        setParameters(updated)
                      }}
                      className="input-field"
                      placeholder="Hesap Adı"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Hesap Kodları ({(editingReportRow.AccountCodes || []).length} adet)</label>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-gray-900/50 rounded border border-gray-700">
                      {(editingReportRow.AccountCodes || []).map((code, codeIdx) => (
                        <span key={codeIdx} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded font-mono">
                          {code}
                        </span>
                      ))}
                      {(editingReportRow.AccountCodes || []).length === 0 && (
                        <span className="text-gray-500 text-xs">Hesap kodu bulunamadı</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Prefix'ler</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-900/50 rounded border border-gray-700">
                      {(editingReportRow.AccountCodePrefixes || []).map((prefix, prefixIdx) => (
                        <span key={prefixIdx} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                          {prefix}
                        </span>
                      ))}
                      {(editingReportRow.AccountCodePrefixes || []).length === 0 && (
                        <span className="text-gray-500 text-xs">Prefix tanımlı değil</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => setEditingReportRow(null)}
                      className="btn-secondary flex-1"
                    >
                      Kapat
                    </button>
                    <button
                      onClick={async () => {
                        // Parametreleri kaydet
                        if (!selectedCompanyId) return
                        
                        setParametersSaving(true)
                        setParametersError(null)
                        try {
                          await bilancoParameterApi.updateParameters(selectedCompanyId, parameters)
                          
                          // Önce parametreleri yeniden yükle
                          await loadParameters(selectedCompanyId)
                          
                          // Bilanço verisini yeniden yükle (yeni parametreler bilanço raporuna eklenecek)
                          await loadBilancoData(selectedCompanyId, selectedYear)
                          
                          // Rapor satırlarını yeniden yükle (yeni parametreler burada görünecek)
                          await loadReportRows(selectedCompanyId, selectedYear)
                          
                          if (selectedNotCode) {
                            if (compareYears && selectedCompareYears.length > 0) {
                              await loadNotCodeDetailsCompare(selectedCompanyId, selectedNotCode, selectedCompareYears)
                            } else {
                              await loadNotCodeDetails(selectedCompanyId, selectedNotCode, selectedYear)
                            }
                          }
                          
                          setEditingReportRow(null)
                          alert('Parametreler başarıyla kaydedildi! Bilanço raporu, NOT sekmeleri ve rapor satırları güncellendi.')
                        } catch (err: unknown) {
                          const errorMessage = err instanceof Error ? err.message : 'Parametreler kaydedilirken bir hata oluştu'
                          setParametersError(errorMessage)
                          console.error('Parametreler kaydedilirken hata:', err)
                        } finally {
                          setParametersSaving(false)
                        }
                      }}
                      className="btn-primary flex-1"
                      disabled={parametersSaving}
                    >
                      {parametersSaving ? 'Kaydediliyor...' : '💾 Kaydet ve Kapat'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="card bg-red-500/10 border border-red-500/20 text-red-400 text-center py-4">
          {error}
        </div>
      )}

      {dataLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : multiYearData ? (
        <div className="space-y-0">
          {/* Yıl karşılaştırmasında da NOT sekmeleri */}
          {getAllNotCodes().length > 0 && (
            <div className="card p-0">
              <div className="flex items-center border-b border-gray-700 overflow-x-auto">
                {getAllNotCodes().map((notCode) => {
                  const isActive = selectedNotCode === notCode
                  return (
                    <button
                      key={notCode}
                      onClick={() => setSelectedNotCode(isActive ? null : notCode)}
                      className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                        isActive ? 'border-primary-500 text-primary-400 bg-primary-500/10' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
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
            <div className="card p-0 overflow-hidden">
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
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
                <div className="p-6 space-y-6 min-w-0">
                  {renderBilancoSectionCompare(multiYearData, 'VARLIKLAR')}
                  <div className="border-t border-gray-700 my-4"></div>
                  {renderBilancoSectionCompare(multiYearData, 'KAYNAKLAR')}
                </div>
              </div>
            </div>
          )}
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
                <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
                  <table className="text-sm border-collapse table-fixed min-w-[1000px]" style={{ width: 'max-content' }}>
                    <colgroup>
                      <col style={{ width: '100px', minWidth: '100px' }} />
                      <col style={{ width: '200px', minWidth: '200px' }} />
                      {notCodeDetails.Periods.map((period, idx) => (
                        <col key={`period-col-${period.year}-${period.month}-${idx}`} style={{ width: '90px', minWidth: '90px' }} />
                      ))}
                      <col style={{ width: '100px', minWidth: '100px' }} />
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
              <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
                <div className="p-6 space-y-6 min-w-0">
                  {renderBilancoSection(data.varliklar, 'VARLIKLAR')}
                  <div className="border-t border-gray-700 my-4"></div>
                  {(() => {
                    const toplamVarlik = data.varliklar?.find(x => x.IsTotal)?.Values ?? {}
                    const toplamKaynak = data.kaynaklar?.find(x => x.IsTotal)?.Values ?? {}
                    const donemKariValues: { [key: string]: number } = {}
                    data.periods?.forEach(p => {
                      donemKariValues[`${p.month}`] = (toplamVarlik[`${p.month}`] ?? 0) + (toplamKaynak[`${p.month}`] ?? 0)
                    })
                    donemKariValues['Total'] = (toplamVarlik.Total ?? 0) + (toplamKaynak.Total ?? 0)
                    return renderBilancoSection(data.kaynaklar, 'KAYNAKLAR', {
                      toplamVarlik,
                      toplamKaynak,
                      donemKari: donemKariValues
                    })
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
