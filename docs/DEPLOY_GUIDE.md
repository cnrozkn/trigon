# TRIGON — Play Store'a Kadar Adım Adım Deploy Kılavuzu

> **Son Güncelleme:** 7 Nisan 2026  
> **Başlangıç Noktası:** Kod hazır, `npm run build` çalışıyor  
> **Bitiş Noktası:** Google Play Store'da yayında

Bu kılavuz, `npx cap sync` komutundan itibaren gerçek cihaz testini de kapsayarak Play Store'a (ve App Store'a) giden tüm süreci adım adım açıklar.

---

## Ön Koşullar

| Araç | Minimum Versiyon | Kontrol Komutu |
|------|-----------------|----------------|
| Node.js | 22.x LTS | `node -v` |
| JDK | 17+ | `java -version` |
| Android Studio | Otter 2025.2.1+ | — |
| Xcode (iOS için) | 26.0 | — |
| CocoaPods (iOS için) | 1.16+ | `pod --version` |

---

## Bölüm 1 — Capacitor Senkronizasyonu

### 1.1 Native projeleri başlat (ilk kez)

Eğer `ios/` ve `android/` klasörleri henüz yoksa:

```bash
npx cap add ios
npx cap add android
```

### 1.2 Web build'ini native projelere aktar

Her değişiklikten sonra bu iki komut yeterlidir:

```bash
npm run build          # dist/ klasörünü günceller
npx cap sync           # dist/ → ios/ ve android/ kopyalar; plugin değişikliklerini uygular
```

> `cap sync` = `cap copy` + `cap update`. Yeni eklenti kurduysanız (haptics, status-bar, screen-orientation gibi) daima `sync` kullanın.

---

## Bölüm 2 — Android Build ve Gerçek Cihaz Testi

### 2.1 Android Studio'yu aç

```bash
npx cap open android
```

Android Studio açıldığında Gradle sync otomatik başlar. Sync tamamlanana kadar bekle.

### 2.2 `build.gradle` ayarlarını kontrol et

`android/app/build.gradle` içinde şunların doğru olduğunu kontrol et:

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

### 2.3 Gerçek Android cihazda test

1. Telefonda **Geliştirici Seçenekleri → USB Hata Ayıklama**'yı aç.
2. Telefonu USB ile bağla.
3. Android Studio'da üst çubuktan cihazını seç → **▶ Run** düğmesine bas.
4. Uygulama cihaza kurulur ve başlar.

**Test edilmesi gereken senaryolar:**

| Senaryo | Beklenen Davranış |
|---------|------------------|
| Uygulama ilk açılış | Splash 1.5s → neon menü, ses gelir |
| Portre kilidi | Telefonu yan çevirince döndürmez |
| Status bar | Tam ekran, sistem bar görünmez |
| Dokunuş haptic | Vuruşlarda hafif titreşim hissedilir |
| Oyun arka plana git → geri dön | Ses devam eder, oyun duraklar/devam eder |
| Notch / yuvarlak köşe | HUD elemanları ekrandan taşmaz |
| Uzun oyun (~10 dakika) | FPS 60 sabit, bellek şişmez |

### 2.4 Chrome DevTools ile performans izle (Android)

Gerçek cihazda çalışırken Chrome'dan canlı profil alabilirsin:

1. Bilgisayarda Chrome'u aç → `chrome://inspect`
2. Listede cihazın WebView'ü görünür → **inspect** tıkla
3. **Performance** sekmesinden kayıt al, FPS ve memory grafiklerine bak
4. `console.log` çıktıları production build'de strip edildi; hata varsa `sourcemap: true` yapıp tekrar dene

---

## Bölüm 3 — Android İmzalama ve AAB Üretimi

### 3.1 Keystore oluştur (bir kez, güvenli sakla)

