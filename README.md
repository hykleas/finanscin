# Finora - Kişisel Finans Uygulaması

Finora, gelir/gider yönetimi, tema seçimi, hedef takibi ve grafik destekli analizler sunan full-stack bir finans uygulamasıdır.

## Özellikler

- Kayıt ol / giriş yap (cookie + session tabanlı auth)
- Gelir-gider işlemi ekleme, listeleme, silme
- Döneme göre finans özeti (bu ay / son 3 ay / bu yıl)
- Gelir-gider trend grafiği + kategori dağılım grafiği
- Aylık gelir ve tasarruf hedefi belirleme
- 4 tema desteği (Aurora, Midnight, Sunset, Forest)
- JSON dosya veritabanı ile kalıcı veri saklama (`data/db.json`)

## Teknolojiler

- Frontend: HTML, CSS, Vanilla JavaScript + Bootstrap + Chart.js
- Backend: Node.js (native `http`)
- Veritabanı: JSON file storage
- Auth: cookie session + PBKDF2 hash

## Kurulum

```bash
npm start
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.

## Production / Live

- Uygulama ek paket olmadan çalışır; herhangi bir Node.js hosting ortamına direkt deploy edebilirsin.
- Production'da HTTPS arkasında çalıştırıp cookie güvenlik ayarlarını (`Secure`) aktifleştirmen önerilir.
