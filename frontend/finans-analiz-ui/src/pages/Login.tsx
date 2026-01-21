import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [userInfo, setUserInfo] = useState<{ email: string; fullName: string } | null>(null)
  const { login, googleLogin } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Giriş başarısız'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (credentialResponse.credential) {
      try {
        await googleLogin(credentialResponse.credential)
        navigate('/')
      } catch {
        setError('Google ile giriş başarısız')
      }
    }
  }

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setForgotLoading(true)

    try {
      const response = await authApi.checkEmail(forgotEmail)
      if (response.data.exists) {
        setUserInfo({
          email: response.data.email!,
          fullName: response.data.fullName || ''
        })
        setSuccess('Email adresi bulundu. Yeni şifrenizi belirleyin.')
      } else {
        setError('Bu email adresi ile kayıtlı kullanıcı bulunamadı.')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Email kontrolü başarısız'
      setError(errorMessage)
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor')
      return
    }

    setForgotLoading(true)

    try {
      const response = await authApi.forgotPassword(forgotEmail, newPassword)
      setSuccess('Şifreniz başarıyla sıfırlandı! Giriş yapabilirsiniz.')
      setTimeout(() => {
        setShowForgotPassword(false)
        setForgotEmail('')
        setNewPassword('')
        setConfirmPassword('')
        setUserInfo(null)
        setSuccess('')
      }, 2000)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Şifre sıfırlama başarısız'
      setError(errorMessage)
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative w-full max-w-md">
        <div className="glass p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              FinansAnaliz
            </h1>
            <p className="text-gray-400 mt-2">Mali analiz platformunuza giriş yapın</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="ornek@email.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>
            
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true)
                  setError('')
                  setSuccess('')
                }}
                className="text-sm text-primary-400 hover:text-primary-300"
              >
                Şifremi Unuttum
              </button>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 disabled:opacity-50"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              {GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.trim() !== '' && (
                <>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-900 text-gray-400">veya</span>
                  </div>
                </>
              )}
            </div>
            
            {GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.trim() !== '' && (
              <div className="mt-4 flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google ile giriş başarısız')}
                  theme="filled_black"
                  size="large"
                  text="signin_with"
                />
              </div>
            )}
          </div>
          
          <p className="mt-6 text-center text-sm text-gray-400">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
              Kayıt Olun
            </Link>
          </p>
        </div>

        {/* Şifremi Unuttum Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="glass p-8 max-w-md w-full relative">
              <button
                onClick={() => {
                  setShowForgotPassword(false)
                  setForgotEmail('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setUserInfo(null)
                  setError('')
                  setSuccess('')
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                ✕
              </button>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Şifremi Unuttum</h2>
                <p className="text-gray-400 text-sm">Email adresinizi girerek şifrenizi sıfırlayın</p>
              </div>

              {success && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm mb-4">
                  {success}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}

              {!userInfo ? (
                <form onSubmit={handleCheckEmail} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="input-field"
                      placeholder="ornek@email.com"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full btn-primary py-3 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Kontrol ediliyor...' : 'Email Kontrol Et'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="p-3 bg-gray-800/50 rounded-lg mb-4">
                    <p className="text-sm text-gray-400">Kullanıcı</p>
                    <p className="text-white font-medium">{userInfo.fullName}</p>
                    <p className="text-gray-300 text-sm">{userInfo.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Yeni Şifre</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field"
                      placeholder="En az 6 karakter"
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Yeni Şifre (Tekrar)</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      placeholder="Şifreyi tekrar girin"
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full btn-primary py-3 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Şifre sıfırlanıyor...' : 'Şifreyi Sıfırla'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