```bash
keytool -genkey -v \
  -keystore trigon-release.keystore \
  -alias trigon \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

> ⚠️ Bu dosyayı ve şifrelerini kaybet = Play Store hesabına bir daha uygulama güncelleyemezsin. Git'e ekleme, harici yedekle.

### 3.2 `keystore.properties` dosyası oluştur

`android/` klasöründe `keystore.properties` adında bir dosya oluştur (git'e ekleme):

```properties
storeFile=../../trigon-release.keystore
storePassword=ŞIFRE_BURAYA
keyAlias=trigon
keyPassword=ŞIFRE_BURAYA
```

### 3.3 `build.gradle`'a signing config ekle

`android/app/build.gradle` dosyasını aç, `android { }` bloğuna ekle:

```groovy
def keystoreProps = new Properties()
def keystoreFile = rootProject.file("keystore.properties")
if (keystoreFile.exists()) keystoreProps.load(new FileInputStream(keystoreFile))

android {
    signingConfigs {
        release {
            storeFile file(keystoreProps['storeFile'])
            storePassword keystoreProps['storePassword']
            keyAlias keystoreProps['keyAlias']
            keyPassword keystoreProps['keyPassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

### 3.4 Release AAB üret

Android Studio'da:

**Build → Generate Signed Bundle / APK → Android App Bundle → Next → Keystore seç → Release → Finish**

Ya da terminal ile:

```bash
cd android
./gradlew bundleRelease
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Bölüm 4 — Google Play Console'a Yükleme

### 4.0 Google Play Geliştirici Hesabı

- [play.google.com/console](https://play.google.com/console) → **Başlarken** → **$25 tek seferlik** kayıt ücreti öde
- Bireysel veya şirket hesabı seçilebilir
- Onay genellikle **birkaç saat – 2 iş günü** sürer
- **Ücretli uygulama için:** Payments Center → banka ve vergi bilgilerini doldur (IBAN + kimlik bilgileri gerekir)
- **Google'ın kesintisi:** %30 (ilk $1M için %15 — Google Play Media Experience Program)

### 4.1 İlk uygulama kaydı

1. [play.google.com/console](https://play.google.com/console) → **Uygulama Oluştur**
2. **Uygulama adı:** Trigon  
3. **Varsayılan dil:** İngilizce (veya Türkçe)  
4. **Uygulama veya oyun:** Oyun  
5. **Ücretsiz veya ücretli:** **Ücretli** (dikkat: ücretli seçildikten sonra ücretsize geçilemez)

**Fiyatlandırma:**
Sol menü → **Para Kazanma → Fiyatlar** → fiyat katmanını seç (ör. $1.99 → ₺79.99 otomatik hesaplanır)

### 4.2 Dahili Test (Internal Testing) — Gerçek cihaz testi

> Bu aşama herkese açık değil, sadece davet ettiğin test kullanıcıları yükleyebilir. Yayına almadan önce burada test et.

1. Sol menü → **Test → Dahili test**
2. **Yeni sürüm oluştur** → AAB dosyasını yükle
3. Test kullanıcılarını e-posta ile davet et
4. Davet bağlantısını paylaş → kullanıcılar Play Store'dan yükler

**Dahili testte kontrol edilmesi gerekenler:**

| Kontrol | Açıklama |
|---------|----------|
| Kurulum | Uygulama hatasız kurulur |
| Ekran boyutu | Farklı telefon/tablet modellerinde düzgün görünüm |
| Haptic | Titreşim çalışıyor |
| Ses | Ses geliyor, mute çalışıyor |
| Kayıt | Prestige coin'leri, yüksek skor kaydediliyor |
| Çöküş | Uzun oturumda crash yok |

### 4.3 Store Listeleme (Store Listing) — Zorunlu alanlar

Sol menü → **Mağaza varlıkları → Ana mağaza listesi**

**Doldurulması gereken alanlar:**

| Alan | İçerik |
|------|--------|
| Kısa açıklama (80 karakter) | *Neon geometri dünyasında hayatta kal. Hızlı, akıcı, bağımlılık yapıcı.* |
| Tam açıklama (4000 karakter) | Oyun mekaniği, özellikler, prestige sistemi |
| Uygulama simgesi | 512×512 PNG (şeffaflık yok) |
| Öne çıkan görsel | 1024×500 JPG/PNG |
| Ekran görüntüleri | Telefon: en az 2 adet, 16:9 veya 9:16 |
| Kategori | Oyunlar → Arcade |
| Gizlilik politikası URL | Zorunlu — hosting gerektiriyor |

**Ekran görüntüsü için hızlı yöntem:** Android Studio Emulator'da `Pixel 8 Pro` seç, ekran görüntüsü al (540dpi, 6.7").

### 4.4 İçerik Derecelendirmesi

Sol menü → **Politika → Uygulama içeriği → Derecelendirme**

Anketi doldur: şiddet yok (soyut geometri), kumar yok, kullanıcı verisi yok → **PEGI 3 / Everyone** çıkar.

### 4.5 Hedef Kitle

Sol menü → **Politika → Uygulama içeriği → Hedef kitle**

**18+** seç (çizgi film yok, hedef 15-35 yaş belirtilmişti) ya da **13+** seçersen çocuklara yönelik sorular çıkar — dikkatli ol.

### 4.6 Gizlilik Politikası

Play Store, gizlilik politikası URL'i zorunlu tutar. Hızlı çözüm:
- [privacypolicygenerator.info](https://www.privacypolicygenerator.info) gibi bir üretici kullan
- Üretilen metni GitHub Pages, Notion veya kendi domainine yükle
- Sadece `localStorage` kullanıyorsun, üçüncü taraf veri paylaşımı yok — bunu politikaya yaz

### 4.7 Veri Güvenliği (Data Safety)

Sol menü → **Politika → Uygulama içeriği → Veri güvenliği**

Trigon için doğru cevaplar:

| Soru | Cevap |
|------|-------|
| Kullanıcı verisi toplanıyor mu? | Hayır (localStorage cihazda kalır) |
| Veri üçüncü tarafla paylaşılıyor mu? | Hayır |
| Veri şifreleniyor mu? | Evet (HTTPS / cihaz şifrelemesi) |

---

## Bölüm 5 — Üretim Sürümü ve İnceleme

### 5.1 Production track'e terfi

Dahili test başarılıysa:

1. Sol menü → **Test → Kapalı test (Closed testing)** → birkaç hafta daha test et  
   *veya doğrudan:*
2. Sol menü → **Yayınla → Üretim → Yeni sürüm oluştur**
3. AAB'ı yükle, sürüm notlarını yaz
4. **İncelemeye gönder**

### 5.2 İnceleme süresi

Google Play incelemesi genellikle **1-3 iş günü** sürer. Reddetme nedenleri:
- Gizlilik politikası eksik/bozuk URL
- Ekran görüntüleri yetersiz kalitede
- Metadata'da yanıltıcı içerik

### 5.3 Yayın sonrası kontrol

İnceleme onaylandıktan sonra:
- Play Store'da arama yap, uygulama görünüyor mu?
- Temiz bir cihazdan yükle, onboarding akışını test et
- Android Vitals (Play Console → Android Vitals) → crash rate ve ANR izle

---

## Bölüm 6 — iOS (App Store) — Detaylı Kılavuz

### 6.1 Ön Koşullar

- **Mac bilgisayar** (zorunlu — iOS build sadece macOS'ta yapılır)
- **Xcode 26+** (App Store → ücretsiz)
- **Apple Developer Program** üyeliği — **yıllık $99** (ücretli uygulama yayınlamak için zorunlu)
- **Apple ID** ile [developer.apple.com](https://developer.apple.com) kaydı

> Apple Developer hesabı olmadan cihaza yükleme yapabilirsin (7 günlük geçici sertifika) ama App Store'a gönderemezsin.

---

### 6.2 Apple Developer Hesabı ve Sertifika

1. [developer.apple.com/account](https://developer.apple.com/account) → **Enroll** → bireysel veya şirket seç
2. $99 ödeme → onay genellikle **birkaç saat – 1 iş günü** sürer
3. Xcode'u aç → **Xcode → Settings → Accounts** → Apple ID'ni ekle
4. Xcode otomatik olarak **Development** ve **Distribution** sertifikalarını oluşturur

---

### 6.3 App Store Connect — Uygulama Kaydı

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps → +**
2. **New App** → Platform: iOS
3. **Bundle ID:** `com.trigon.game` (developer.apple.com → Identifiers'da önce kayıt et)
4. **SKU:** `trigon-ios-001` (dahili takip kodu, mağazada görünmez)
5. **Name:** `Trigon`
6. **Primary Language:** English (veya Turkish)

**Bundle ID oluşturma (developer.apple.com → Certificates, IDs & Profiles → Identifiers):**
- **+** → App IDs → App → Continue
- Description: `Trigon Game`
- Bundle ID (Explicit): `com.trigon.game`
- Capabilities: gerekmiyor (Push Notification, Sign in with Apple vb. yok)
- Register

---

### 6.4 Xcode Ayarları

```bash
npm run cap:open:ios    # Xcode açılır
```

Xcode açıldığında `App` target'ını seç (sol panelde `App` → `Targets → App`):

**General sekmesi:**

| Alan | Değer |
|------|-------|
| Bundle Identifier | `com.trigon.game` |
| Version | `1.0.0` |
| Build | `1` |
| Deployment Target | iOS 16.0+ |

**Signing & Capabilities sekmesi:**

1. **Automatically manage signing** işaretli olsun
2. **Team:** ödeme yaptığın Apple Developer hesabını seç
3. Xcode otomatik provisioning profile oluşturur — sarı uyarı yoksa tamam

---

### 6.5 iOS İkon ve Splash Screen

**App Icon:**

Xcode'da `App → Assets.xcassets → AppIcon` altına tek **1024×1024 PNG** sürükle (alfa kanalı olmadan). Xcode 26+, tek görselden tüm boyutları otomatik türetir.

Gereksinimler:
- Tam opak (şeffaflık yok — Apple reddeder)
- Köşe yuvarlaması yok (sistem uygular)
- Boyut tam 1024×1024 px

**Splash Screen (Launch Screen):**

Capacitor `@capacitor/splash-screen` plugini `launchShowDuration: 1500` ile yapılandırılmış (`capacitor.config.json`). Arka plan rengi `#0a0a12` zaten ayarlı.

Native splash görseli için:
1. Xcode → `App → Assets.xcassets → Splash` (varsa) veya `LaunchScreen.storyboard`
2. Alternatif olarak sadece arka plan rengi yeterli — `#0a0a12` (derin lacivert/siyah) neon temasıyla uyumlu

---

### 6.6 Gerçek iPhone'da Test

1. iPhone'u USB ile Mac'e bağla
2. İlk bağlantıda iPhone'da **"Trust This Computer"** onayla
3. Xcode üst çubuğundan cihazını seç
4. **▶ Run** → uygulama cihaza kurulur (imzalanmış Development build)

**Test edilmesi gereken senaryolar:**

| Senaryo | Beklenen Davranış |
|---------|------------------|
| İlk açılış | Splash 1.5s → neon menü, ses gelir |
| Dynamic Island (iPhone 16 Pro) | HUD elemanları Dynamic Island'a girmiyor |
| Home bar (alt) | HUD alt elemanları home indicator'ın üstünde |
| Notch (eski modeller) | Üst HUD elemanları notch'a girmiyor |
| Portre kilidi | Telefonu yan çevirince döndürmez |
| Ses — ilk dokunuş | AudioContext resume, ses gelir |
| Arka plan → geri dön | Oyun duraklar/devam eder |
| iPad (varsa) | Ekran düzgün ölçeklenir |

**Safari Web Inspector ile debug (iPhone):**

1. iPhone → **Ayarlar → Safari → Gelişmiş → Web Inspector**'u aç
2. Mac'te Safari → **Develop → [cihaz adı] → Trigon WebView**
3. Console, Network, Performance sekmelerini kullan

---

### 6.7 TestFlight — Dahili Test

1. Xcode → **Product → Archive** (scheme: Release, destination: Any iOS Device)
2. Archive tamamlandığında **Organizer** penceresi açılır
3. **Distribute App → App Store Connect → Upload**
4. İşlem ~5 dakika sürer, App Store Connect'te "Processing" görünür

App Store Connect'te:
1. **TestFlight** sekmesi → build görünür (processing bittikten sonra)
2. **Internal Testing:** ekip üyelerini ekle (Apple Developer hesaplı, max 100 kişi)
3. **External Testing:** dışarıdan test kullanıcıları — Apple'ın kısa incelemesinden (~24 saat) geçer
4. Test linki paylaş → kullanıcılar TestFlight uygulamasından yükler

---

### 6.8 Ücretli Uygulama Fiyatlandırması

App Store Connect → **My Apps → Trigon → Pricing and Availability:**

1. **Price:** istediğin fiyat katmanını seç (Tier 1 = $0.99 / ₺39.99, Tier 2 = $1.99 / ₺79.99, vb.)
2. Apple, yerel para birimlerini otomatik hesaplar
3. **Availability:** tüm ülkeler veya belirli pazarlar seçilebilir
4. **Apple'ın kesintisi:** %30 (ilk yıl $1M altı gelirde %15'e düşer — Small Business Program)

> Ücretli uygulama için **Banking ve Tax** bilgilerini App Store Connect → **Agreements, Tax, and Banking** bölümünde doldurman zorunlu. ABD vergi formu (W-8BEN) + banka IBAN bilgisi gerekir.

---

### 6.9 Store Listing — App Store

App Store Connect → **App Store → App Information + Version Information:**

| Alan | İçerik |
|------|--------|
| Name | Trigon |
| Subtitle (30 karakter) | *Neon Bullet Hell Survivor* |
| Privacy Policy URL | Zorunlu |
| Category | Games → Action (veya Arcade) |
| Age Rating | 4+ (soyut geometri, şiddet yok) |
| Screenshots (iPhone 6.9") | En az 3 adet, 1320×2868 px |
| Screenshots (iPad Pro 13") | App Store Connect zorunlu tutabilir |
| Promotional Text (170 kar.) | Değişiklik için inceleme gerekmez |
| Description | Oyun mekaniği, prestige sistemi, özellikler |
| Keywords (100 karakter) | `bullet hell,neon,arcade,survivor,shooter,hypercasual` |
| Support URL | GitHub Pages veya kendi domain |

---

### 6.10 App Review Gönderimi

1. App Store Connect → **Pricing** doldur
2. **Banking/Tax** bilgileri tamamlandı mı kontrol et (ücretli uygulama için zorunlu)
3. **App Privacy** → Data Collection: Hayır (localStorage cihazda kalır)
4. **Version Release:** Automatic veya Manual (inceleme sonrası hemen veya kendin yayınla)
5. **Submit for Review**

**İnceleme süresi:** genellikle **24–48 saat**. Reddetme nedenleri:
- Gizlilik politikası eksik
- Ekran görüntüleri gerçek cihaz görünümüne uymayan
- Çöküş / performans sorunu (Apple cihazlarda test eder)
- Metadata'da yanıltıcı içerik

**Reddetme durumunda:** Resolution Center üzerinden Apple ile iletişim kur, yanıt ver veya güncelle, tekrar gönder.

---

### 6.11 iOS'a Özgü Kontroller

| Kontrol | Detay |
|---------|-------|
| Safe Area | iPhone 16 Pro'da (Dynamic Island) HUD taşmıyor mu? |
| Home bar | Alt kenar HUD elementleri home bar'ın altında kalıyor mu? |
| Ses izni | İlk dokunuşta AudioContext unlock çalışıyor mu? |
| Notch | Üst HUD elemanları notch'a girmiyor mu? |
| Haptic | `@capacitor/haptics` vuruşlarda titreşim veriyor mu? |
| Arka plan müzik | Telefon sessiz modundayken (ring/silent switch) ses durumu? |

---

## Hızlı Referans — Komut Listesi

```bash
# Her yeni değişiklikten sonra
npm run build && npx cap sync

# Android'i aç
npx cap open android

# Release AAB üret (terminal)
cd android && ./gradlew bundleRelease

# iOS'u aç
npx cap open ios
```

---

## Versiyon Stratejisi

| Tip | Ne Zaman | `versionCode` |
|-----|----------|---------------|
| Patch (1.0.1) | Bug fix, balance tweak | +1 |
| Minor (1.1.0) | Yeni düşman tipi, yeni özellik | +1 |
| Major (2.0.0) | Yeniden tasarım, engine değişikliği | +1 |

> Play Store'da her yüklemede `versionCode` mutlaka artmalıdır (integer, `versionName`'den bağımsız).
