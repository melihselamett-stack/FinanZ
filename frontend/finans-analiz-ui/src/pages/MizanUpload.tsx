import { useEffect, useState, useRef } from 'react'
import { companyApi, mizanApi, Company, MizanUploadResult } from '../services/api'
import * as XLSX from 'xlsx'

interface Period {
  year: number
  month: number
}

export default function MizanUpload() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [periods, setPeriods] = useState<Period[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [periodsLoading, setPeriodsLoading] = useState(false)
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({})
  const [result, setResult] = useState<{ [key: string]: MizanUploadResult | null }>({})
  const [error, setError] = useState<{ [key: string]: string }>({})
  const [dragActive, setDragActive] = useState<{ [key: string]: boolean }>({})
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (selectedCompanyId) {
      loadPeriods()
    } else if (companies.length > 0 && !selectedCompanyId) {
      // Şirket seçilmediyse ilk şirketi seç
      setSelectedCompanyId(companies[0].id)
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

  const loadPeriods = async () => {
    if (!selectedCompanyId) {
      // Şirket seçilmediyse yeni sekme oluştur
      if (!activeTab) {
        handleNewTab()
      }
      return
    }
    setPeriodsLoading(true)
    try {
      const response = await mizanApi.getPeriods(selectedCompanyId)
      const loadedPeriods = response.data
      setPeriods(loadedPeriods)
      if (loadedPeriods.length > 0 && !activeTab) {
        const firstPeriod = loadedPeriods[0]
        const tabKey = `${firstPeriod.year}-${firstPeriod.month}`
        setActiveTab(tabKey)
        setYear(firstPeriod.year)
        setMonth(firstPeriod.month)
      } else if (loadedPeriods.length === 0 && !activeTab) {
        // Eğer hiç dönem yoksa, yeni sekme oluştur
        handleNewTab()
      }
    } catch (error) {
      console.error('Dönemler yüklenirken hata:', error)
      // Hata durumunda da yeni sekme oluştur
      if (!activeTab) {
        handleNewTab()
      }
    } finally {
      setPeriodsLoading(false)
    }
  }

  const handleUpload = async (file: File, uploadYear?: number, uploadMonth?: number) => {
    if (!selectedCompanyId) {
      setError({ ...error, general: 'Lütfen bir şirket seçin' })
      return
    }

    const uploadY = uploadYear || year
    const uploadM = uploadMonth || month
    const tabKey = `${uploadY}-${uploadM}`

    setUploading({ ...uploading, [tabKey]: true })
    setError({ ...error, [tabKey]: '' })
    setResult({ ...result, [tabKey]: null })

    try {
      const response = await mizanApi.upload(selectedCompanyId, uploadY, uploadM, file)
      setResult({ ...result, [tabKey]: response.data })
      // Yükleme başarılı olduğunda dönemleri yeniden yükle ve aktif sekmeyi güncelle
      await loadPeriods()
      // Yüklenen dönemi aktif sekme yap
      setActiveTab(tabKey)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Yükleme başarısız'
      setError({ ...error, [tabKey]: errorMessage })
    } finally {
      setUploading({ ...uploading, [tabKey]: false })
    }
  }

  const handleNewTab = () => {
    const newTabKey = `new-${Date.now()}`
    setActiveTab(newTabKey)
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    setYear(currentYear)
    setMonth(currentMonth)
  }

  const handleTabClick = (period: Period) => {
    const tabKey = `${period.year}-${period.month}`
    setActiveTab(tabKey)
    setYear(period.year)
    setMonth(period.month)
  }

  const handleDeletePeriod = async (period: Period) => {
    if (!selectedCompanyId) return
    if (!confirm(`${period.year} yılı ${months[period.month - 1]} ayı mizanını silmek istediğinize emin misiniz?`)) {
      return
    }

    try {
      await mizanApi.deletePeriod(selectedCompanyId, period.year, period.month)
      await loadPeriods()
      if (periods.length > 1) {
        const remainingPeriods = periods.filter(p => !(p.year === period.year && p.month === period.month))
        if (remainingPeriods.length > 0) {
          handleTabClick(remainingPeriods[0])
        } else {
          setActiveTab(null)
        }
      } else {
        setActiveTab(null)
      }
    } catch (error) {
      console.error('Dönem silinirken hata:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, uploadYear?: number, uploadMonth?: number) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file, uploadYear, uploadMonth)
    }
  }

  const handleDrag = (e: React.DragEvent, tabKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive({ ...dragActive, [tabKey]: true })
    } else if (e.type === 'dragleave') {
      setDragActive({ ...dragActive, [tabKey]: false })
    }
  }

  const handleDrop = (e: React.DragEvent, uploadYear?: number, uploadMonth?: number) => {
    e.preventDefault()
    e.stopPropagation()
    const tabKey = uploadYear && uploadMonth ? `${uploadYear}-${uploadMonth}` : 'current'
    setDragActive({ ...dragActive, [tabKey]: false })
    
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      handleUpload(file, uploadYear, uploadMonth)
    } else {
      setError({ ...error, [tabKey]: 'Sadece Excel dosyaları (.xlsx, .xls) kabul edilir' })
    }
  }

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ]

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

  const downloadTemplate = () => {
    // Excel şablonu oluştur - Backend formatına uygun (A, B, C, D, E, F, G, H kolonları)
    const templateData = [
      // Başlık satırı
      ['Hesap Kodu', 'Hesap Adı', 'Borç', 'Alacak', 'Borç Bakiye', 'Alacak Bakiye', 'Seviye', 'Maliyet Merkezi'],
      // Örnek satırlar
      ['102.10.001', 'Ziraat Bankası', '1.234.567,89', '0,00', '1.234.567,89', '0,00', '3,00', 'Merkez'],
      ['120.01.001', 'Alıcılar', '0,00', '500.000,00', '0,00', '500.000,00', '3,00', 'Satış'],
      ['100.01.001', 'Kasa', '50.000,00', '0,00', '50.000,00', '0,00', '3,00', 'Merkez'],
      ['150.01.001', 'Ticari Mallar', '250.000,00', '0,00', '250.000,00', '0,00', '3,00', 'Depo']
    ]

    // Worksheet oluştur
    const ws = XLSX.utils.aoa_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mizan')

    // Kolon genişliklerini ayarla
    ws['!cols'] = [
      { wch: 15 }, // A: Hesap Kodu
      { wch: 25 }, // B: Hesap Adı
      { wch: 18 }, // C: Borç
      { wch: 18 }, // D: Alacak
      { wch: 18 }, // E: Borç Bakiye
      { wch: 18 }, // F: Alacak Bakiye
      { wch: 10 }, // G: Seviye
      { wch: 20 }  // H: Maliyet Merkezi
    ]

    // Başlık satırını kalın yap
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:H1')
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      ws[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'E0E0E0' } }
      }
    }

    // Dosyayı indir
    const fileName = `Mizan_Sablon_${new Date().getFullYear()}.xlsx`
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
        <a href="/company" className="btn-primary inline-block">
          Şirket Ekle
        </a>
      </div>
    )
  }

  const getTabKey = (period?: Period) => {
    if (period) return `${period.year}-${period.month}`
    if (activeTab && activeTab.startsWith('new-')) return activeTab
    return activeTab || 'new'
  }

  const getCurrentPeriod = () => {
    if (activeTab && !activeTab.startsWith('new-')) {
      const [y, m] = activeTab.split('-').map(Number)
      return { year: y, month: m }
    }
    return { year, month }
  }

  const renderUploadArea = (uploadYear: number, uploadMonth: number) => {
    const tabKey = `${uploadYear}-${uploadMonth}`
    const currentDragActive = dragActive[tabKey] || false
    const currentUploading = uploading[tabKey] || false
    const currentError = error[tabKey] || ''
    const currentResult = result[tabKey] || null

    return (
      <div className="space-y-6">
        {/* Selection Controls */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Şirket</label>
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                className="input-field"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Yıl</label>
              <select
                value={uploadYear}
                onChange={(e) => setYear(Number(e.target.value))}
                className="input-field"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ay</label>
              <select
                value={uploadMonth}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="input-field"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div
          className={`card border-2 border-dashed transition-colors ${
            currentDragActive ? 'border-primary-500 bg-primary-500/10' : 'border-gray-700'
          }`}
          onDragEnter={(e) => handleDrag(e, tabKey)}
          onDragLeave={(e) => handleDrag(e, tabKey)}
          onDragOver={(e) => handleDrag(e, tabKey)}
          onDrop={(e) => handleDrop(e, uploadYear, uploadMonth)}
        >
          <div className="py-12 text-center">
            {currentUploading ? (
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                <p className="text-gray-400">Yükleniyor...</p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">📁</div>
                <p className="text-white font-medium mb-2">
                  Excel dosyanızı buraya sürükleyin
                </p>
                <p className="text-gray-400 text-sm mb-4">veya</p>
                <button
                  onClick={() => {
                    if (!fileInputRefs.current[tabKey]) {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = '.xlsx,.xls'
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (file) handleUpload(file, uploadYear, uploadMonth)
                      }
                      input.click()
                    } else {
                      fileInputRefs.current[tabKey]?.click()
                    }
                  }}
                  className="btn-primary"
                >
                  Dosya Seç
                </button>
                <input
                  ref={(el) => fileInputRefs.current[tabKey] = el}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange(e, uploadYear, uploadMonth)}
                  className="hidden"
                />
                <p className="text-gray-500 text-xs mt-4">
                  Desteklenen formatlar: .xlsx, .xls
                </p>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {currentError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {currentError}
          </div>
        )}

        {/* Result */}
        {currentResult && currentResult.success && (
          <div className="card bg-primary-500/10 border-primary-500/20">
            <div className="flex items-center gap-4">
              <div className="text-4xl">✅</div>
              <div>
                <p className="text-lg font-medium text-white">Yükleme Başarılı!</p>
                <div className="text-sm text-gray-300 mt-1 space-y-1">
                  <p>📊 İşlenen satır: {currentResult.rowsProcessed}</p>
                  <p>➕ Yeni hesap: {currentResult.newAccountsAdded}</p>
                  <p>✏️ Güncellenen: {currentResult.accountsUpdated}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mizan Yükle</h1>
        <p className="text-gray-400 mt-1">Excel dosyanızı yükleyerek mizanı sisteme aktarın</p>
      </div>

      {/* Tabs */}
      <div className="card p-0">
        <div className="flex items-center border-b border-gray-700 overflow-x-auto">
          {periods.map((period) => {
            const tabKey = `${period.year}-${period.month}`
            const isActive = activeTab === tabKey
            return (
              <button
                key={tabKey}
                onClick={() => handleTabClick(period)}
                className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-500 text-primary-400 bg-primary-500/10'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{months[period.month - 1]} {period.year}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePeriod(period)
                    }}
                    className="text-red-400 hover:text-red-300 text-xs"
                    title="Sil"
                  >
                    ✕
                  </button>
                </div>
              </button>
            )
          })}
          <button
            onClick={handleNewTab}
            className={`px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab && activeTab.startsWith('new-')
                ? 'border-primary-500 text-primary-400 bg-primary-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            + Yeni Mizan
          </button>
        </div>

        <div className="p-6">
          {periodsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : activeTab ? (
            renderUploadArea(getCurrentPeriod().year, getCurrentPeriod().month)
          ) : periods.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">Henüz mizan yüklenmemiş. Yeni mizan yüklemek için "Yeni Mizan" butonuna tıklayın</p>
              <button onClick={handleNewTab} className="btn-primary">
                + Yeni Mizan Ekle
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">Bir sekme seçin veya yeni mizan ekleyin</p>
              <button onClick={handleNewTab} className="btn-primary">
                + Yeni Mizan Ekle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Template Info */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-white">📋 Excel Şablon Formatı</h3>
          <button
            onClick={downloadTemplate}
            className="btn-primary text-sm px-4 py-2"
          >
            📥 Şablonu İndir
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2">Kolon</th>
                <th className="pb-2">Alan</th>
                <th className="pb-2">Örnek</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800"><td className="py-2">A</td><td>Hesap Kodu</td><td className="font-mono">102.10.001</td></tr>
              <tr className="border-b border-gray-800"><td className="py-2">B</td><td>Hesap Adı</td><td>Ziraat Bankası</td></tr>
              <tr className="border-b border-gray-800"><td className="py-2">C</td><td>Borç</td><td className="font-mono">1.234.567,89</td></tr>
              <tr className="border-b border-gray-800"><td className="py-2">D</td><td>Alacak</td><td className="font-mono">1.234.567,89</td></tr>
              <tr className="border-b border-gray-800"><td className="py-2">E</td><td>Borç Bakiye</td><td className="font-mono">1.234.567,89</td></tr>
              <tr className="border-b border-gray-800"><td className="py-2">F</td><td>Alacak Bakiye</td><td className="font-mono">- veya 0</td></tr>
              <tr className="border-b border-gray-800"><td className="py-2">G</td><td>Seviye (opsiyonel)</td><td className="font-mono">1,00</td></tr>
              <tr><td className="py-2">H</td><td>Maliyet Merkezi</td><td>Merkez</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Not: Türkçe sayı formatı kullanın (nokta=binlik, virgül=ondalık)
        </p>
      </div>
    </div>
  )
}

