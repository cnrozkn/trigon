# TRIGON — Geliştirme Yol Haritası (ROADMAP)

> **Son Güncelleme:** 6 Nisan 2026 (Aşama 6 Tamamlandı - Meta-Game & Prestige)  
> **Referans:** [PRD.md](./PRD.md)  
> **Kullanım:** Her aşama bağımsız olarak AI'a verilebilir. Aşamalar sırasıyla yapılmalıdır.

### Tamamlanan sprint (6 Nisan 2026 — inceleme + A/B)

Aşağıdakiler koda işlendi: procedural **MusicEngine** (katmanlı müzik, ducking), normal düşman **hit-stop**, kalkan flash / altıgen kalkan / absorb patlaması, `ownedCosmetics` varsayılanı, `skill_sweep_line` kaldırıldı, `npm test`, boss giriş sinematiği, fever görsel genişletmesi, seviye geçiş halkası + grid hızlanması, **Magnetic Field** / **Chain Lightning** kartları, Lv15+ boss **spiral** mermisi, 6 yeni başarım, spawn telegrafi, combo tier kenar glow, **Hologram** / **Void** kozmetikleri.

---

## Genel Bakış

Bu doküman Trigon'un prototipten yayınlanabilir bir hypercasual oyuna dönüşmesi için gereken tüm geliştirmeleri **8 aşamaya** böler. Her aşama kendi içinde bağımsız olarak tamamlanabilir ve test edilebilir.

```
Aşama 0: Tech Stack Güncelleme         → En stabil ve güncel sürümlere geçiş
Aşama 1: Juice & Görsel Polish         → Oyunu "canlı" hissettirir
Aşama 2: Ses Sistemi                    → Flow state'in temelini atar
Aşama 3: HUD, UI & Meta-Game           → Oyuncuyu tutar, ilerleme hissi verir
Aşama 4: Düşman Çeşitliliği & Dalgalar  → Oynanışı derinleştirir
Aşama 5: Combo, Fever & Zorluk Eğrisi   → Hipnotize edici akıcılık sağlar
Aşama 6: Prestige & Sürdürülebilirlik   → Uzun vadeli oynanışı garantiler
Aşama 7: iOS & Android Canlıya Çıkış   → Mağaza yayını ve native entegrasyon
```

---

## TAMAMLANAN AŞAMALAR (ÖZET)

Aşağıdaki aşamalar başarıyla tamamlanmış ve [ROADMAP_ARCHIVE.md](./ROADMAP_ARCHIVE.md) dosyasına arşivlenmiştir:

- **AŞAMA 0: TECH STACK GÜNCELLEMESİ** — Vite 8, Capacitor 8 ve Node 22 geçişi.
- **AŞAMA 1: JUICE & GÖRSEL POLISH** — Arka plan efektleri, particle sistemleri ve görsel geri bildirimler.
- **AŞAMA 2: SES SİSTEMİ** — Web Audio procedural ses motoru ve adaptif müzik.
- **AŞAMA 3: HUD, UI & META-GAME** — Skor tabloları, kayıt sistemi ve meta-game altyapısı.
- **AŞAMA 4: DÜŞMAN ÇEŞİTLİLİĞİ & DALGALAR** — 5 yeni düşman tipi ve WaveManager.
- **AŞAMA 5: COMBO, FEVER & ZORLUK EĞRİSİ** — Combo mekanikleri ve dinamik zorluk yönetimi.
- **AŞAMA 6: PRESTIGE & SÜRDÜRÜLEBİLİRLİK** — Mağaza, başarımlar ve günlük challenge sistemi.

---

## AŞAMA 7: iOS & ANDROID CANLIYA ÇIKIŞ

**Hedef:** Oyunu App Store ve Google Play'de yayınlamaya hazırla. Native entegrasyonları tamamla, mağaza gereksinimlerini karşıla.

**Tahmini Efor:** Yüksek  
**Bağımlılık:** Tüm önceki aşamalar tamamlanmış olmalı (minimum Aşama 0-3)

### 7.1 Capacitor Native Proje Oluşturma

