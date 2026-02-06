import { useEffect, useState, useRef } from 'react'
import { companyApi, giderRaporlariApi, mizanApi, Company, PropertyInfo, GiderRaporuItem, GiderRaporuGroup, GiderRaporuData, AccountCodeOption, GiderRaporuTemplate } from '../services/api'
import * as XLSX from 'xlsx'

export default function GiderRaporlari() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [data, setData] = useState<GiderRaporuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [compareYears, setCompareYears] = useState(false)
  const [selectedCompareYears, setSelectedCompareYears] = useState<number[]>([])
  const [showCompareYearsDropdown, setShowCompareYearsDropdown] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [multiYearData, setMultiYearData] = useState<GiderRaporuData[] | null>(null)
  
  const [availableProperties, setAvailableProperties] = useState<PropertyInfo[]>([])
  const [groups, setGroups] = useState<GiderRaporuGroup[]>([])
  const [draggedItem, setDraggedItem] = useState<{ groupIndex: number; itemIndex: number } | null>(null)
  const [draggedGroup, setDraggedGroup] = useState<number | null>(null)
  const [accountCodes, setAccountCodes] = useState<{ [key: string]: AccountCodeOption[] }>({})
  const [accountCodeSearch, setAccountCodeSearch] = useState<{ [key: string]: string }>({})
  const [showAccountCodeDropdown, setShowAccountCodeDropdown] = useState<{ [key: string]: boolean }>({})
  const [accountCodesLoading, setAccountCodesLoading] = useState<{ [key: string]: boolean }>({})
  const accountCodeDropdownRef = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const searchTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})
  const requestedPropertyKeysRef = useRef<Set<string>>(new Set())
  
  // Özelliklere Göre Rapor
  const [showPropertySelector, setShowPropertySelector] = useState(false)
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState<number | null>(null)
  const [propertyValues, setPropertyValues] = useState<string[]>([])
  const [propertyValuesLoading, setPropertyValuesLoading] = useState(false)
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [selectedGroupsForMerge, setSelectedGroupsForMerge] = useState<number[]>([])
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeGroupName, setMergeGroupName] = useState('')
  
  // Şablon yönetimi
  const [templates, setTemplates] = useState<GiderRaporuTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templatesLoading, setTemplatesLoading] = useState(false)
  
  // Rapor Yapılandırması görünürlüğü
  const [showReportConfiguration, setShowReportConfiguration] = useState(true)
  // Özellik etiketlerinde gösterilecek muhasebe (hesap) kodları: key = "companyId-propertyIndex-propertyValue"
  const [accountCodesByProperty, setAccountCodesByProperty] = useState<{ [key: string]: AccountCodeOption[] }>({})
  const [accountCodesByPropertyLoading, setAccountCodesByPropertyLoading] = useState<{ [key: string]: boolean }>({})

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
      loadAvailableProperties(selectedCompanyId)
      loadTemplates(selectedCompanyId)
      if (groups.length > 0 && !compareYears) {
        loadGiderRaporuData(selectedCompanyId, selectedYear)
      }
      mizanApi.getPeriods(selectedCompanyId).then(res => {
        const years = [...new Set((res.data || []).map((p: { year: number }) => p.year))].sort((a, b) => b - a)
        setAvailableYears(years.length > 0 ? years : Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i))
        if (years.length > 0 && !years.includes(selectedYear)) setSelectedYear(years[0])
      }).catch(() => setAvailableYears(Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)))
    }
  }, [selectedCompanyId, selectedYear, companies, compareYears])

  useEffect(() => {
    if (!compareYears) setMultiYearData(null)
  }, [compareYears])

  useEffect(() => {
    // Dropdown dışına tıklanınca kapat
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(showAccountCodeDropdown).forEach(key => {
        if (showAccountCodeDropdown[key] && accountCodeDropdownRef.current[key]) {
          if (!accountCodeDropdownRef.current[key]?.contains(event.target as Node)) {
            setShowAccountCodeDropdown(prev => ({ ...prev, [key]: false }))
          }
        }
      })
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      // Cleanup timeouts
      Object.values(searchTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [showAccountCodeDropdown])

  // Özellik etiketleri için muhasebe kodlarını yükle (her benzersiz propertyIndex+propertyValue için)
  useEffect(() => {
    if (!selectedCompanyId || !groups?.length) return
    const keysToFetch: { key: string; propertyIndex: number; propertyValue: string }[] = []
    groups.forEach(g => {
      g.Items?.forEach(item => {
        item.PropertyFilters?.forEach((f: any) => {
          const pi = typeof f.PropertyIndex !== 'undefined' ? Number(f.PropertyIndex) : Number(f.propertyIndex)
          const pv = (f.PropertyValue ?? f.propertyValue ?? '').toString().trim()
          if (!pv || isNaN(pi)) return
          const key = `${selectedCompanyId}-${pi}-${pv}`
          if (!requestedPropertyKeysRef.current.has(key)) {
            requestedPropertyKeysRef.current.add(key)
            keysToFetch.push({ key, propertyIndex: pi, propertyValue: pv })
          }
        })
      })
    })
    keysToFetch.forEach(({ key, propertyIndex, propertyValue }) => {
      setAccountCodesByPropertyLoading(prev => ({ ...prev, [key]: true }))
      giderRaporlariApi.getAccountCodesByProperty(selectedCompanyId, propertyIndex, propertyValue)
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : []
          setAccountCodesByProperty(prev => ({ ...prev, [key]: list }))
        })
        .catch(() => setAccountCodesByProperty(prev => ({ ...prev, [key]: [] })))
        .finally(() => setAccountCodesByPropertyLoading(prev => ({ ...prev, [key]: false })))
    })
  }, [selectedCompanyId, groups])

  // Şirket değişince özellik hesap kodu isteklerini sıfırla
  useEffect(() => {
    requestedPropertyKeysRef.current.clear()
  }, [selectedCompanyId])

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

  const loadAvailableProperties = async (companyId: number) => {
    setPropertiesLoading(true)
    setError(null)
    try {
      console.log('Özellikler yükleniyor, companyId:', companyId)
      const response = await giderRaporlariApi.getAvailableProperties(companyId)
      console.log('Özellikler yüklendi - response:', response)
      console.log('Özellikler yüklendi - data:', response.data)
      console.log('Özellikler yüklendi - type:', typeof response.data, Array.isArray(response.data))
      console.log('Özellikler yüklendi - length:', response.data?.length)
      
      const properties = Array.isArray(response.data) ? response.data : []
      console.log('Özellikler işlendi - properties:', properties)
      setAvailableProperties(properties)
      
      if (properties.length === 0) {
        console.warn('Özellik bulunamadı. Hesap planında özellik değerleri var mı kontrol edin.')
      }
    } catch (error: any) {
      console.error('Özellikler yüklenirken hata:', error)
      console.error('Hata detayları:', error.response?.data || error.message)
      setError('Özellikler yüklenirken bir hata oluştu: ' + (error.response?.data?.message || error.message))
      setAvailableProperties([])
    } finally {
      setPropertiesLoading(false)
    }
  }

  const handlePropertyBasedReport = async (propertyIndex: number) => {
    if (!selectedCompanyId) return
    
    setPropertyValuesLoading(true)
    setSelectedPropertyIndex(propertyIndex)
    setShowPropertySelector(false)
    setError(null)
    
    try {
      const response = await giderRaporlariApi.getAvailableProperties(selectedCompanyId)
      console.log('Özellik seçildi - response:', response)
      console.log('Özellik seçildi - propertyIndex:', propertyIndex)
      
      // Hem büyük hem küçük harf versiyonlarını kontrol et
      const property = response.data.find((p: any) => 
        (p.Index === propertyIndex || p.index === propertyIndex)
      )
      
      console.log('Özellik seçildi - property:', property)
      
      if (property) {
        const propertyValues = property.Values || property.values || []
        console.log('Özellik seçildi - propertyValues:', propertyValues, 'length:', propertyValues.length)
        setPropertyValues(propertyValues)
        
        if (propertyValues.length === 0) {
          setError('Seçilen özellik için değer bulunamadı')
          return
        }
        
        // Seçilen özelliğin değerlerinden otomatik grup oluştur
        const newGroups: GiderRaporuGroup[] = propertyValues.map((value: string, index: number) => ({
          Name: value,
          DisplayOrder: index,
          Items: [{
            Name: value,
            PropertyFilters: [{
              PropertyIndex: propertyIndex,
              PropertyValue: value
            }],
            AccountCodePrefix: ''
          }]
        }))
        
        console.log('Özellik seçildi - newGroups oluşturuldu:', newGroups.length, 'grup')
        console.log('Özellik seçildi - ilk grup örneği:', newGroups[0])
        setGroups(newGroups)
        
        // Gruplar oluşturulduktan sonra otomatik olarak raporu yükle
        if (newGroups.length > 0) {
          // State güncellendikten sonra raporu yükle
          // setGroups async olduğu için, yeni grupları direkt parametre olarak gönder
          setTimeout(() => {
            console.log('Rapor yükleniyor - companyId:', selectedCompanyId, 'year:', selectedYear, 'groups:', newGroups.length)
            // Yeni gruplarla direkt raporu yükle
            loadGiderRaporuData(selectedCompanyId, selectedYear, newGroups)
          }, 300)
        }
      } else {
        console.error('Özellik bulunamadı - propertyIndex:', propertyIndex, 'response.data:', response.data)
        setError('Seçilen özellik bulunamadı')
      }
    } catch (error: any) {
      console.error('Özellik değerleri yüklenirken hata:', error)
      setError('Özellik değerleri yüklenirken bir hata oluştu: ' + (error.response?.data?.message || error.message))
    } finally {
      setPropertyValuesLoading(false)
    }
  }

  const loadAccountCodes = async (companyId: number, key: string, search?: string) => {
    try {
      setAccountCodesLoading(prev => ({ ...prev, [key]: true }))
      const response = await giderRaporlariApi.getAccountCodes(companyId, search)
      const codes = Array.isArray(response.data) ? response.data : []
      setAccountCodes(prev => ({ ...prev, [key]: codes }))
    } catch (error) {
      console.error('Hesap kodları yüklenirken hata:', error)
      setAccountCodes(prev => ({ ...prev, [key]: [] }))
    } finally {
      setAccountCodesLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const loadTemplates = async (companyId: number) => {
    try {
      setTemplatesLoading(true)
      console.log('Şablonlar yükleniyor - companyId:', companyId)
      const response = await giderRaporlariApi.getTemplates(companyId)
      console.log('Şablonlar yüklendi - response:', response)
      console.log('Şablonlar yüklendi - response.data:', response.data)
      console.log('Şablonlar yüklendi - response.data type:', typeof response.data, Array.isArray(response.data))
      
      // Response.data direkt array olabilir veya içinde data olabilir
      let templatesList: GiderRaporuTemplate[] = []
      if (Array.isArray(response.data)) {
        templatesList = response.data
      } else if (response.data && Array.isArray(response.data.data)) {
        templatesList = response.data.data
      } else if (response.data && response.data.templates && Array.isArray(response.data.templates)) {
        templatesList = response.data.templates
      }
      
      console.log('Şablonlar yüklendi - templatesList:', templatesList)
      console.log('Şablonlar yüklendi - templatesList length:', templatesList.length)
      
      // Template'leri normalize et (Id vs id)
      const normalizedTemplates = templatesList.map((t: any) => ({
        Id: t.Id || t.id || 0,
        TemplateName: t.TemplateName || t.templateName || t.TemplateName || '',
        CreatedAt: t.CreatedAt || t.createdAt || '',
        UpdatedAt: t.UpdatedAt || t.updatedAt || ''
      }))
      
      console.log('Şablonlar normalize edildi - normalizedTemplates:', normalizedTemplates)
      setTemplates(normalizedTemplates)
    } catch (error: any) {
      console.error('Şablonlar yüklenirken hata:', error)
      console.error('Hata detayları:', error.response?.data)
      // Migration uygulanmamışsa sessizce boş liste kullan
      if (error.response?.status === 500) {
        console.warn('Şablon tablosu bulunamadı. Migration uygulanmamış olabilir.')
        setTemplates([])
      } else {
        setTemplates([])
      }
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!selectedCompanyId || !templateName.trim()) {
      setError('Şablon adı gereklidir')
      return
    }

    if (groups.length === 0) {
      setError('Kaydedilecek grup bulunamadı')
      return
    }

    try {
      const response = await giderRaporlariApi.saveTemplate(selectedCompanyId, templateName.trim(), groups)
      console.log('Şablon kaydedildi - response:', response.data)
      setShowSaveTemplateDialog(false)
      setTemplateName('')
      setError(null)
      // Şablonları yeniden yükle
      await loadTemplates(selectedCompanyId)
      // Başarı mesajı göster (opsiyonel)
      console.log('Şablon başarıyla kaydedildi:', response.data?.TemplateName || templateName.trim())
    } catch (error: any) {
      console.error('Şablon kaydedilirken hata:', error)
      console.error('Hata detayları:', error.response?.data)
      
      const errorMessage = error.response?.data?.message || error.message || 'Bilinmeyen hata'
      const errorDetails = error.response?.data?.details || ''
      
      // Migration uygulanmamışsa özel mesaj göster
      if (errorMessage.includes('tablosu bulunamadı') || 
          errorMessage.includes('migration') ||
          errorMessage.includes('Invalid object name') ||
          errorMessage.includes('GiderRaporuTemplates') ||
          errorDetails.includes('Invalid object name')) {
        setError('Şablon tablosu bulunamadı. Lütfen backend\'de migration\'ı uygulayın: dotnet ef database update veya SQL script\'i çalıştırın.')
      } else {
        setError('Şablon kaydedilirken bir hata oluştu: ' + errorMessage + (errorDetails ? ' (' + errorDetails + ')' : ''))
      }
    }
  }

  const handleLoadTemplate = async (templateId: number) => {
    if (!selectedCompanyId) {
      console.error('handleLoadTemplate: selectedCompanyId yok')
      return
    }

    console.log('Şablon yükleniyor - templateId:', templateId, 'companyId:', selectedCompanyId)
    
    try {
      const response = await giderRaporlariApi.loadTemplate(selectedCompanyId, templateId)
      console.log('Şablon yüklendi - response:', response)
      console.log('Şablon yüklendi - response.data:', response.data)
      
      // Response formatını kontrol et
      let loadedGroups: GiderRaporuGroup[] = []
      if (response.data) {
        if (Array.isArray(response.data)) {
          loadedGroups = response.data
        } else if (response.data.Groups && Array.isArray(response.data.Groups)) {
          loadedGroups = response.data.Groups
        } else if (response.data.groups && Array.isArray(response.data.groups)) {
          loadedGroups = response.data.groups
        }
      }
      
      console.log('Şablon yüklendi - loadedGroups:', loadedGroups)
      console.log('Şablon yüklendi - loadedGroups length:', loadedGroups.length)
      
      if (loadedGroups.length > 0) {
        // Groups'u normalize et
        const normalizedGroups = loadedGroups.map((group: any, index: number) => ({
          Name: group.Name || group.name || '',
          DisplayOrder: group.DisplayOrder !== undefined ? group.DisplayOrder : (group.displayOrder !== undefined ? group.displayOrder : index),
          Items: (group.Items || group.items || []).map((item: any) => ({
            Name: item.Name || item.name || '',
            PropertyFilters: item.PropertyFilters || item.propertyFilters || [],
            AccountCodePrefix: item.AccountCodePrefix || item.accountCodePrefix || ''
          }))
        }))
        
        console.log('Şablon normalize edildi - normalizedGroups:', normalizedGroups)
        setGroups(normalizedGroups)
        setSelectedTemplateId(templateId)
        // Şablon yüklendiğinde selectedPropertyIndex'i temizle (özellik dropdown'larını gizlemek için)
        setSelectedPropertyIndex(null)
        
        // Şablon yüklendikten sonra raporu yükle
        setTimeout(() => {
          console.log('Rapor yükleniyor - groups:', normalizedGroups.length)
          loadGiderRaporuData(selectedCompanyId, selectedYear, normalizedGroups)
        }, 200)
      } else {
        console.warn('Şablon yüklendi ama grup bulunamadı')
        setError('Şablon yüklendi ancak içerik bulunamadı')
      }
    } catch (error: any) {
      console.error('Şablon yüklenirken hata:', error)
      console.error('Hata detayları:', error.response?.data)
      setError('Şablon yüklenirken bir hata oluştu: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    if (!selectedCompanyId) return
    if (!confirm('Bu şablonu silmek istediğinizden emin misiniz?')) return

    try {
      await giderRaporlariApi.deleteTemplate(selectedCompanyId, templateId)
      await loadTemplates(selectedCompanyId)
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null)
      }
    } catch (error: any) {
      console.error('Şablon silinirken hata:', error)
      setError('Şablon silinirken bir hata oluştu: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleAccountCodeSearch = (groupIndex: number, itemIndex: number, search: string) => {
    const key = `${groupIndex}-${itemIndex}`
    setAccountCodeSearch(prev => ({ ...prev, [key]: search }))
    
    // Önceki timeout'u temizle
    if (searchTimeoutRef.current[key]) {
      clearTimeout(searchTimeoutRef.current[key]!)
    }
    
    // Debounce: 300ms bekle (boş arama için de API çağrısı yap)
    searchTimeoutRef.current[key] = setTimeout(() => {
      if (selectedCompanyId) {
        // Boş arama terimi ile de API çağrısı yap (tüm hesapları göster)
        loadAccountCodes(selectedCompanyId, key, search.trim() || undefined)
      }
    }, 300)
    
    setShowAccountCodeDropdown(prev => ({ ...prev, [key]: true }))
  }

  const handleAccountCodeSelect = (groupIndex: number, itemIndex: number, accountCode: string) => {
    const newGroups = [...groups]
    newGroups[groupIndex].Items[itemIndex].AccountCodePrefix = accountCode
    setGroups(newGroups)
    
    const key = `${groupIndex}-${itemIndex}`
    setShowAccountCodeDropdown(prev => ({ ...prev, [key]: false }))
    setAccountCodeSearch(prev => ({ ...prev, [key]: '' }))
  }

  const loadCompareYears = async () => {
    if (!selectedCompanyId || groups.length === 0 || selectedCompareYears.length === 0) return
    setDataLoading(true)
    setError(null)
    setMultiYearData(null)
    try {
      const years = [...selectedCompareYears].sort((a, b) => a - b)
      const responses = await Promise.all(
        years.map(y => giderRaporlariApi.getGiderRaporu(selectedCompanyId, y, groups))
      )
      const toData = (responseData: any, year: number): GiderRaporuData => ({
        year: responseData.Year ?? responseData.year ?? year,
        periods: responseData.Periods ?? responseData.periods ?? [],
        groups: (responseData.Groups ?? responseData.groups ?? []).map((group: any) => ({
          Name: group.Name ?? group.name ?? '',
          DisplayOrder: group.DisplayOrder ?? group.displayOrder ?? 0,
          Items: (group.Items ?? group.items ?? []).map((item: any) => ({
            Name: item.Name ?? item.name ?? '',
            PropertyFilters: item.PropertyFilters ?? item.propertyFilters,
            AccountCodePrefix: item.AccountCodePrefix ?? item.accountCodePrefix,
            Values: item.Values ?? item.values ?? {}
          })),
          Total: group.Total ?? group.total ?? {}
        }))
      })
      setMultiYearData(responses.map((r, i) => toData(r.data, years[i])))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Karşılaştırma yüklenirken hata oluştu')
    } finally {
      setDataLoading(false)
    }
  }

  const loadGiderRaporuData = async (companyId: number, year: number, customGroups?: GiderRaporuGroup[]) => {
    const groupsToUse = customGroups || groups
    
    if (groupsToUse.length === 0) {
      setData(null)
      return
    }

    setDataLoading(true)
    setError(null)
    try {
      console.log('Rapor yükleniyor - groupsToUse length:', groupsToUse.length, 'groups:', groupsToUse)
      const response = await giderRaporlariApi.getGiderRaporu(companyId, year, groupsToUse)
      const responseData = response.data as any
      
      setData({
        year: responseData.Year || responseData.year || year,
        periods: responseData.Periods || responseData.periods || [],
        groups: (responseData.Groups || responseData.groups || []).map((group: any) => ({
          Name: group.Name || group.name || '',
          DisplayOrder: group.DisplayOrder || group.displayOrder || 0,
          Items: (group.Items || group.items || []).map((item: any) => ({
            Name: item.Name || item.name || '',
            PropertyFilters: item.PropertyFilters || item.propertyFilters,
            AccountCodePrefix: item.AccountCodePrefix || item.accountCodePrefix,
            Values: item.Values || item.values || {}
          })),
          Total: group.Total || group.total || {}
        }))
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Gider raporu yüklenirken bir hata oluştu'
      setError(errorMessage)
      console.error('Gider raporu yüklenirken hata:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleAddGroup = () => {
    const newGroup: GiderRaporuGroup = {
      Name: `Grup ${groups.length + 1}`,
      DisplayOrder: groups.length,
      Items: []
    }
    setGroups([...groups, newGroup])
  }

  const handleDeleteGroup = (groupIndex: number) => {
    if (confirm('Bu grubu silmek istediğinizden emin misiniz?')) {
      const newGroups = groups.filter((_, idx) => idx !== groupIndex)
        .map((g, idx) => ({ ...g, DisplayOrder: idx }))
      setGroups(newGroups)
      setSelectedGroupsForMerge([])
      if (selectedCompanyId) {
        loadGiderRaporuData(selectedCompanyId, selectedYear)
      }
    }
  }

  const handleToggleGroupSelection = (groupIndex: number) => {
    setSelectedGroupsForMerge(prev => {
      if (prev.includes(groupIndex)) {
        return prev.filter(idx => idx !== groupIndex)
      } else {
        return [...prev, groupIndex]
      }
    })
  }

  const handleMergeGroups = () => {
    if (selectedGroupsForMerge.length < 2) {
      setError('Birleştirmek için en az 2 grup seçmelisiniz')
      return
    }

    if (!mergeGroupName.trim()) {
      setError('Birleştirilmiş grup için bir isim girin')
      return
    }

    // Seçilen grupları birleştir
    const selectedGroups = selectedGroupsForMerge
      .sort((a, b) => a - b)
      .map(idx => groups[idx])
    
    // Tüm item'ları birleştir
    const mergedItems: GiderRaporuItem[] = []
    selectedGroups.forEach(group => {
      mergedItems.push(...group.Items)
    })

    // Yeni birleştirilmiş grup oluştur
    const mergedGroup: GiderRaporuGroup = {
      Name: mergeGroupName,
      DisplayOrder: Math.min(...selectedGroupsForMerge),
      Items: mergedItems
    }

    // Eski grupları kaldır ve yeni grubu ekle
    const newGroups = groups
      .filter((_, idx) => !selectedGroupsForMerge.includes(idx))
      .map((g, idx) => ({ ...g, DisplayOrder: idx }))
    
    // Birleştirilmiş grubu doğru pozisyona ekle
    const insertIndex = Math.min(...selectedGroupsForMerge)
    newGroups.splice(insertIndex, 0, mergedGroup)
    newGroups.forEach((g, idx) => { g.DisplayOrder = idx })

    setGroups(newGroups)
    setSelectedGroupsForMerge([])
    setShowMergeDialog(false)
    setMergeGroupName('')
    
    if (selectedCompanyId) {
      loadGiderRaporuData(selectedCompanyId, selectedYear)
    }
  }

  const handleAddItem = (groupIndex: number) => {
    const newGroups = [...groups]
    const newItem: GiderRaporuItem = {
      Name: `Kalem ${newGroups[groupIndex].Items.length + 1}`,
      PropertyFilters: [],
      AccountCodePrefix: ''
    }
    newGroups[groupIndex].Items.push(newItem)
    setGroups(newGroups)
  }

  const handleDeleteItem = (groupIndex: number, itemIndex: number) => {
    if (confirm('Bu kalemi silmek istediğinizden emin misiniz?')) {
      const newGroups = [...groups]
      newGroups[groupIndex].Items = newGroups[groupIndex].Items.filter((_, idx) => idx !== itemIndex)
      setGroups(newGroups)
      if (selectedCompanyId) {
        loadGiderRaporuData(selectedCompanyId, selectedYear)
      }
    }
  }

  const handleAddPropertyFilter = (groupIndex: number, itemIndex: number, propertyIndex: number, propertyValue: string) => {
    const newGroups = [...groups]
    if (!newGroups[groupIndex].Items[itemIndex].PropertyFilters) {
      newGroups[groupIndex].Items[itemIndex].PropertyFilters = []
    }
    newGroups[groupIndex].Items[itemIndex].PropertyFilters!.push({
      PropertyIndex: propertyIndex,
      PropertyValue: propertyValue
    })
    setGroups(newGroups)
  }

  const handleRemovePropertyFilter = (groupIndex: number, itemIndex: number, filterIndex: number) => {
    const newGroups = [...groups]
    if (newGroups[groupIndex].Items[itemIndex].PropertyFilters) {
      newGroups[groupIndex].Items[itemIndex].PropertyFilters = 
        newGroups[groupIndex].Items[itemIndex].PropertyFilters!.filter((_, idx) => idx !== filterIndex)
    }
    setGroups(newGroups)
  }

  const handleDragStart = (groupIndex: number, itemIndex: number) => {
    setDraggedItem({ groupIndex, itemIndex })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetGroupIndex: number, targetItemIndex?: number) => {
    if (!draggedItem) return

    const newGroups = [...groups]
    const dragged = { ...newGroups[draggedItem.groupIndex].Items[draggedItem.itemIndex] }
    
    // Aynı grup ve aynı pozisyonsa işlem yapma
    if (draggedItem.groupIndex === targetGroupIndex && 
        targetItemIndex !== undefined && 
        draggedItem.itemIndex === targetItemIndex) {
      setDraggedItem(null)
      return
    }
    
    // Eski yerden kaldır
    newGroups[draggedItem.groupIndex].Items = newGroups[draggedItem.groupIndex].Items.filter(
      (_, idx) => idx !== draggedItem.itemIndex
    )

    // Yeni yere ekle
    if (targetItemIndex !== undefined) {
      // Eğer aynı grup içindeyse ve hedef index kaydıysa düzelt
      if (draggedItem.groupIndex === targetGroupIndex && targetItemIndex > draggedItem.itemIndex) {
        targetItemIndex -= 1
      }
      newGroups[targetGroupIndex].Items.splice(targetItemIndex, 0, dragged)
    } else {
      newGroups[targetGroupIndex].Items.push(dragged)
    }

    setGroups(newGroups)
    setDraggedItem(null)
    
    if (selectedCompanyId) {
      loadGiderRaporuData(selectedCompanyId, selectedYear)
    }
  }

  const handleGroupDragStart = (groupIndex: number) => {
    setDraggedGroup(groupIndex)
  }

  const handleGroupDrop = (targetGroupIndex: number) => {
    if (draggedGroup === null) return

    const newGroups = [...groups]
    const draggedGroupData = newGroups[draggedGroup]
    const targetGroupData = newGroups[targetGroupIndex]
    
    // Eğer aynı gruba bırakılıyorsa, sadece sıralama yap
    if (draggedGroup === targetGroupIndex) {
      setDraggedGroup(null)
      return
    }
    
    // Taşınan grubun tüm item'larını hedef grubun item'larına ekle
    const mergedItems = [...targetGroupData.Items, ...draggedGroupData.Items]
    newGroups[targetGroupIndex].Items = mergedItems
    
    // Taşınan grubu sil
    newGroups.splice(draggedGroup, 1)
    
    // DisplayOrder'ı güncelle
    newGroups.forEach((g, idx) => {
      g.DisplayOrder = idx
    })

    setGroups(newGroups)
    setDraggedGroup(null)
    
    if (selectedCompanyId) {
      loadGiderRaporuData(selectedCompanyId, selectedYear)
    }
  }

  const formatBalance = (value: number) => {
    if (value === 0) return '0,00'
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const renderRaporCompare = () => {
    if (!multiYearData || multiYearData.length === 0 || multiYearData[0].groups.length === 0) return null
    const d0 = multiYearData[0]
    const colWidth = 120
    return (
      <div className="space-y-6">
        {d0.groups.map((group0, gi) => {
          const groupDataArr = multiYearData.map(d => d.groups[gi]).filter(Boolean)
          if (groupDataArr.length === 0) return null
          const items0 = groupDataArr[0].Items
          const maps = groupDataArr.map(g => {
            const m = new Map<string, GiderRaporuItem>()
            g.Items.forEach(it => m.set(it.Name, it))
            return m
          })
          return (
            <div key={gi} className="card">
              <h3 className="text-lg font-bold text-white mb-4">{group0.Name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: 300 + multiYearData.length * colWidth }}>
                  <colgroup>
                    <col className="w-[300px]" />
                    {multiYearData.map((_, i) => (
                      <col key={i} style={{ width: colWidth }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-800 text-gray-300">
                      <th className="py-2 px-3 text-left border border-gray-700">Kalem Adı</th>
                      {multiYearData.map((d, i) => (
                        <th key={i} className="py-2 px-3 text-right border border-gray-700 bg-primary-500/20">{d.year} Toplam TL</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items0.map((it1, ii) => {
                      const totals = maps.map(m => m.get(it1.Name)?.Values?.Total ?? 0)
                      return (
                        <tr key={ii} className="hover:bg-gray-900/50">
                          <td className="py-2 px-3 border border-gray-700 text-white truncate" title={it1.Name}>{it1.Name}</td>
                          {totals.map((total, i) => (
                            <td key={i} className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${total < 0 ? 'text-red-400' : 'text-gray-300'}`}>{formatBalance(total)}</td>
                          ))}
                        </tr>
                      )
                    })}
                    {groupDataArr.every(g => g.Total) && (
                      <tr className="bg-yellow-500/30 font-bold">
                        <td className="py-2 px-3 border border-gray-700 text-yellow-200">TOPLAM</td>
                        {groupDataArr.map((g, i) => (
                          <td key={i} className="py-2 px-3 text-right border border-gray-700 font-mono text-xs text-yellow-200">{formatBalance(g.Total?.Total ?? 0)}</td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderRapor = () => {
    if (!data || !data.groups || data.groups.length === 0) return null

    return (
      <div className="space-y-6">
        {data.groups.map((group, groupIndex) => (
          <div key={groupIndex} className="card">
            <h3 className="text-lg font-bold text-white mb-4">{group.Name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col className="w-[300px]" />
                  {data.periods.map(() => (
                    <col key={`col-${Math.random()}`} className="w-[120px]" />
                  ))}
                  <col className="w-[120px]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-800 text-gray-300">
                    <th className="py-2 px-3 text-left border border-gray-700">Kalem Adı</th>
                    {data.periods.map(period => (
                      <th key={`${period.year}-${period.month}`} className="py-2 px-3 text-right border border-gray-700">
                        {months[period.month - 1]} TL
                      </th>
                    ))}
                    <th className="py-2 px-3 text-right border border-gray-700">Toplam TL</th>
                  </tr>
                </thead>
                <tbody>
                  {group.Items.map((item, itemIndex) => (
                    <tr key={itemIndex} className="hover:bg-gray-900/50">
                      <td className="py-2 px-3 border border-gray-700 text-white truncate" title={item.Name}>{item.Name}</td>
                      {data.periods.map(period => {
                        const periodKey = `${period.month}`
                        const value = item.Values?.[periodKey] || 0
                        const isNegative = value < 0
                        return (
                          <td 
                            key={`${period.year}-${period.month}`} 
                            className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${
                              isNegative ? 'text-red-400' : 'text-gray-300'
                            }`}
                          >
                            {formatBalance(value)}
                          </td>
                        )
                      })}
                      <td className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${
                        (item.Values?.Total || 0) < 0 ? 'text-red-400' : 'text-gray-300'
                      }`}>
                        {formatBalance(item.Values?.Total || 0)}
                      </td>
                    </tr>
                  ))}
                  {group.Total && (
                    <tr className="bg-yellow-500/30 font-bold">
                      <td className="py-2 px-3 border border-gray-700 text-yellow-200">TOPLAM</td>
                      {data.periods.map(period => {
                        const periodKey = `${period.month}`
                        const value = group.Total![periodKey] || 0
                        const isNegative = value < 0
                        return (
                          <td 
                            key={`${period.year}-${period.month}`} 
                            className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${
                              isNegative ? 'text-red-400' : 'text-yellow-200'
                            }`}
                          >
                            {formatBalance(value)}
                          </td>
                        )
                      })}
                      <td className={`py-2 px-3 text-right border border-gray-700 font-mono text-xs ${
                        (group.Total.Total || 0) < 0 ? 'text-red-400' : 'text-yellow-200'
                      }`}>
                        {formatBalance(group.Total.Total || 0)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const exportToExcel = () => {
    if (!data || !data.groups) {
      setError('Export edilecek veri bulunamadı')
      return
    }

    const wb = XLSX.utils.book_new()
    
    data.groups.forEach((group, groupIndex) => {
      const groupData = [
        ['Kalem Adı', ...data.periods.map(p => `${months[p.month - 1]} TL`), 'Toplam TL'],
        ...group.Items.map(item => [
          item.Name,
          ...data.periods.map(p => {
            const periodKey = `${p.month}`
            return item.Values?.[periodKey] || 0
          }),
          item.Values?.Total || 0
        ])
      ]
      
      if (group.Total) {
        groupData.push([
          'TOPLAM',
          ...data.periods.map(p => {
            const periodKey = `${p.month}`
            return group.Total![periodKey] || 0
          }),
          group.Total.Total || 0
        ])
      }
      
      const ws = XLSX.utils.aoa_to_sheet(groupData)
      XLSX.utils.book_append_sheet(wb, ws, group.Name || `Grup ${groupIndex + 1}`)
    })

    const fileName = `Gider_Raporu_${selectedCompany?.companyName || 'Rapor'}_${data.year}.xlsx`
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
          <h1 className="text-2xl font-bold text-white">Gider Raporları</h1>
          <p className="text-gray-400 mt-1">Özelleştirilebilir gider raporları oluşturun</p>
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
                <button type="button" onClick={() => setShowCompareYearsDropdown(!showCompareYearsDropdown)} className="input-field w-auto min-w-[180px] text-left flex items-center justify-between gap-2">
                  <span>{selectedCompareYears.length === 0 ? 'Yılları seçin...' : `${selectedCompareYears.length} yıl seçildi (${[...selectedCompareYears].sort((a,b)=>a-b).join(', ')})`}</span>
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
                            <input type="checkbox" checked={checked} onChange={() => setSelectedCompareYears(prev => prev.includes(y) ? prev.filter(yr => yr !== y) : [...prev, y].sort((a, b) => a - b))} className="rounded border-gray-600" />
                            <span className="text-white">{y}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
              <button type="button" onClick={loadCompareYears} disabled={selectedCompareYears.length === 0 || groups.length === 0 || dataLoading} className="btn-primary">
                {dataLoading ? 'Yükleniyor...' : 'Karşılaştırmayı Yükle'}
              </button>
            </>
          )}
          <button
            onClick={async () => {
              if (selectedCompanyId) {
                await loadAvailableProperties(selectedCompanyId)
                setShowPropertySelector(true)
              }
            }}
            className="btn-secondary"
            disabled={!selectedCompanyId}
          >
            📊 Özelliklere Göre
          </button>
          <button
            onClick={() => compareYears && selectedCompanyId ? loadCompareYears() : selectedCompanyId && loadGiderRaporuData(selectedCompanyId, selectedYear)}
            className="btn-secondary"
            disabled={groups.length === 0}
          >
            🔄 Raporu Yükle
          </button>
          {((data && data.groups && data.groups.length > 0) || (multiYearData && multiYearData[0].groups.length > 0)) && (
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

      {/* Özellik Seçim Modalı */}
      {showPropertySelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowPropertySelector(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Özellik Seçin</h2>
              <p className="text-gray-400 text-sm">Mizan verilerindeki özellik hiyerarşisinden birini seçin</p>
            </div>

                {propertiesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                <p className="text-gray-400 mt-2">Özellikler yükleniyor...</p>
              </div>
            ) : availableProperties.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="font-semibold text-white mb-2">Henüz özellik değeri bulunamadı.</p>
                <p className="text-sm mb-1">Hesap planında veya mizan verilerinde özellik değerleri (Property 1-5) tanımlı olmalı.</p>
                <p className="text-sm mb-4">Hesap Planı sayfasından hesaplara özellik değerleri atayabilirsiniz.</p>
                <button
                  onClick={async () => {
                    if (selectedCompanyId) {
                      await loadAvailableProperties(selectedCompanyId)
                    }
                  }}
                  className="mt-2 btn-secondary text-sm"
                >
                  🔄 Yeniden Yükle
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {availableProperties.map((property: any, idx: number) => {
                  const propertyIndex = property.Index || property.index || idx + 1
                  const propertyName = property.Name || property.name || `Özellik ${propertyIndex}`
                  const propertyValues = property.Values || property.values || []
                  
                  console.log('Rendering property:', { propertyIndex, propertyName, valuesCount: propertyValues.length, property })
                  
                  return (
                    <button
                      key={`property-${propertyIndex}-${idx}`}
                      onClick={() => handlePropertyBasedReport(propertyIndex)}
                      className="w-full p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-left transition-colors"
                      disabled={propertyValuesLoading}
                    >
                      <div className="font-semibold text-white">{propertyName}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {propertyValues.length > 0 
                          ? `${propertyValues.length} değer bulundu`
                          : 'Henüz değer yok'}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Şablon Kaydetme Dialog */}
      {showSaveTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass p-8 max-w-md w-full relative">
            <button
              onClick={() => {
                setShowSaveTemplateDialog(false)
                setTemplateName('')
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Formatı Kaydet</h2>
              <p className="text-gray-400 text-sm">
                Mevcut rapor yapılandırmasını şablon olarak kaydedin
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Şablon Adı
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Örn: Standart Gider Raporu"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && templateName.trim()) {
                      handleSaveTemplate()
                    }
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowSaveTemplateDialog(false)
                    setTemplateName('')
                  }}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className="btn-primary flex-1"
                  disabled={!templateName.trim()}
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grup Birleştirme Dialog */}
      {showMergeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass p-8 max-w-md w-full relative">
            <button
              onClick={() => {
                setShowMergeDialog(false)
                setMergeGroupName('')
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Grupları Birleştir</h2>
              <p className="text-gray-400 text-sm">
                {selectedGroupsForMerge.length} grup birleştirilecek
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Birleştirilmiş Grup Adı
                </label>
                <input
                  type="text"
                  value={mergeGroupName}
                  onChange={(e) => setMergeGroupName(e.target.value)}
                  className="input-field w-full"
                  placeholder="Örn: Birleşik Giderler"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowMergeDialog(false)
                    setMergeGroupName('')
                  }}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button
                  onClick={handleMergeGroups}
                  className="btn-primary flex-1"
                  disabled={!mergeGroupName.trim()}
                >
                  Birleştir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rapor Yapılandırma */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Rapor Yapılandırması</h2>
            <button
              onClick={() => setShowReportConfiguration(!showReportConfiguration)}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title={showReportConfiguration ? "Gizle" : "Göster"}
            >
              {showReportConfiguration ? "▼" : "▶"}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Şablon Seçme */}
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => {
                console.log('Şablon seçildi - value:', e.target.value)
                const templateId = e.target.value ? parseInt(e.target.value) : null
                console.log('Şablon seçildi - templateId:', templateId)
                if (templateId && !isNaN(templateId)) {
                  handleLoadTemplate(templateId)
                } else {
                  console.log('Şablon seçimi temizlendi')
                  setSelectedTemplateId(null)
                  setGroups([])
                  setSelectedPropertyIndex(null) // Özellik dropdown'larını tekrar göster
                }
              }}
              className="input-field text-sm"
              disabled={templatesLoading}
            >
              <option value="">Şablon Seç...</option>
              {templates && templates.length > 0 ? (
                templates.map((template, index) => {
                  const templateId = template.Id || (template as any).id || 0
                  const templateName = template.TemplateName || (template as any).templateName || ''
                  return (
                    <option key={templateId || `template-${index}`} value={templateId}>
                      {templateName}
                    </option>
                  )
                })
              ) : (
                <option value="" disabled>Henüz şablon yok</option>
              )}
            </select>
            
            {/* Şablon Silme */}
            {selectedTemplateId && (
              <button
                onClick={() => handleDeleteTemplate(selectedTemplateId)}
                className="btn-secondary text-sm bg-red-500/20 hover:bg-red-500/30"
                title="Şablonu Sil"
              >
                🗑️
              </button>
            )}
            
            {selectedGroupsForMerge.length >= 2 && (
              <button
                onClick={() => setShowMergeDialog(true)}
                className="btn-secondary text-sm"
              >
                🔗 Birleştir ({selectedGroupsForMerge.length})
              </button>
            )}
            <button
              onClick={() => setShowSaveTemplateDialog(true)}
              className="btn-secondary text-sm"
              disabled={groups.length === 0}
              title="Mevcut yapılandırmayı şablon olarak kaydet"
            >
              💾 Formatı Kaydet
            </button>
            <button
              onClick={handleAddGroup}
              className="btn-primary text-sm"
            >
              ➕ Yeni Grup
            </button>
          </div>
        </div>

        {showReportConfiguration && (
          <>
            {availableProperties.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">
                Özellikler yükleniyor...
              </div>
            )}

            <div className="space-y-4">
          {groups && Array.isArray(groups) && groups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="border border-gray-700 rounded-lg p-4 bg-gray-800/50 hover:border-primary-500/50 transition-colors"
              onDragOver={(e) => {
                e.preventDefault()
                if (draggedItem || draggedGroup !== null) {
                  e.currentTarget.classList.add('border-primary-500')
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-primary-500')
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('border-primary-500')
                if (draggedItem) {
                  handleDrop(groupIndex)
                } else if (draggedGroup !== null) {
                  handleGroupDrop(groupIndex)
                }
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedGroupsForMerge.includes(groupIndex)}
                    onChange={() => handleToggleGroupSelection(groupIndex)}
                    className="w-4 h-4 text-primary-500 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-gray-400 cursor-move" draggable onDragStart={() => handleGroupDragStart(groupIndex)}>
                    ⋮⋮
                  </span>
                  <input
                    type="text"
                    value={group.Name}
                    onChange={(e) => {
                      const newGroups = [...groups]
                      newGroups[groupIndex].Name = e.target.value
                      setGroups(newGroups)
                    }}
                    className="input-field flex-1"
                    placeholder="Grup Adı"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddItem(groupIndex)}
                    className="btn-secondary text-sm"
                  >
                    ➕ Kalem Ekle
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(groupIndex)}
                    className="btn-secondary text-sm bg-red-500/20 hover:bg-red-500/30"
                  >
                    🗑️ Sil
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {group.Items && Array.isArray(group.Items) && group.Items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="bg-gray-900/50 rounded p-3 border border-gray-700 hover:border-primary-500/50 transition-colors"
                    draggable
                    onDragStart={() => handleDragStart(groupIndex, itemIndex)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('border-primary-500')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-primary-500')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-primary-500')
                      handleDrop(groupIndex, itemIndex)
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-400 cursor-move">⋮⋮</span>
                      <input
                        type="text"
                        value={item.Name}
                        onChange={(e) => {
                          const newGroups = [...groups]
                          newGroups[groupIndex].Items[itemIndex].Name = e.target.value
                          setGroups(newGroups)
                        }}
                        className="input-field flex-1"
                        placeholder="Kalem Adı"
                      />
                      <div className="relative w-80">
                        {item.AccountCodePrefix ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-primary-500/20 border border-primary-500/50 rounded text-sm">
                            <div className="flex-1">
                              <div className="text-primary-300 font-mono text-xs">{item.AccountCodePrefix}</div>
                              {(() => {
                                const key = `${groupIndex}-${itemIndex}`
                                const codes = accountCodes[key] || []
                                const found = codes.find(ac => ac.AccountCode === item.AccountCodePrefix)
                                return found && (
                                  <div className="text-gray-400 text-xs truncate max-w-[200px]">
                                    {found.AccountName}
                                  </div>
                                )
                              })()}
                            </div>
                            <button
                              onClick={() => {
                                const newGroups = [...groups]
                                newGroups[groupIndex].Items[itemIndex].AccountCodePrefix = ''
                                setGroups(newGroups)
                                const key = `${groupIndex}-${itemIndex}`
                                setAccountCodeSearch(prev => ({ ...prev, [key]: '' }))
                              }}
                              className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={accountCodeSearch[`${groupIndex}-${itemIndex}`] || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                handleAccountCodeSearch(groupIndex, itemIndex, value)
                              }}
                              onFocus={() => {
                                const key = `${groupIndex}-${itemIndex}`
                                setShowAccountCodeDropdown(prev => ({ ...prev, [key]: true }))
                                if (selectedCompanyId) {
                                  // Her zaman veri yükle (eğer yüklenmemişse veya arama terimi değişmişse)
                                  const searchTerm = accountCodeSearch[key] || undefined
                                  if (!accountCodes[key] || accountCodes[key].length === 0) {
                                    loadAccountCodes(selectedCompanyId, key, searchTerm)
                                  } else if (searchTerm) {
                                    // Arama terimi varsa tekrar yükle (filtreleme için)
                                    loadAccountCodes(selectedCompanyId, key, searchTerm)
                                  }
                                }
                              }}
                              className="input-field w-full"
                              placeholder="Hesap Kodu ara..."
                            />
                            {showAccountCodeDropdown[`${groupIndex}-${itemIndex}`] && (() => {
                              const key = `${groupIndex}-${itemIndex}`
                              const codes = accountCodes[key] || []
                              const isLoading = accountCodesLoading[key] || false
                              const searchTerm = accountCodeSearch[key] || ''
                              
                              return (
                                <div
                                  ref={(el) => {
                                    accountCodeDropdownRef.current[key] = el
                                  }}
                                  className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                  style={{ position: 'absolute', zIndex: 9999 }}
                                >
                                  {isLoading ? (
                                    <div className="px-4 py-2 text-gray-400 text-sm">
                                      Hesap kodları yükleniyor...
                                    </div>
                                  ) : codes.length === 0 ? (
                                    <div className="px-4 py-2 text-gray-400 text-sm">
                                      {searchTerm 
                                        ? 'Hesap kodu bulunamadı' 
                                        : 'Hesap kodu arayın...'}
                                    </div>
                                  ) : (
                                    codes.map((account, idx) => {
                                      const accountCode = account.AccountCode || account.accountCode || ''
                                      const accountName = account.AccountName || account.accountName || ''
                                      return (
                                        <div
                                          key={`${key}-${accountCode}-${idx}`}
                                          onClick={() => handleAccountCodeSelect(groupIndex, itemIndex, accountCode)}
                                          className="px-4 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0"
                                        >
                                          <div className="text-white font-mono text-sm">{accountCode}</div>
                                          <div className="text-gray-400 text-xs">{accountName}</div>
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              )
                            })()}
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteItem(groupIndex, itemIndex)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Özellik dropdown'larını gizle: Eğer şablon yüklendiyse veya özellik seçildiyse */}
                    {!selectedPropertyIndex && !selectedTemplateId && (
                      <div className="flex flex-wrap gap-2">
                        {availableProperties && Array.isArray(availableProperties) && availableProperties.map((property: any) => {
                          if (!property) return null
                          
                          const propertyIndex = property.Index || property.index
                          const propertyName = property.Name || property.name || `Özellik ${propertyIndex}`
                          const propertyValues = (property.Values || property.values || [])
                          
                          // propertyValues'in array olduğundan emin ol
                          const safePropertyValues = Array.isArray(propertyValues) ? propertyValues : []
                          
                          if (!propertyIndex) return null
                          
                          // Eğer bu item zaten bu özellik için bir filter'a sahipse, o özellik için dropdown gösterme
                          const hasThisPropertyFilter = item.PropertyFilters?.some((f: any) => f.PropertyIndex === propertyIndex)
                          if (hasThisPropertyFilter) return null
                          
                          return (
                            <select
                              key={propertyIndex}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddPropertyFilter(groupIndex, itemIndex, propertyIndex, e.target.value)
                                  e.target.value = ''
                                }
                              }}
                              className="input-field text-sm"
                            >
                              <option value="">{propertyName} seçin...</option>
                              {safePropertyValues.map((value: string) => (
                                <option key={value || `option-${Math.random()}`} value={value || ''}>{value || ''}</option>
                              ))}
                            </select>
                          )
                        })}
                      </div>
                    )}

                    {item.PropertyFilters && item.PropertyFilters.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.PropertyFilters.map((filter, filterIndex) => {
                          const pi = typeof filter.PropertyIndex !== 'undefined' ? Number(filter.PropertyIndex) : Number((filter as any).propertyIndex)
                          const pv = (filter.PropertyValue ?? (filter as any).propertyValue ?? '').toString().trim()
                          const property = availableProperties.find(p => p.Index === pi || p.Index === filter.PropertyIndex)
                          const propKey = selectedCompanyId && pv ? `${selectedCompanyId}-${pi}-${pv}` : ''
                          const codes = propKey ? (accountCodesByProperty[propKey] || []) : []
                          const loading = propKey ? (accountCodesByPropertyLoading[propKey] ?? false) : false
                          const codeLabels = codes.map(c => c.AccountCode || (c as any).accountCode || '').filter(Boolean)
                          return (
                            <span
                              key={filterIndex}
                              className="px-2 py-1 bg-primary-500/20 text-primary-300 rounded text-xs flex items-center gap-1 flex-wrap"
                            >
                              <span>
                                {property?.Name ?? 'Özellik'}: {pv || filter.PropertyValue}
                                {loading && <span className="ml-1 text-gray-500 italic">yükleniyor...</span>}
                                {!loading && codeLabels.length > 0 && (
                                  <span className="ml-1 text-gray-400 font-mono">
                                    ({codeLabels.join(', ')})
                                  </span>
                                )}
                                {!loading && propKey && codes.length === 0 && (
                                  <span className="ml-1 text-gray-500 italic">hesap kodu yok</span>
                                )}
                              </span>
                              <button
                                onClick={() => handleRemovePropertyFilter(groupIndex, itemIndex, filterIndex)}
                                className="text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {groups.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>Henüz grup eklenmemiş. "Yeni Grup" butonuna tıklayarak başlayın.</p>
          </div>
        )}
          </>
        )}
      </div>

      {/* Rapor Görünümü */}
      {dataLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : multiYearData ? (
        renderRaporCompare()
      ) : data && data.groups && data.groups.length > 0 ? (
        renderRapor()
      ) : groups.length > 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Raporu görmek için "Raporu Yükle" butonuna tıklayın.</p>
        </div>
      ) : null}
    </div>
  )
}
