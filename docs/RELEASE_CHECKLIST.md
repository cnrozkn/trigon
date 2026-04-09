# TRIGONX — Canlıya Çıkış Hazırlık Listesi (RELEASE CHECKLIST)

> **Son Güncelleme:** 7 Nisan 2026  
> **Referans:** [PRD.md](./PRD.md) · [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)  
> **Durum:** Üretim Öncesi (Pre-Production)

Bu döküman, Trigonx'un App Store ve Google Play Store'da **ücretli** olarak yayınlanması için gereken kritik adımları ve teknik kontrolleri içerir.

---

## 0. Hesap ve Ödeme Altyapısı

### 0.1 Apple Developer Hesabı
- [ ] [developer.apple.com](https://developer.apple.com) → Enroll → **$99/yıl** ödendi
- [ ] Xcode → Settings → Accounts → Apple ID eklendi
- [ ] App Store Connect → **Agreements, Tax, and Banking** dolduruldu
  - [ ] Banking: IBAN / banka hesabı bilgisi eklendi
  - [ ] Tax: W-8BEN formu dolduruldu (Türkiye için — yabancı birey/şirket)
  - [ ] Active Agreement imzalandı (Paid Applications Agreement)

### 0.2 Google Play Geliştirici Hesabı
- [ ] [play.google.com/console](https://play.google.com/console) → **$25 tek seferlik** kayıt ödendi
- [ ] Google Payments Center → banka hesabı ve vergi bilgisi eklendi
- [ ] Hesap onayı tamamlandı (genellikle 1-2 iş günü)

> Her iki platformda da banka/vergi bilgisi eksiksiz olmazsa ücretli uygulama yayınlanamaz.

---

## 1. Native Platform Hazırlığı (Capacitor)

### 1.1 Proje Yapılandırması
- [x] Production build: `npm run build` *(Vite 8, rolldown, Phaser vendor chunk ayrımı)*
- [ ] Native projelerin senkronizasyonu: `npm run cap:sync`
- [ ] iOS projesi oluşturuldu: `npm run cap:add:ios`
- [ ] Android projesi oluşturuldu: `npm run cap:add:android`
- [ ] `capacitor.config.json` → `appId: "com.trigonx.game"` doğru
- [ ] iOS: Xcode → Bundle ID `com.trigonx.game`, Team seçili, Signing otomatik
- [ ] Android: `android/app/build.gradle` → `applicationId "com.trigonx.game"`, `targetSdk 36`

### 1.2 Kritik Native Eklentiler
- [x] **Haptic Feedback:** `@capacitor/haptics` entegrasyonu — hit, crit, death, level-up, game-over olaylarına bağlandı (`src/platform/HapticService.js`)
- [x] **Status Bar:** `@capacitor/status-bar` ile tam ekran (Immersive) mod — `main.js` başlangıcında gizleniyor
- [x] **Screen Orientation:** `@capacitor/screen-orientation` ile portre (Portrait) kilidi — `main.js` başlangıcında uygulanıyor
- [ ] **Splash Screen:** Native görseller oluşturuldu (bkz. Bölüm 2.3)

---

## 2. Mağaza Varlıkları (Store Assets)

### 2.1 App Icon

Tek bir **1024×1024 PNG** master ikon hazırla. Araçlar otomatik boyutlandırır.

**Gereksinimler:**
- Boyut: tam 1024×1024 px
- Format: PNG, **alfa kanalı YOK** (şeffaflık olmadan — Apple reddeder)
- Köşe yuvarlaması yok (sistemler kendi uygular)
- Neon/geometrik Trigonx logosu — arka plan `#0a0a12` siyah üzerine beyaz/cyan üçgen

**iOS:**
- [ ] Xcode → `App → Assets.xcassets → AppIcon` → 1024×1024 PNG sürüklendi
- [ ] Xcode 26+: tek görsel yeterli, tüm boyutlar otomatik türetilir

**Android:**
- [ ] Adaptive Icon oluşturuldu (iki katman: Foreground + Background)
  - **Foreground:** 108×108 dp içinde 72×72 dp'lik güvenli alan — logo bu alanda
  - **Background:** düz renk veya gradient (ör. `#0a0a12`)
  - [ ] Android Studio → `res/mipmap` → Image Asset Studio ile oluştur:
    - `android/app/src/main/res/mipmap-*/` klasörlerine otomatik kaydeder
  - [ ] `android/app/src/main/AndroidManifest.xml` → `android:icon` ve `android:roundIcon` doğru

**Hızlı araç:** [appicon.co](https://appicon.co) — 1024×1024 yükle, iOS + Android için tüm boyutları indir.

---

### 2.2 Splash Screen (Başlangıç Ekranı)

`capacitor.config.json` zaten yapılandırılmış:
- Süre: 1500ms
- Arka plan: `#0a0a12`
- Tam ekran + immersive mod aktif

**Android splash görseli:**
- [ ] `android/app/src/main/res/drawable/splash.png` oluştur
  - Minimum 1080×1920 px, PNG
  - Arka plan `#0a0a12`, ortada küçük logo veya sadece düz renk (minimal neon)
  - `androidScaleType: "CENTER_CROP"` ayarlı — görsel merkeze hizalanır
- [ ] Alternatif: `drawable/` içinde XML vector drawable (renk dosyası + logo SVG)

**iOS splash:**
- [ ] Xcode → `LaunchScreen.storyboard` → arka plan rengi `#0a0a12` ayarla
  - Storyboard'da View'ı seç → Attributes Inspector → Background Color
  - İsteğe bağlı: ortaya `UIImageView` ile logo ekle
- [ ] Alternatif: `Assets.xcassets` içine `LaunchImage` set ekle (eski yöntem, storyboard tercih edilir)

---

### 2.3 Ekran Görüntüleri (Screenshots)

**iOS — zorunlu boyutlar:**

| Cihaz | Boyut | Açıklama |
|-------|-------|----------|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320×2868 px | **Zorunlu** |
| iPhone 6.7" (iPhone 15 Plus) | 1290×2796 px | Önerilir |
| iPad Pro 13" | 2064×2752 px | App Store zorunlu tutabilir |

En az **3 adet** ekran görüntüsü gerekir. Hızlı yöntem:
1. Xcode Simulator → `iPhone 16 Pro Max` seç
2. Oyunu çalıştır, `Cmd+S` ile ekran görüntüsü al
3. Simülatör görseli masaüstüne kaydeder

**Android — zorunlu boyutlar:**

| Format | Boyut | Açıklama |
|--------|-------|----------|
| 16:9 | 1920×1080 px | Telefon görselleri |
| 9:16 | 1080×1920 px | Dikey telefon |

En az **2 adet** gerekir. Android Studio Emulator → `Pixel 8 Pro` (6.7") kullan.

**Öne çıkan görsel (Feature Graphic — sadece Android):**
- [ ] 1024×500 px, JPG veya PNG
- Oyun adı + neon arayüz görünümü yeterli

---

### 2.4 Metadata ve Açıklamalar

**iOS (App Store Connect):**

| Alan | Karakter Limiti | Öneri |
|------|-----------------|-------|
| Name | 30 | `Trigonx` |
| Subtitle | 30 | `Neon Bullet Hell Survivor` |
| Keywords | 100 | `bullet hell,neon,arcade,survivor,shooter,geometry,hypercasual` |
| Promotional Text | 170 | İnceleme gerektirmez, dilediğinde değiştir |
| Description | 4000 | Oyun mekaniği, prestige sistemi, özellikler |
| Support URL | — | GitHub Pages veya kendi domain |
| Privacy Policy URL | — | Zorunlu |

- [ ] Uygulama adı ve subtitle yazıldı (EN)
- [ ] Açıklama yazıldı
- [ ] Anahtar kelimeler belirlendi
- [ ] Ekran görüntüleri yüklendi

**Android (Google Play Console):**

| Alan | Karakter Limiti | Öneri |
|------|-----------------|-------|
| Kısa açıklama | 80 | `Neon geometri dünyasında hayatta kal. Hızlı, akıcı, bağımlılık yapıcı.` |
| Tam açıklama | 4000 | Oyun mekaniği, prestige sistemi, özellikler |
| Başlık | 50 | `Trigonx` |

- [ ] Başlık, kısa ve tam açıklama yazıldı
- [ ] Kategori seçildi: **Oyunlar → Arcade**
- [ ] İkon ve ekran görüntüleri yüklendi

---

### 2.5 Gizlilik Politikası

Her iki mağaza da zorunlu tutar. Trigonx için doğru içerik:
- Kullanıcı verisi toplanmıyor
- Üçüncü tarafla paylaşım yok
- `localStorage` sadece cihazda kalır (highscore, coins, upgrades)
- Çocuklara yönelik değil

**Oluşturma:**
1. [privacypolicygenerator.info](https://privacypolicygenerator.info) veya [app-privacy-policy-generator.nisrullaev.com](https://app-privacy-policy-generator.nisrullaev.com) kullan
2. Üretilen HTML'i GitHub Pages'e yükle (`docs/` branch veya ayrı repo)
3. URL'yi her iki mağazaya ekle

- [ ] Gizlilik politikası metni oluşturuldu
- [ ] URL yayında ve erişilebilir

---

## 3. Performans ve Kalite (QA)

### 3.1 Teknik Kontroller
- [x] **Renderer:** `Phaser.WEBGL` zorlandı, `antialias: false`, `roundPixels: true`, `powerPreference: high-performance`
- [x] **Particle Optimizasyonu:** Mobil UA tespiti ile particle sayısı %50, lifespan %20-25 azaltıldı (`VFXManager.js`)
- [ ] **Boyut:** Build boyutu < 10MB hedefi *(mevcut: ~1.35MB gzip)*
- [ ] **FPS:** Düşük segment cihazlarda stabil 60 FPS kontrolü
  - Android: Galaxy A serisi veya Pixel 6a ile test et
  - iOS: iPhone 12 veya SE (2. nesil) ile test et
- [ ] **Bellek:** Uzun süreli oynanışta memory leak kontrolü (~10 dakika oyna, Chrome DevTools Memory)
- [ ] **Safe Area:** Notch ve Dynamic Island bölgelerinde HUD kayması kontrolü

### 3.2 Test Senaryoları
- [ ] İlk açılış ve Audio Context resume (sesin gelmesi — iOS'ta ilk dokunuş sonrası)
- [ ] Arka plana gidip geri dönme (Pause/Resume) — ses durumu ve oyun state'i
- [ ] Upgrade seçimi ve meta-game kaydedilmesi (localStorage persist)
- [ ] Game Over sonrası yeniden başlama akışı
- [ ] Prestige akışı — coin ve upgrade kalıcılığı
- [ ] Achievement kilitleri doğru tetikleniyor mu?
- [ ] Haptic feedback çalışıyor (gerçek cihazda, simülatörde çalışmaz)

### 3.3 Ücretli Uygulama Öncesi Kontroller
- [ ] Uygulama çöküyor mu? (0 crash hedefi)
- [ ] Oyun kilitlenme (ANR / hang) senaryosu yok
- [ ] Store açıklaması ile oyun içeriği uyuşuyor (Apple/Google yanıltıcı içerik kuralı)

---

## 4. Yayınlama Adımları

### 4.1 iOS (App Store Connect)
- [ ] Bundle ID `com.trigonx.game` → [developer.apple.com](https://developer.apple.com/account/resources/identifiers) → Identifiers'da kayıtlı
- [ ] Xcode → **Product → Archive** (scheme: Release) tamamlandı
- [ ] Organizer → **Distribute App → App Store Connect → Upload** tamamlandı
- [ ] App Store Connect → build "Ready to Submit" durumunda
- [ ] TestFlight dahili test yapıldı
- [ ] Store listing tamamlandı (açıklama, ekran görüntüleri, fiyat, gizlilik)
- [ ] **Submit for Review** gönderildi
- [ ] Apple incelemesi geçildi (24-48 saat)
- [ ] **Manual Release** seçildiyse → yayınla düğmesine basıldı

### 4.2 Android (Google Play Console)
- [ ] Keystore oluşturuldu ve güvenli yedeklendi (`trigonx-release.keystore`)
- [ ] `keystore.properties` → `android/` klasöründe, `.gitignore`'a eklendi
- [ ] `build.gradle` → signing config eklendi
- [ ] Release AAB üretildi: `cd android && ./gradlew bundleRelease`
- [ ] Internal Testing track'e yüklendi, test edildi
- [ ] Store listing tamamlandı
- [ ] İçerik derecelendirmesi (PEGI 3 / Everyone) onaylandı
- [ ] Veri güvenliği formu dolduruldu
- [ ] Ücretli fiyat ayarlandı (Para Kazanma → Fiyatlar)
- [ ] **Production track → Submit for Review** gönderildi
- [ ] Google incelemesi geçildi (1-3 iş günü)

---

## 5. Post-Launch

- [ ] Her iki mağazada temiz cihazdan **satın al → yükle → oyna** testi yapıldı
- [ ] Android Vitals (Play Console → Android Vitals) → crash rate ve ANR izle
- [ ] App Store Connect → Crashes → crash log takibi
- [ ] İlk hafta kullanıcı yorumlarına yanıt ver
- [ ] İlk hafta feedback'lerine göre denge (balance) güncellemesi planla
- [ ] Versiyon stratejisi (Major/Minor/Patch) takibi — Play Store'da her güncellemede `versionCode` artmalı

---

## Hızlı Kontrol Özeti

| Kategori | Durum |
|----------|-------|
| Apple Developer hesabı + ödeme | ⬜ |
| Google Play hesabı + ödeme | ⬜ |
| App Icon (1024×1024, no alpha) | ⬜ |
| Splash Screen (Android + iOS) | ⬜ |
| Ekran görüntüleri | ⬜ |
| Gizlilik politikası URL | ⬜ |
| iOS: Archive + Submit | ⬜ |
| Android: AAB + Keystore + Submit | ⬜ |
| Gerçek cihaz test (iOS + Android) | ⬜ |
| Fiyat ayarlandı (her iki platform) | ⬜ |