**Yapılacaklar:**
- [ ] Production build al: `npm run build`
- [ ] iOS native projesi oluştur: `npx cap add ios`
- [ ] Android native projesi oluştur: `npx cap add android`
- [ ] Web → Native sync: `npx cap sync`
- [ ] iOS projesini aç: `npx cap open ios`
- [ ] Android projesini aç: `npx cap open android`
- [ ] Her iki platformda da oyunun düzgün çalıştığını doğrula

### 7.2 Native Capacitor Eklentileri

**Yapılacaklar:**
- [ ] Haptic feedback eklentisi:
  ```bash
  npm install @capacitor/haptics
  npx cap sync
  ```
  - Game over, boss kill, upgrade seçimi, combo kademesi tetikleyicilerine bağla
  - Ayarlardan açılıp kapatılabilmeli

- [ ] Status bar kontrolü:
  ```bash
  npm install @capacitor/status-bar
  npx cap sync
  ```
  - Oyun sırasında status bar gizle (immersive mode)
  - `StatusBar.hide()` + `StatusBar.setStyle({ style: Style.Dark })`

- [ ] Screen orientation kilitle:
  ```bash
  npm install @capacitor/screen-orientation
  npx cap sync
  ```
  - Portrait modda kilitle (hypercasual oyun = tek el)

- [ ] Splash screen:
  ```bash
  npm install @capacitor/splash-screen
  npx cap sync
  ```
  - Özel splash screen tasarımı (Trigon logosu, neon theme)
  - Auto-hide: oyun Boot sahnesi tamamlanınca gizle

- [ ] App eklentisi (isteğe bağlı):
  ```bash
  npm install @capacitor/app
  npx cap sync
  ```
  - Arka plana gidince oyunu otomatik duraklat
  - Back button handling (Android)

### 7.3 iOS Yapılandırması (Xcode)

**Gereksinimler:**
- Xcode 26.0+ (28 Nisan 2026 sonrası App Store zorunluluğu)
- iOS 26 SDK ile build
- macOS Sequoia 15.6+
- Apple Developer Account ($99/yıl)

**Yapılacaklar:**
- [ ] Xcode'da `ios/App/App.xcworkspace` aç
- [ ] Bundle Identifier ayarla: `com.trigon.game`
- [ ] Deployment Target: **iOS 15.0** (minimum desteklenen)
- [ ] Signing & Capabilities:
  - Otomatik signing aktif (Team seçimi)
  - Push Notification, In-App Purchase → şimdilik gerekli değil
- [ ] Info.plist düzenlemeleri:
  ```xml
  <!-- Landscape devre dışı, sadece portrait -->
  <key>UISupportedInterfaceOrientations</key>
  <array>
    <string>UIInterfaceOrientationPortrait</string>
  </array>

  <!-- Status bar -->
  <key>UIStatusBarHidden</key>
  <true/>
  <key>UIViewControllerBasedStatusBarAppearance</key>
  <false/>
  ```
- [ ] Launch Screen / Splash Screen ayarla (LaunchScreen.storyboard)
- [ ] App Icons oluştur (1024×1024 master → otomatik ölçekleme)
  - Neon tema ile uyumlu: koyu arka plan + cyan üçgen + pembe accent

### 7.4 Android Yapılandırması (Android Studio)

**Gereksinimler:**
- Android Studio Otter 2025.2.1+
- JDK 17+
- Target API: **36** (Android 16) — 31 Ağustos 2026 Google Play zorunluluğu
- Min SDK: **24** (Android 7.0)

**Yapılacaklar:**
- [ ] Android Studio'da `android/` projesini aç
- [ ] `android/app/build.gradle` kontrol et:
  ```groovy
  android {
      compileSdk 36
      defaultConfig {
          applicationId "com.trigon.game"
          minSdk 24
          targetSdk 36
          versionCode 1
          versionName "1.0.0"
      }
  }
  ```
- [ ] `AndroidManifest.xml` düzenlemeleri:
  ```xml
  <!-- Portrait kilitleme -->
  <activity android:screenOrientation="portrait" ... />

  <!-- Fullscreen / Immersive -->
  <activity android:theme="@style/AppTheme.NoActionBar" ... />
  ```
