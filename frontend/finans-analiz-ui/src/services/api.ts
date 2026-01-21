import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface AuthResponse {
  success: boolean
  token?: string
  message?: string
  user?: UserInfo
}

export interface UserInfo {
  id: string
  email: string
  fullName: string
  hasSubscription: boolean
}

export interface Company {
  id: number
  companyName: string
  taxNumber: string
  accountCodeSeparator: string
  createdAt: string
  propertyName1?: string
  propertyName2?: string
  propertyName3?: string
  propertyName4?: string
  propertyName5?: string
}

export interface PropertyOption {
  id: number
  propertyIndex: number
  value: string
}

export interface AccountPlanItem {
  id: number
  accountCode: string
  accountName: string
  level: number
  property1?: string
  property2?: string
  property3?: string
  property4?: string
  property5?: string
  costCenter?: string
  isLeaf: boolean
  assignedPropertyIndex?: number
  assignedPropertyValue?: string
}

export interface MizanUploadResult {
  success: boolean
  errorMessage?: string
  rowsProcessed: number
  newAccountsAdded: number
  accountsUpdated: number
}

export const authApi = {
  register: (email: string, password: string, fullName: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, fullName }),
  
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  
  googleLogin: (idToken: string) =>
    api.post<AuthResponse>('/auth/google', { idToken }),
  
  forgotPassword: (email: string, newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email, newPassword }),
  
  checkEmail: (email: string) =>
    api.post<{ exists: boolean; email?: string; fullName?: string }>('/auth/check-email', { email }),
}

export const companyApi = {
  getAll: () => api.get<Company[]>('/company'),
  
  getById: (id: number) => api.get<Company>(`/company/${id}`),
  
  create: (data: { companyName: string; taxNumber: string; accountCodeSeparator: string }) =>
    api.post<Company>('/company', data),
  
  update: (id: number, data: { companyName: string; taxNumber: string; accountCodeSeparator: string }) =>
    api.put(`/company/${id}`, data),
  
  delete: (id: number) => api.delete(`/company/${id}`),
  
  updatePropertyNames: (id: number, data: { propertyName1?: string; propertyName2?: string; propertyName3?: string; propertyName4?: string; propertyName5?: string }) =>
    api.put(`/company/${id}/property-names`, data),
  getPropertyOptions: (companyId: number) =>
    api.get<PropertyOption[]>(`/company/${companyId}/property-options`),
  addPropertyOption: (companyId: number, data: { propertyIndex: number; value: string }) =>
    api.post<PropertyOption>(`/company/${companyId}/property-options`, data),
  deletePropertyOption: (companyId: number, optionId: number) =>
    api.delete(`/company/${companyId}/property-options/${optionId}`),
}

export const accountPlanApi = {
  getByCompany: (companyId: number) =>
    api.get<AccountPlanItem[]>(`/accountplan/company/${companyId}`),
  
  create: (companyId: number, data: { accountCode: string; accountName: string; costCenter?: string }) =>
    api.post<AccountPlanItem>(`/accountplan/company/${companyId}`, data),
  
  update: (id: number, data: { accountCode: string; accountName: string; costCenter?: string }) =>
    api.put(`/accountplan/${id}`, data),
  
  delete: (id: number) => api.delete(`/accountplan/${id}`),
  
  recalculate: (companyId: number) =>
    api.post(`/accountplan/company/${companyId}/recalculate`),
  
  assignProperty: (id: number, propertyIndex: number | null, propertyValue: string | null) =>
    api.put(`/accountplan/${id}/assign-property`, { propertyIndex, propertyValue }),
}

export const mizanApi = {
  upload: (companyId: number, year: number, month: number, file: File) => {
    const formData = new FormData()
    formData.append('companyId', companyId.toString())
    formData.append('year', year.toString())
    formData.append('month', month.toString())
    formData.append('file', file)
    return api.post<MizanUploadResult>('/mizan/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  
  getPeriods: (companyId: number) =>
    api.get<{ year: number; month: number }[]>(`/mizan/company/${companyId}/periods`),
  
  getBalances: (companyId: number, year: number, month: number) =>
    api.get(`/mizan/company/${companyId}/balances`, { params: { year, month } }),
  
  deletePeriod: (companyId: number, year: number, month: number) =>
    api.delete(`/mizan/company/${companyId}/period`, { params: { year, month } }),
  
  getConsolidated: (companyId: number) =>
    api.get<{
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
    }>(`/mizan/company/${companyId}/consolidated`),
}

export interface BilancoItem {
  Name: string
  AccountCode?: string
  NotCode?: string
  IsCategory?: boolean
  IsTotal?: boolean
  Values: {
    [key: string]: number
    Total: number
  }
}

export interface BilancoData {
  year: number
  periods: Array<{ year: number; month: number }>
  varliklar: BilancoItem[]
  kaynaklar: BilancoItem[]
}

export interface NotCodeDetail {
  AccountCode: string
  AccountName: string
  Values: {
    [key: string]: number
  }
  Total: number
}

export interface NotCodeDetailsData {
  NotCode: string
  Year: number
  Periods: Array<{ year: number; month: number }>
  Accounts: NotCodeDetail[]
}

export interface BilancoParameter {
  NotCode: string
  Section: string
  AccountName: string
  DisplayOrder: number
  AccountCodePrefixes: string[]
}

export const bilancoApi = {
  getBilanco: (companyId: number, year?: number) =>
    api.get<BilancoData>(`/bilanco/company/${companyId}`, { params: year ? { year } : {} }),
  
  getNotCodeDetails: (companyId: number, notCode: string, year?: number) =>
    api.get<NotCodeDetailsData>(`/bilanco/company/${companyId}/not/${notCode}/details`, { params: year ? { year } : {} }),
}

export const bilancoParameterApi = {
  getParameters: (companyId: number) =>
    api.get<BilancoParameter[]>(`/bilancoparameter/company/${companyId}`),
  
  updateParameters: (companyId: number, parameters: BilancoParameter[]) =>
    api.put(`/bilancoparameter/company/${companyId}`, parameters),
  
  resetToDefaults: (companyId: number) =>
    api.post(`/bilancoparameter/company/${companyId}/reset`),
  
  getReportRows: (companyId: number, year?: number) =>
    api.get<BilancoReportRowsData>(`/bilancoparameter/company/${companyId}/report-rows`, { params: year ? { year } : {} }),
}

export interface GelirTablosuItem {
  Name: string
  NotCode?: string
  IsCategory?: boolean
  IsTotal?: boolean
  Values: {
    [key: string]: number
    Total: number
  }
}

export interface GelirTablosuData {
  year: number
  periods: Array<{ year: number; month: number }>
  items: GelirTablosuItem[]
}

export const gelirTablosuApi = {
  getGelirTablosu: (companyId: number, year?: number) =>
    api.get<GelirTablosuData>(`/gelirtablosu/company/${companyId}`, { params: year ? { year } : {} }),
}

export default api

