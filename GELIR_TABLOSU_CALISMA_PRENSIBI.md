# Gelir Tablosu Raporu - Çalışma Prensibi ve Hesap Eşleştirmeleri

## Genel Çalışma Prensibi

Gelir tablosu raporu, `MonthlyBalances` tablosundaki mizan verilerini kullanarak gelir ve gider hesaplarını sınıflandırır ve toplar. Sistem, hesap kodlarının **ilk iki hanesine (L1 kodu)** göre hesapları gruplar.

### Veri Kaynağı
- **Kaynak**: `MonthlyBalances` tablosu (yüklenen mizan verileri)
- **Filtreleme**: Sadece `IsLeaf = true` olan (yaprak) hesaplar kullanılır
- **Dönem**: Seçilen yıl için tüm aylar (1-12) işlenir

### Bakiye Hesaplama Mantığı

#### Gelir Hesapları (6 ile başlayan)
```
Net Bakiye = CreditBalance - DebitBalance
```
- Gelir hesapları **alacak (credit)** tarafında artar
- Pozitif değer = Gelir

#### Gider Hesapları (7 ile başlayan)
```
Net Bakiye = DebitBalance - CreditBalance
```
- Gider hesapları **borç (debit)** tarafında artar
- Pozitif değer = Gider

#### Negatif İşaretli Kalemler
`isNegative = true` parametresi ile çağrılan kalemler için:
```
Net Bakiye = -Math.Abs(Net Bakiye)
```
- Değer her zaman negatif olarak gösterilir

---

## Hesap Kodları ve Eşleştirmeleri

### A- BRÜT SATIŞLAR

#### 1. YURTİÇİ SATIŞLAR
- **Hesap Kodu**: `60` ile başlayan hesaplar
- **Örnek**: `600`, `600.01`, `600.01.001`
- **Hesaplama**: Credit - Debit (pozitif)

#### 2. YURTDIŞI SATIŞLAR
- **Hesap Kodu**: `61` ile başlayan hesaplar
- **Örnek**: `610`, `611`, `610.01`
- **Hesaplama**: Credit - Debit (pozitif)

#### 3. DİĞER GELİRLER
- **Hesap Kodları**: `64`, `65`, `66`, `67`, `68` ile başlayan hesaplar
- **Örnek**: `640`, `650`, `660`, `670`, `680`
- **Hesaplama**: Credit - Debit (pozitif)
- **Not**: Bu hesaplar hem "Brüt Satışlar" altında hem de "F- Diğer Faaliyetlerden Olağan Gelir ve Karlar" altında detaylı olarak gösterilir

**BRÜT SATIŞLAR TOPLAMI** = Yurtiçi Satışlar + Yurtdışı Satışlar + Diğer Gelirler

---

### B- SATIŞ İNDİRİMLERİ (-)

#### 1. SATIŞTAN İADELER (-)
- **Hesap Kodu**: `62` ile başlayan hesaplar
- **Örnek**: `620`, `621`, `620.01`
- **Hesaplama**: Credit - Debit, sonra **negatif** işaretli
- **Sonuç**: Her zaman negatif değer

#### 2. SATIŞ İSKONTOLARI (-)
- **Hesap Kodu**: `61` ile başlayan hesaplar (indirim kısmı)
- **Örnek**: `610`, `611` (indirim hesapları)
- **Hesaplama**: Credit - Debit, sonra **negatif** işaretli
- **Not**: `61` kodu hem "Yurtdışı Satışlar" hem de "Satış İskontoları" için kullanılıyor (farklı alt hesaplar olabilir)

#### 3. DİĞER İNDİRİMLER (-)
- **Hesap Kodu**: `63` ile başlayan hesaplar
- **Örnek**: `630`, `631`
- **Hesaplama**: Credit - Debit, sonra **negatif** işaretli

**SATIŞ İNDİRİMLERİ TOPLAMI** = Satıştan İadeler + Satış İskontoları + Diğer İndirimler

---

### C- NET SATIŞLAR (Hesaplanan)
```
NET SATIŞLAR = BRÜT SATIŞLAR TOPLAMI - SATIŞ İNDİRİMLERİ TOPLAMI
```

---

### D- SATIŞLARIN MALİYETİ (-)

#### 1. SATILAN MAMÜLLER MALİYETİ (-)
- **Hesap Kodu**: `70` ile başlayan hesaplar
- **Örnek**: `700`, `700.01`, `700.01.001`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 2. SATILAN TİCARİ MALLAR MALİYETİ (-)
- **Hesap Kodu**: `71` ile başlayan hesaplar
- **Örnek**: `710`, `711`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 3. SATILAN HİZMET MALİYETİ (-)
- **Hesap Kodu**: `72` ile başlayan hesaplar
- **Örnek**: `720`, `721`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 4. DİĞER SATIŞLARIN MALİYETİ (-)
- **Hesap Kodları**: `73`, `74` ile başlayan hesaplar
- **Örnek**: `730`, `740`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