- [ ] Adaptive icon oluştur:
  - Foreground: Cyan üçgen
  - Background: Koyu lacivert (#0a0a12)
  - `android/app/src/main/res/mipmap-*` dizinlerine yerleştir
- [ ] Splash screen drawable ayarla
- [ ] ProGuard / R8 kuralları — Capacitor WebView'u koruma

### 7.5 App Store Görselleri & Metadata

**Her iki platform için:**
- [ ] App ikonu:
  - iOS: 1024×1024 PNG (alfa kanal yok, köşe yuvarlama Apple tarafından yapılır)
  - Android: 512×512 PNG + Adaptive icon (foreground + background)
- [ ] Store ekran görüntüleri:
  - iPhone 6.9" (1320×2868) — en az 3, ideal 5 adet
  - iPhone 6.7" (1290×2796) — en az 3 adet  
  - iPad Pro 13" (2064×2752) — en az 3 adet (iPad desteği varsa)
  - Android: 16:9 format, en az 2, max 8 adet
- [ ] Store açıklamaları hazırla (EN + TR):
  ```
  Title: Trigon — Neon Bullet Hell
  Subtitle: Geometric Auto-Shooter
  Description: (kısa + uzun versiyon)
  Keywords: neon, bullet hell, geometric, shooter, casual, arcade
  Category: Games → Arcade
  Rating: 4+ (şiddet minimal, geometrik)
  ```
- [ ] Privacy Policy URL oluştur (App Store zorunluluğu)
  - Basit statik sayfa yeterli (veri toplanmıyor)

### 7.6 Performans Optimizasyonu

**Yapılacaklar:**
- [ ] Production build boyutunu kontrol et:
  - Hedef: < 5MB (Phaser + oyun kodu)
  - `npm run build && du -sh dist/`
- [ ] FPS testi:
  - iPhone SE (2022) veya eşdeğeri düşük-orta segment cihaz
  - Android: Pixel 6a veya Samsung Galaxy A serisi
  - Hedef: stabil 60 FPS, partikül yoğun sahnelerde min 45 FPS
- [ ] Memory leak kontrolü:
  - 10+ run oyna, memory artış trendini izle
  - Recycled sprite/particle'ların düzgün temizlendiğini doğrula
- [ ] WebView GPU acceleration doğrula:
  - iOS: WKWebView (Capacitor varsayılan — OK)
  - Android: `android:hardwareAccelerated="true"` doğrula
- [ ] Bundle analizi:
  ```bash
  npx vite build --mode production
  npx vite-bundle-visualizer  # veya rollup-plugin-visualizer
  ```

### 7.7 Safe Area & Notch Desteği

**Yapılacaklar:**
- [ ] iOS notch/dynamic island alanını doğru handle et:
  - `viewport-fit=cover` zaten index.html'de var ✅
  - CSS `env(safe-area-inset-top/bottom)` ile HUD pozisyonlarını ayarla
  - Game container'ı safe area içinde tut
- [ ] Android punch-hole kamera / navigation bar:
  - Immersive mode ile fullscreen
  - HUD öğelerini cutout alanından kaçır
- [ ] Farklı aspect ratio'lar test et:
  - 19.5:9 (modern iPhone/Samsung)
  - 20:9 (uzun Android'ler)
  - 16:9 (eski cihazlar)
  - iPad 4:3 (iPad desteği planlanıyorsa)

### 7.8 Test & QA Checklist

**Yapılacaklar:**
- [ ] iOS Simulator testi (iPhone 16 Pro, iPhone SE 3rd gen)
- [ ] Android Emulator testi (Pixel 8, Samsung Galaxy A54)
- [ ] Gerçek cihaz testi (en az 1 iOS + 1 Android)
- [ ] Test senaryoları:
  - [ ] Oyun başlat → oyna → game over → retry akışı
  - [ ] Upgrade seçimi modal doğru çalışıyor mu
  - [ ] Ses açma/kapama (mobilde Audio Context resume)
  - [ ] Arka plana gidip geri dönme (pause/resume)
  - [ ] Telefon döndürme (kilitlendiyse portrait kalmalı)
  - [ ] Düşük pil modunda performans
  - [ ] Bildirim geldiğinde (notification interrupt) oyun duraklamalı
  - [ ] Gelen arama sırasında oyun duraklamalı
  - [ ] Safe area / notch'te UI örtüşme olmamalı
  - [ ] Touch input hassasiyeti (mobilde parmak boyutu vs mouse pointer)

### 7.9 App Store Submission (iOS)

**Yapılacaklar:**
- [ ] App Store Connect'te yeni uygulama oluştur
- [ ] Build al: Xcode → Product → Archive → Distribute (App Store Connect)
- [ ] TestFlight'a yükle → dahili test (en az 3 gün)
- [ ] Metadata, ekran görüntüleri, açıklamalar doldur
- [ ] Privacy details doldur ("Data Not Collected" muhtemelen)
- [ ] Review'a gönder
- [ ] Review süreci: ~24-48 saat (genellikle)
- [ ] Rejection durumunda düzeltme notlarını izle

### 7.10 Google Play Submission (Android)

**Yapılacaklar:**
- [ ] Google Play Console'da yeni uygulama oluştur
- [ ] AAB oluştur: Android Studio → Build → Generate Signed Bundle
  - Signing key oluştur ve güvenli sakla (kaybedilirse update gönderilmez!)
- [ ] Internal testing track'e yükle → test et
- [ ] Store listing doldur (metadata, screenshots, descriptions)
- [ ] Content rating questionnaire doldur
- [ ] Data safety form doldur
- [ ] Target audience: 13+ seç (oyun türüne uygun)
- [ ] Production release'e promote et
- [ ] Review süreci: ~1-7 gün (ilk uygulama daha uzun sürebilir)

### 7.11 Post-Launch Checklist

- [ ] Crash monitoring (Firebase Crashlytics veya Sentry — opsiyonel)
- [ ] Analytics (basit localStorage metrics yeterli, 3rd party opsiyonel)
- [ ] Versiyon numaralama stratejisi:
  - Major: Büyük özellik (örn: yeni oyun modu)
  - Minor: Küçük özellik (yeni düşman tipi, yeni upgrade)
  - Patch: Bug fix, denge değişikliği
- [ ] Update akışı: kod değiştir → build → cap sync → archive → submit

---

## Aşama Bağımlılık Diyagramı

```
Aşama 0 (Tech Stack Güncelleme)
    │
    └──→ Aşama 1 (Juice & Görsel)
              ├──→ Aşama 2 (Ses)           ⎫
              ├──→ Aşama 3 (HUD & Meta)    ⎬ Paralel yapılabilir
              │        └──→ Aşama 4 (Düşmanlar & Dalgalar)
              │                 └──→ Aşama 5 (Combo & Fever)
              │                          └──→ Aşama 6 (Prestige & Sürdürülebilirlik)
              │                                       └──→ Aşama 7 (iOS & Android Yayın)
              └──→ (Aşama 7, minimum Aşama 0-3 tamamlandıktan sonra başlanabilir)
```

---

## Platform Gereksinimleri Özeti

| Platform | Min OS | Target SDK | Geliştirme Aracı | Mağaza Son Tarih |
|----------|--------|------------|-------------------|------------------|
| iOS | iOS 15.0 | iOS 26 SDK | Xcode 26.0 + macOS Sequoia 15.6+ | 28 Nisan 2026 (Xcode 26 zorunlu) |
| Android | API 24 (7.0) | API 36 (Android 16) | Android Studio Otter 2025.2.1+ | 31 Ağustos 2026 (target API 36 zorunlu) |
| Web | Modern browser | ES2022+ | Vite 8.0.3 | — |

---

## Notlar

- Her aşama sonunda **playtest** yapılmalı ve değerler fine-tune edilmeli
- Aşama 0 (tech stack) önce yapılmalı çünkü Capacitor 8 breaking change'leri var
- Aşama 4'te eklenen düşman tipleri Aşama 5'teki combo/fever dengesini etkiler
- Tüm SFX ve müzik procedural olacağından harici dosya yönetimi gerekmez
- Kod refactor'ı (PlayScene.js'in parçalanması) Aşama 3 veya 4'te doğal olarak gerçekleşecek
- localStorage limitleri göz önünde tutulmalı (5-10MB yeterli)
- **iOS yayın için Apple Developer Program üyeliği gerekli** ($99/yıl)
- **Android yayın için Google Play Developer hesabı gerekli** ($25 tek seferlik)
- Signing key'ler (özellikle Android) güvenli yedeklenmeli — kayıp durumunda update gönderilemez
- Capacitor 8 → Capacitor 6 migration guide'ı takip edilmeli: https://capacitorjs.com/docs/updating
