# Deneme Sınavı Modülü

Bu modül, TYT/AYT/YDT gibi çoklu test içeren deneme sınavları için PDF oluşturma sistemidir.

## Özellikler

- **Çoklu Test Desteği**: Bir deneme kitapçığında birden fazla test (Türkçe, Matematik, Fizik, vb.)
- **Dinamik Renklendirme**: Her test için ders koduna göre otomatik renk ataması
- **Kapak Sayfaları**: Test türüne göre (TYT/AYT/YDT) statik kapak sayfaları
- **QR Kod Entegrasyonu**: Her testin ilk sayfasında QR kod gösterimi
- **Otomatik Sayfa Düzeni**: Soruların otomatik olarak sütunlara ve sayfalara yerleştirilmesi
- **Cevap Anahtarı**: Her test için ayrı cevap anahtarı sayfası
- **PDF İndirme**: Tüm kitapçığı tek PDF olarak indirme
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu arayüz

## Dosya Yapısı

```
goal-based/deneme/
├── index.html              # Ana HTML dosyası
├── script.js               # JavaScript mantığı
├── style.scss              # SCSS stil dosyası
├── style.css               # Derlenmiş CSS (otomatik)
├── example.json            # Örnek veri yapısı
├── exam-templates.json     # Sınav şablonları
└── images/                 # Kapak sayfası görselleri
    ├── tyt-kapak.jpg
    ├── tyt-kapak2.jpg
    ├── ayt-kapak.jpg
    ├── ayt-kapak2.jpg
    ├── ydt-kapak.jpg
    └── ydt-kapak2.jpg
```

## Kullanım

### 1. Veri Yapısı

`example.json` dosyası şu yapıda olmalıdır:

```json
{
  "qrCodeUrl": "https://example.com/qr-code-url",
  "schoolName": "Okul Adı",
  "availableTestTypes": ["tyt", "ayt", "ydt"],
  "tests": [
    {
      "name": "Türkçe",
      "lessonCode": "tde",
      "rank": 1,
      "maxQuestion": 40,
      "questions": [
        {
          "imageUrl": "https://example.com/question1.png",
          "questionNumber": 1
        }
      ],
      "answers": [
        {
          "correctChoiceIndex": 1,
          "questionNumber": 1
        }
      ]
    }
  ]
}
```

### 2. Başlatma

```javascript
DenemePDF.init({
  container: '#pdf-root',
  examData: examData,
  examTemplates: examTemplates,
  toolbar: {
    enabled: true,
    showBack: true,
    showDownload: true,
    showHomework: true
  },
  onBack: function() {
    // Geri butonu işlevi
  },
  onHomework: function(data) {
    // Ödev gönderme işlevi
  }
});
```

## Ders Renkleri

Her ders için önceden tanımlanmış renkler:

- **tde** (Türkçe/Türk Dili): `#936fb7` (Mor)
- **tar** (Tarih): `#e46664` (Kırmızı)
- **cog** (Coğrafya): `#258264` (Yeşil)
- **fel** (Felsefe): `#f39c12` (Turuncu)
- **dikab** (Din Kültürü): `#3498db` (Mavi)
- **mat** (Matematik): `#936fb7` (Mor)
- **fiz** (Fizik): `#e46664` (Kırmızı)
- **kim** (Kimya): `#258264` (Yeşil)
- **biy** (Biyoloji): `#f39c12` (Turuncu)
- **ing** (İngilizce): `#3498db` (Mavi)

## Sayfa Akışı

1. **Kapak 1**: Test türüne göre statik kapak sayfası (örn: tyt-kapak.jpg)
2. **Kapak 2**: Test türüne göre ikinci kapak sayfası (örn: tyt-kapak2.jpg)
3. **Test Sayfaları**: Her test için:
   - İlk sayfa: Test adı, okul adı ve QR kod içerir
   - Soru sayfaları: Sorular iki sütunlu düzende otomatik yerleşir
4. **Cevap Anahtarları**: Her test için ayrı cevap anahtarı sayfası

## Özelleştirme

### Tema Renkleri

SCSS dosyasında tema renklerini değiştirebilirsiniz:

```scss
$tyt-color: #936fb7;
$ayt-color: #258264;
$ydt-color: #e46664;
```

### Sayfa Boyutları

Sayfa boyutları A4 standartında (210mm x 297mm) ayarlanmıştır. `style.scss` dosyasında bu değerleri değiştirebilirsiniz.

## API Metodları

- `DenemePDF.init(options)`: Modülü başlatır
- `DenemePDF.download()`: PDF'i indirir
- `DenemePDF.send()`: Ödev gönderme fonksiyonunu tetikler

## Tarayıcı Desteği

- Chrome/Edge (önerilen)
- Firefox
- Safari
- Modern mobil tarayıcılar

## Bağımlılıklar

- html2canvas v1.4.1
- jsPDF v2.5.1
- QRious (../shared/qrious.min.js)
- Google Fonts (Jost)

## Notlar

- SASS derleyiciniz otomatik çalışıyor, bu yüzden `style.scss` dosyasını düzenledikten sonra `style.css` otomatik olarak güncellenecektir.
- Proje Live Server üzerinde port 3000'de çalışıyor.
- Düzenleme formu yoktur, tüm veriler JSON üzerinden gelir.
- Konu adı ve ders adı alanları yoktur (çoklu test yapısı nedeniyle).

## single-test'ten Farklar

1. ❌ **Düzenleme formu yok** - Veriler değiştirilemez
2. ❌ **Konu/Ders adı yok** - Çoklu test yapısı
3. ✅ **Kapak sayfaları var** - Test türüne göre 2 kapak
4. ✅ **Çoklu test desteği** - Birden fazla test yan yana
5. ✅ **Test bazlı renklendirme** - Her testin kendi rengi
6. ✅ **Test bazlı cevap anahtarı** - Her test için ayrı sayfa