**SATIŞLARIN MALİYETİ TOPLAMI** = Mamüller + Ticari Mallar + Hizmet + Diğer

---

### BRÜT SATIŞ KARI VEYA ZARARI (Hesaplanan)
```
BRÜT SATIŞ KARI/ZARARI = NET SATIŞLAR - SATIŞLARIN MALİYETİ TOPLAMI
```

---

### E- FAALİYET GİDERLERİ (-)

#### 1. ARAŞTIRMA VE GELİŞTİRME GİDERLERİ (-)
- **Hesap Kodu**: `75` ile başlayan hesaplar
- **Örnek**: `750`, `751`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 2. PAZARLAMA SATIŞ VE DAĞITIM GİDERLERİ (-)
- **Hesap Kodu**: `76` ile başlayan hesaplar
- **Örnek**: `760`, `761`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 3. GENEL YÖNETİM GİDERLERİ (-)
- **Hesap Kodu**: `77` ile başlayan hesaplar
- **Örnek**: `770`, `771`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

**FAALİYET GİDERLERİ TOPLAMI** = Araştırma + Pazarlama + Genel Yönetim

---

### FAALİYET KARI VEYA ZARARI (Hesaplanan)
```
FAALİYET KARI/ZARARI = BRÜT SATIŞ KARI/ZARARI - FAALİYET GİDERLERİ TOPLAMI
```

---

### F- DİĞER FAALİYETLERDEN OLAĞAN GELİR VE KARLAR

#### 1. İŞTİRAKLERDEN TEMETTÜ GELİRLERİ
- **Hesap Kodu**: `64` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 2. BAĞLI ORTAKLIKLARDAN TEMETTÜ GELİRLERİ
- **Hesap Kodu**: `65` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 3. FAİZ GELİRLERİ
- **Hesap Kodu**: `66` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 4. KOMİSYON GELİRLERİ
- **Hesap Kodu**: `67` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 5. KONUSU KALMAYAN KARŞILIKLAR
- **Hesap Kodu**: `68` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 6. MENKUL KIYMET SATIŞ KARLARI
- **Hesap Kodları**: `64`, `65` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 7. KAMBİYO KARLARI
- **Hesap Kodu**: `66` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 8. REESKONT FAİZ GELİRLERİ
- **Hesap Kodu**: `67` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 9. ENFLASYON DÜZELTMESİ KARLARI
- **Hesap Kodu**: `68` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 10. DİĞER OLAĞAN GELİR VE KARLAR
- **Hesap Kodları**: `64`, `65`, `66`, `67`, `68` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

**F TOPLAMI** = Tüm alt kalemlerin toplamı

---

### G- DİĞER FAALİYETLERDEN OLAĞAN GİDER VE ZARARLAR (-)

#### 1. KOMİSYON GİDERLERİ (-)
- **Hesap Kodu**: `74` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 2. KARŞILIK GİDERLERİ (-)
- **Hesap Kodu**: `75` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 3. MENKUL KIYMET SATIŞ ZARARLARI (-)
- **Hesap Kodları**: `74`, `75` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 4. KAMBİYO ZARARLARI (-)
- **Hesap Kodu**: `76` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 5. REESKONT FAİZ GİDERLERİ (-)
- **Hesap Kodu**: `77` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 6. ENFLASYON DÜZELTMESİ ZARARLARI (-)
- **Hesap Kodu**: `78` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 7. DİĞER GİDER VE ZARARLAR (-)
- **Hesap Kodları**: `74`, `75`, `76`, `77`, `78` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

**G TOPLAMI** = Tüm alt kalemlerin toplamı

---

### H- FİNANSMAN GİDERLERİ (-)

#### 1. KISA VADELİ BORÇLANMA GİDERLERİ (-)
- **Hesap Kodu**: `75` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli
- **Not**: `75` kodu hem "Araştırma ve Geliştirme" hem de "Kısa Vadeli Borçlanma" için kullanılıyor

#### 2. UZUN VADELİ BORÇLANMA GİDERLERİ (-)
- **Hesap Kodu**: `76` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli
- **Not**: `76` kodu hem "Pazarlama Satış ve Dağıtım" hem de "Uzun Vadeli Borçlanma" için kullanılıyor

**H TOPLAMI** = Kısa Vadeli + Uzun Vadeli

---

### OLAĞAN KAR VEYA ZARAR (Hesaplanan)
```
OLAĞAN KAR/ZARAR = FAALİYET KARI/ZARARI + F TOPLAMI - G TOPLAMI - H TOPLAMI
```

---

### I- OLAĞANDIŞI GELİR VE KARLAR

#### 1. ÖNCEKİ DÖNEM GELİR VE KARLARI
- **Hesap Kodu**: `68` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

#### 2. DİĞER OLAĞANDIŞI GELİR VE KARLAR
- **Hesap Kodları**: `64`, `65`, `66`, `67`, `68` ile başlayan hesaplar
- **Hesaplama**: Credit - Debit (pozitif)

**I TOPLAMI** = Önceki Dönem + Diğer Olağandışı

