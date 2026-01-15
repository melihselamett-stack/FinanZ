# FinansAnaliz - Mali Analiz Platformu

Muhasebe verilerini analiz etmek ve raporlamak için geliştirilmiş web uygulaması.

## Özellikler

- 📊 **Mizan Yükleme**: Excel dosyalarından mizan verilerini otomatik içe aktarma
- 🏢 **Çoklu Şirket Desteği**: Birden fazla şirket yönetimi
- 📋 **Hesap Planı**: 5 özellikli hiyerarşik hesap planı sistemi
- 🔐 **Güvenli Kimlik Doğrulama**: Email ve Google OAuth desteği
- 📦 **Paket Sistemi**: Abonelik bazlı erişim kontrolü

## Teknolojiler

### Backend
- ASP.NET Core 9 Web API
- Entity Framework Core 9
- MSSQL Server
- JWT + Google OAuth
- ClosedXML (Excel işlemleri)

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios

## Kurulum

### Gereksinimler
- .NET 9 SDK
- Node.js 18+
- MSSQL Server

### Backend Kurulumu

```bash
cd backend/FinansAnaliz.API

# appsettings.json'da connection string'i güncelleyin
# MSSQL bağlantı bilgilerinizi girin

# Migration oluştur ve uygula
dotnet ef migrations add InitialCreate
dotnet ef database update

# Uygulamayı çalıştır
dotnet run
```

### Frontend Kurulumu

```bash
cd frontend/finans-analiz-ui

# Bağımlılıkları yükle
npm install

# .env dosyası oluştur
# VITE_API_URL=https://localhost:7001/api
# VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Geliştirme sunucusu başlat
npm run dev
```

## Yapılandırma

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=FinansAnaliz;Trusted_Connection=True;"
  },
  "JwtSettings": {
    "Secret": "your-32-character-secret-key-here",
    "Issuer": "FinansAnaliz.API",
    "Audience": "FinansAnaliz.Client"
  },
  "GoogleAuth": {
    "ClientId": "your-google-client-id",
    "ClientSecret": "your-google-client-secret"
  }
}
```

## Excel Mizan Şablonu

| Kolon | Alan | Örnek |
|-------|------|-------|
| A | Hesap Kodu | 102.10.001 |
| B | Hesap Adı | Ziraat Bankası |
| C | Borç | 1.234.567,89 |
| D | Alacak | 1.234.567,89 |
| E | Borç Bakiye | 1.234.567,89 |
| F | Alacak Bakiye | - |
| G | Seviye (opsiyonel) | 3,00 |
| H | Maliyet Merkezi | Merkez |

**Not**: Türkçe sayı formatı kullanın (nokta=binlik, virgül=ondalık)

## API Endpoints

### Auth
- `POST /api/auth/register` - Kayıt ol
- `POST /api/auth/login` - Giriş yap
- `POST /api/auth/google` - Google ile giriş

### Company
- `GET /api/company` - Şirketleri listele
- `POST /api/company` - Şirket ekle
- `PUT /api/company/{id}` - Şirket güncelle
- `DELETE /api/company/{id}` - Şirket sil

### Account Plan
- `GET /api/accountplan/company/{id}` - Hesap planını getir
- `POST /api/accountplan/company/{id}/recalculate` - Özellikleri yeniden hesapla

### Mizan
- `POST /api/mizan/upload` - Excel yükle
- `GET /api/mizan/company/{id}/periods` - Dönemleri listele
- `GET /api/mizan/company/{id}/balances` - Bakiyeleri getir

## Lisans

MIT License

cd backend/FinansAnaliz.API; dotnet run
cd frontend/finans-analiz-ui; npm run dev