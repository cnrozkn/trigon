# TRIGON — Canlıya Çıkış Hazırlık Listesi (RELEASE CHECKLIST)

> **Son Güncelleme:** 7 Nisan 2026  
> **Referans:** [PRD.md](./PRD.md)  
> **Durum:** Üretim Öncesi (Pre-Production)

Bu döküman, Trigon'un App Store ve Google Play Store'da yayınlanması için gereken kritik adımları ve teknik kontrolleri içerir.

---

## 1. Native Platform Hazırlığı (Capacitor)

### 1.1 Proje Yapılandırması
- [ ] Production build: `npm run build`
- [ ] Native projelerin senkronizasyonu: `npx cap sync`
- [ ] iOS projesi (Xcode 26+ / iOS 26 SDK) hazır mı?
- [ ] Android projesi (Target API 36 / Android 16) hazır mı?

### 1.2 Kritik Native Eklentiler
- [ ] **Haptic Feedback:** `@capacitor/haptics` entegrasyonu (Vuruş ve patlama hissi).
- [ ] **Status Bar:** `@capacitor/status-bar` ile tam ekran (Immersive) mod.
- [ ] **Screen Orientation:** Portre (Portrait) moda kilitleme.
- [ ] **Splash Screen:** Neon temalı splash screen ve auto-hide ayarı.

---

## 2. Mağaza Varlıkları (Store Assets)

### 2.1 İkonlar ve Markalama
- [ ] **App Icon (iOS):** 1024x1024 (No alpha).
- [ ] **App Icon (Android):** Adaptive Icon (Foreground + Background).
- [ ] **Mağaza Görselleri:** iPhone 6.9", 6.7" ve iPad Pro 13" ekran görüntüleri.
- [ ] **Android Görselleri:** 16:9 formatlı ekran görüntüleri.

### 2.2 Metadata ve Açıklamalar
- [ ] Uygulama adı (Title) ve Alt başlık (Subtitle) (EN + TR).
- [ ] Anahtar kelimeler (Keywords) ve kategori seçimi (Games -> Arcade).
- [ ] Gizlilik Politikası (Privacy Policy) URL.

---

## 3. Performans ve Kalite (QA)

### 3.1 Teknik Kontroller
- [ ] **Boyut:** Build boyutu < 10MB hedefi.
- [ ] **FPS:** Düşük segment cihazlarda stabil 60 FPS kontrolü.
- [ ] **Bellek:** Uzun süreli oynanışta memory leak kontrolü.
- [ ] **Safe Area:** Notch ve Dynamic Island bölgelerinde HUD kayması kontrolü.

### 3.2 Test Senaryoları
- [ ] İlk açılış ve Audio Context resume (sesin gelmesi).
- [ ] Arka plana gidip geri dönme (Pause/Resume).
- [ ] Upgrade seçimi ve meta-game kaydedilmesi.
- [ ] Game Over sonrası reklam/yeniden başlama akışı.

---

## 4. Yayınlama Adımları

### 4.1 iOS (App Store Connect)
- [ ] Xcode Archive -> Distribute to App Store Connect.
- [ ] TestFlight davetleri ve dahili test süreci.
- [ ] Apple Review gönderimi.

### 4.2 Android (Google Play Console)
- [ ] AAB dosyasının oluşturulması ve imzalanması.
- [ ] Internal Testing track yüklemesi.
- [ ] Google Play Review gönderimi.

---

## 5. Post-Launch
- [ ] Crashlytics/Sentry takibi.
- [ ] İlk hafta feedback'lerine göre denge (balance) güncellemesi.
- [ ] Versiyon stratejisi (Major/Minor/Patch) takibi.