---

### J- OLAĞANDIŞI GİDER VE ZARARLAR (-)

#### 1. ÇALIŞMAYAN KISIM GİDER VE ZARARLARI (-)
- **Hesap Kodu**: `78` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 2. ÖNCEKİ DÖNEM GİDER VE ZARARLARI (-)
- **Hesap Kodu**: `78` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

#### 3. DİĞER OLAĞANDIŞI GİDER VE ZARARLAR (-)
- **Hesap Kodları**: `74`, `75`, `76`, `77`, `78` ile başlayan hesaplar
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

**J TOPLAMI** = Çalışmayan Kısım + Önceki Dönem + Diğer Olağandışı

---

### DÖNEM KARI VEYA ZARARI (Hesaplanan)
```
DÖNEM KARI/ZARARI = OLAĞAN KAR/ZARAR + I TOPLAMI - J TOPLAMI
```

---

### K- DÖNEM KARI VERGİ VE DİĞER YASAL YÜKÜMLÜLÜK KARŞILIKLARI (-)

- **Hesap Kodu**: `79` ile başlayan hesaplar
- **Örnek**: `790`, `791`
- **Hesaplama**: Debit - Credit, sonra **negatif** işaretli

---

### DÖNEM NET KARI VEYA ZARARI (Hesaplanan)
```
DÖNEM NET KARI/ZARARI = DÖNEM KARI/ZARARI - K (Vergi Karşılıkları)
```

---

## Önemli Notlar

### 1. Hesap Kodu Eşleştirmesi
- Sistem, hesap kodlarının **ilk iki hanesine** göre eşleştirme yapar
- Örnek: `600`, `600.01`, `600.01.001` hepsi `60` grubuna dahil edilir
- Sadece **yaprak (leaf) hesaplar** kullanılır (`IsLeaf = true`)

### 2. Çakışan Hesap Kodları
Bazı hesap kodları birden fazla kalemde kullanılıyor:
- **`61`**: Hem "Yurtdışı Satışlar" hem de "Satış İskontoları"
- **`64-68`**: Hem "Brüt Satışlar" altında "Diğer Gelirler" hem de "F- Diğer Faaliyetlerden Olağan Gelir ve Karlar" altında detaylı
- **`75`**: Hem "Araştırma ve Geliştirme" hem de "Kısa Vadeli Borçlanma"
- **`76`**: Hem "Pazarlama Satış ve Dağıtım" hem de "Uzun Vadeli Borçlanma"
- **`78`**: Hem "Enflasyon Düzeltmesi Zararları" hem de "Çalışmayan Kısım Giderleri" hem de "Önceki Dönem Giderleri"

**Çözüm**: Bu durumda, aynı hesap kodu birden fazla satırda görünebilir. Gerçek uygulamada, hesap planı yapısına göre daha spesifik kodlar kullanılmalıdır.

### 3. Negatif İşaretli Kalemler
`isNegative: true` parametresi ile çağrılan fonksiyonlar, değeri her zaman negatif olarak gösterir:
```csharp
if (isNegative)
{
    netBalance = -Math.Abs(netBalance);
}
```

### 4. Hesaplanan Toplamlar
Tüm toplamlar ve ara toplamlar otomatik olarak hesaplanır:
- `CalculateTotal()`: Birden fazla kalemin toplamı
- `CalculateDifference()`: İki kalem arasındaki fark
- `CalculateOlaganKarZarar()`: Olağan kar/zarar hesaplama
- `CalculateDonemKarZarar()`: Dönem kar/zarar hesaplama

### 5. Dönem Bazlı Hesaplama
Her ay için ayrı ayrı hesaplama yapılır ve sonunda "Total" kolonu tüm ayların toplamını gösterir.

---

## Veri Akışı

```
MonthlyBalances (Mizan Verileri)
    ↓
GetAccountGroupTotal() - Hesap koduna göre filtreleme ve toplama
    ↓
CalculateTotal() / CalculateDifference() - Toplam ve fark hesaplamaları
    ↓
Gelir Tablosu Raporu (Frontend'e JSON formatında)
```

---

## Örnek Senaryo

### Senaryo: 600.01.001 hesabı için
1. **Hesap Kodu**: `600.01.001`
2. **L1 Kodu**: `60` (ilk iki hane)
3. **Eşleşme**: "1- YURTİÇİ SATIŞLAR" satırına gider
4. **Hesaplama**: 
   - Ocak: CreditBalance(600.01.001) - DebitBalance(600.01.001)
   - Şubat: CreditBalance(600.01.001) - DebitBalance(600.01.001)
   - ... (tüm aylar)
5. **Toplam**: Tüm ayların toplamı "Total" kolonunda gösterilir

---

## Sonuç

Gelir tablosu raporu, hesap kodlarının ilk iki hanesine göre otomatik sınıflandırma yapar ve standart gelir tablosu formatında rapor üretir. Sistem, mizan verilerindeki tüm yaprak hesapları ilgili kalemlere otomatik olarak dağıtır.
