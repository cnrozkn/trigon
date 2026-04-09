# TRIGONX — Product Requirements Document (PRD)

> **Son Güncelleme:** 7 Nisan 2026  
> **Versiyon:** 1.2.0  
> **Durum:** Aktif Geliştirme (Modüler Mimari)

---

## 1. Proje Özeti

**Trigonx**, hiçbir harici görsel asset kullanılmadan tamamen geometrik şekillerle oluşturulmuş bir **neon bullet-hell / auto-shooter** hypercasual oyundur.

- **Tür:** Hypercasual Auto-Shooter / Bullet Hell
- **Tema:** Neon geometri, synthwave estetiği
- **Platform:** Web (Vite) → Mobil (Capacitor iOS/Android)
- **Hedef Kitle:** Casual oyuncular, 15-35 yaş, kısa oturum sevenler
- **Oturum Süresi Hedefi:** 2-5 dakika / run

---

## 2. Teknik Stack

### 2.1 Runtime Bağımlılıkları

| Katman | Teknoloji | Hedef Versiyon | Açıklama |
|--------|-----------|----------------|----------|
| Game Engine | Phaser | **3.90.0** (latest stable) | Phaser 4 RC mevcut ama production-ready değil |
| Bundler | Vite | **8.0.3** (latest stable) | Dev server + production build |
| Dil | Vanilla JavaScript | ES2022+ (ES Modules) | TypeScript geçişi opsiyonel |
| Mobil Bridge | Capacitor | **8.3.0** (latest stable) | Native iOS/Android bridge |
| Capacitor iOS | @capacitor/ios | **8.3.0** | iOS native runtime |
| Capacitor Android | @capacitor/android | **8.3.0** | Android native runtime |
| Fizik | Phaser Arcade Physics | (built-in) | Gravity: 0, düz fizik |
| Asset Pipeline | Runtime Graphics API | — | 0 harici asset, tüm texture'lar kod ile üretilir |

### 2.2 Geliştirme Araçları Gereksinimleri

| Araç | Minimum Versiyon | Not |
|------|------------------|-----|
| Node.js | **22.x LTS** | Capacitor 8 zorunluluğu |
| npm | **10.x+** | Node 22 ile birlikte gelir |
| Xcode | **26.0** | iOS build için — Apple 28 Nisan 2026 sonrası zorunlu |
| macOS | **Sequoia 15.6+** | Xcode 26 gereksininimi |
| Android Studio | **Otter (2025.2.1+)** | Android build için |
| JDK | **17+** | Android Gradle build gereksininimi |
| CocoaPods | **1.16+** | iOS dependency yönetimi |

### 2.3 Mobil Platform Hedefleri

| Platform | Min Desteklenen OS | Target SDK/OS | Mağaza Gereksinimleri |
|----------|-------------------|---------------|----------------------|
| iOS | **iOS 15.0** | **iOS 26 SDK** | Xcode 26 + iOS 26 SDK ile build (28 Nisan 2026 sonrası zorunlu) |
| Android | **API 24** (Android 7.0) | **API 36** (Android 16) | 31 Ağustos 2026 sonrası target API 36 zorunlu |

---

## 3. Proje Dosya Yapısı

```
trigon/
├── index.html              # Giriş HTML (viewport, CSS reset, container)
├── package.json            # Bağımlılıklar ve scriptler
├── vite.config.js          # Vite yapılandırması (phaser alias)
├── capacitor.config.json   # Capacitor mobil yapılandırması
├── docs/                   # Proje dökümanları
│   ├── PRD.md              # Bu döküman
│   └── RELEASE_CHECKLIST.md # Canlıya çıkış hazırlık kontrol listesi
├── ios/                    # (Capacitor) Native iOS projesi (cap add ios ile oluşur)
├── android/                # (Capacitor) Native Android projesi (cap add android ile oluşur)
├── dist/                   # Vite build çıktısı
└── src/
    ├── main.js             # Oyun bootstrap (Phaser config, viewport sync)
    ├── data/               # Veri tanımları (Constants, Upgrades)
    ├── audio/              # Ses motoru ve SFX yönetimi
    ├── scenes/             # Oyun sahneleri (Boot, Menu, Play, UI, Prestige, Achievements)
    ├── systems/            # Oyun sistemleri (WaveManager, Collision, VFX, Background, Powerup)
    └── utils/              # Yardımcı araçlar (Storage, Platform sync)
```

---

## 4. Sahne Akışı

```
Boot.js → Menu.js → PlayScene.js (+ UIScene paralel)
                         ↓ (Game Over)
                      Menu.js / PrestigeShop.js
```

### 4.1 Boot.js — Texture Üretimi

Boot sahnesi Phaser Graphics API kullanarak tüm oyun texture'larını runtime'da üretir. **Hiçbir harici PNG/SVG yok.**

Üretilen texture'lar:

| Texture Key | Boyut | Açıklama | Kullanılıyor mu? |
|-------------|-------|----------|------------------|
| `player` | 48×48 | Beyaz üçgen, cyan neon kenar | ✅ Evet |
| `bullet` | 6×20 | Cyan ince rounded bar | ✅ Evet |
| `enemy` | 40×40 | Pembe neon halka daire (çift ring) | ✅ Evet |
| `particle_square` | 8×8 | Pembe kare parçacık | ✅ Evet |
| `particle_dot` | 6×6 | Beyaz nokta parçacık | ✅ Evet |
| `powerup_shield` | 36×36 | Mavi çift halka + merkez nokta | ✅ Evet |
| `powerup_pierce` | 36×36 | Sarı ok ikonu | ✅ Evet |
| `powerup_slow` | 36×36 | Yeşil kum saati ikonu | ✅ Evet |
| `skill_sweep_line` | 400×18 | Yeşil neon süpürme çubuğu | ❌ Hayır (Kullanılmıyor) |
| `boss_pentagon` | 120×120 | Mor-pembe pentagon (Boss Tip A) | ✅ Evet |
| `boss_hexagon` | 120×120 | Mor hexagon (Boss Tip B) | ✅ Evet |

### 4.2 Menu.js — Başlık Ekranı

- "TRIGONX" başlık: 52px, cyan (#00ffcc), pembe stroke (#ff00aa), cyan glow
- "Neon Bullet Hell" alt başlık: 18px, açık mor (#ccaaff)
- "Tap to Play" animasyonlu prompt: alpha 1↔0.35, 700ms yoyo loop
- Herhangi bir dokunuşta → PlayScene'e geçiş
- Responsive: resize event'e bağlı layout

### 4.3 PlayScene.js — Oyun Orkestrasyonu
Artık monolitik bir yapıdan ziyade, sistemleri yöneten bir orkestra şefi rolündedir.

### 4.4 UIScene.js — Arayüz Yönetimi
Tüm HUD (Skor, Level, Combo, Skill) ve Overlay'lerin (Pause, Game Over, Onboarding) yönetimini üstlenir. Event-based iletişim kullanılır.

---

## 5. Oynanış Mekanikleri

### 5.1 Oyuncu Kontrolü

- **Input:** Mouse/touch pointer X pozisyonunu takip (pointermove + pointerdown)
- **Hareket:** `Phaser.Math.Linear` ile yumuşak takip (lerp faktörü: 0.22)
- **Pozisyon:** Ekranın altında sabit Y (height - 90px)
- **Filo:** 1-6 üçgen yan yana, 36px aralık, merkez noktası formationX
- **Sınırlar:** Playfield margin (22px) içinde kalmak zorunda

### 5.2 Otomatik Ateş Sistemi

| Parametre | Değer |
|-----------|-------|
| Base ateş aralığı | 380ms |
| Minimum ateş aralığı | 120ms |
| Mermi hızı | -470 (base), frost aktifken daha hızlı |
| Base hasar | 1 + damageLevel |
| Crit şansı | critLevel × %8 |
| Crit çarpanı | 2× |

- Her aktif üçgen bağımsız ateş eder
- Multishot: level 1 = side shot, level 2 = arc shot (ek splash etkisi)
- Pierce: mermi düşmandan geçer (pierceLevel kadar)
- Frost: frostLevel × %18 şans, 1.4s + frostLevel×350ms yavaşlatma
- Ateş animasyonu: scale pulse 1.14× (70ms yoyo)

### 5.3 Düşman Sistemi

#### Normal Düşmanlar
| Parametre | Değer |
|-----------|-------|
| Spawn aralığı | Wave tanımları + level tabanlı delay çarpanı |
| Dalga boyutu | Level'e göre dinamik (WaveDefinitions) |
| HP | `enemyBaseHP(level)` + tür bazlı `scaleHealth`; level 15+ sonrası sert ramp |
| Hız çarpanı | Level'e göre parça parça artış; 15+ sonrası daha agresif |
| Hareket | Dikey düşüş + hafif yatay random + duvardan sekme |
| Görünüm | Pembe neon halka, HP sayısı üzerinde |

#### Boss Düşmanlar
| Parametre | Değer |
|-----------|-------|
| Spawn | Her 5 level'da bir (level 5, 10, 15...) |
| HP | `38 + level*7` + level 15+ boss ramp |
| Hareket | Sinüs/kosinüs dalga + pattern bazlı mermi atakları |
| Skor ödülü | 250 puan |
| Görünüm | Pentagon (tek levels/5) veya Hexagon (çift levels/5) |
| Wall bounce | Playfield kenarlarından yansıma (BOSS_X_PAD = 56) |

### 5.4 Progression

| Mekanik | Detay |
|---------|-------|
| Seviye atlama | Her 10 kill = +1 level |
| Seviye efekti | Düşman hızı artar, spawn hızlanır, HP yükselir |
| Oyuncu tint | Level 1-4: beyaz, 5-9: yeşil, 10-14: cyan, 15+: pembe |
| Düşman tint | Level 1-4: pembe, 5-9: turuncu, 10-14: sarı, 15+: kırmızı |

### 5.5 Roguelite Upgrade Draft Sistemi

**Tetikleme:** Level clear sonrası otomatik açılır (`onLevelCleared -> openUpgradeSelection`).

**Draft Akışı:**
1. Oyun duraklatılır (physics pause, timer pause)
2. Karanlık overlay gösterilir (duruma göre 0.52-0.68)
3. 3 kart sunulur (ağırlıklı rastgele seçim)
4. Oyuncu bir kart seçer → upgrade uygulanır → bir sonraki level akışı devam eder

**Kart Havuzu:**

| Key | Label | Rarity | Weight | Max | Renk |
|-----|-------|--------|--------|-----|------|
| `fire` | Rapid Fire | Common | 6 | 6 | 0x22cc88 |
| `damage` | Heavy Rounds | Common | 6 | 5 | 0xcc8822 |
| `shield` | Shield Core | Common | 6 | 5 | 0x4488ff |
| `triangle` | Tri-Fleet | Rare | 3 | 6 | 0x55aaff |
| `pierce` | Piercing Shots | Rare | 3 | 3 | 0xffcc66 |
| `multi` | Multi Shot | Rare | 3 | 2 | 0xff66cc |
| `crit` | Critical Core | Rare | 3 | 4 | 0xff9966 |
| `frost` | Frost Rounds | Epic | 1 | 3 | 0x66e6ff |

**Draft Kontrolleri:**
- **Reroll:** Tüm kartları yenile (turda 2 hak)
- **Banish:** Bir kartı bu draft sırasında havuzdan çıkar (yerine yeni kart gelir)
- **Seçim:** Karta tıkla → upgrade uygula → oyuna dön
- **Stack gösterimi:** `currentValue/maxValue → nextValue/maxValue`

### 5.6 Kalkan (Shield) Mekanizması

- shieldCharges > 0 iken düşman çarpması → düşman ölür, kalkan -1, oyuncu hayatta
- shieldCharges = 0 → game over
- Shield upgrade'i ile max 5'e kadar şarj biriktirilir

### 5.7 Sistem Yöneticileri (Managers)
- **VFXManager:** Tüm parçacık ve görsel efektlerin merkezi yönetimi.
- **CollisionManager:** Fizik etkileşimleri ve hasar hesaplamalarının yönetimi.
- **BackgroundManager:** Dinamik arkaplan, grid ve playfield görselleri.
- **WaveManager:** Düşman dalgalarının ve progresyonun yönetimi.
- **PowerupSystem:** Geçici buff ve efektlerin takibi.

### 5.8 Destekleyici Özellikler
- **Fever Mode:** Hızlı düşman kesme ile dolan bar, aktifleştiğinde mermi hızını ve ateş oranını artırır.
- **Combo/Streak:** Ardışık skorlarla artan katsayılar.
- **Onboarding:** Yeni oyuncular için 3 adımlı eğitim süreci.
- **Audio Engine:** Dinamik SFX ve müzik yönetimi, kullanıcı ayarlarının kalıcılığı.
- **Achievement/Prestige:** Uzun vadeli progresyon mekanikleri.
- **Game Over:** Özelleştirilmiş sonuç ekranı, istatistiklerin kaydedilmesi.

---

## 6. Görsel Kimlik

### Renk Paleti

| Kullanım | Hex | Açıklama |
|----------|-----|----------|
| Arkaplan | `#0a0a12` | Çok koyu lacivert-siyah |
| Oyuncu | `#ffffff` fill + `#aaffff` stroke | Beyaz üçgen, cyan kenar |
| Mermi | `#88ffff` | Parlak cyan bar |
| Düşman | `#ff66aa` | Neon pembe halka |
| Boss Pentagon | `#330022` fill + `#ff00aa` stroke | Koyu pembe pentagon |
| Boss Hexagon | `#221133` fill + `#aa66ff` stroke | Koyu mor hexagon |
| Başlık | `#00ffcc` text + `#ff00aa` stroke | Cyan text, pembe kenar |
| HUD | `#aaffff` | Açık cyan metin |
| Partiküller | `#ff88ee`, `#ff66cc`, `#66ffff` | Pembe/cyan karışım |

### Tipografi
- **Font:** `system-ui, sans-serif` (tüm metinler)
- **Monospace:** `system-ui, monospace` (düşman HP, stack label)
- Özel font kullanılmıyor

### Visual Effects
- **Particle emitter (death):** ADD blend, kare parçacıklar, 450ms ömür
- **Particle emitter (sparkle):** ADD blend, nokta parçacıklar, 350ms ömür
- **Ateş animasyonu:** Scale pulse (1 → 1.14 → 1, 70ms)
- **Hit flash:** Düşman renk değişimi (70ms) → crit: sarı, normal: açık kırmızı
- **Game over:** Camera shake + particle burst + player fade

---

## 7. Playfield & Sınırlar

| Parametre | Değer |
|-----------|-------|
| Playfield margin | 22px (her iki yandan) |
| Çerçeve | Çift çizgi (mavi-gri, alpha 0.55/0.35) |
| World bounds | X: margin–(width-margin), Y: -320 – (height+420) |
| Düşman bounce | Yan duvarlardan yansıma, üst/alttan geçiş |
| Boss X pad | 56px (duvar mesafesi) |
| Mermi recycle | Y < -55 otomatik geri dönüşüm |
| Düşman recycle | Y > height + 95 otomatik geri dönüşüm |

---

## 8. Sabitler & Yapılandırma Referansı

```javascript
const START_PLAYER_COUNT = 1;      // Başlangıç üçgen sayısı
const MAX_PLAYER_COUNT = 6;        // Max üçgen sayısı
const KILLS_PER_LEVEL = 10;        // Seviye atlama kill sayısı
const BASE_FIRE_MS = 380;          // Base ateş aralığı
const MIN_FIRE_MS = 120;           // Min ateş aralığı
const DRAFT_REROLLS = 2;           // Draft reroll hakkı
const PLAYFIELD_MARGIN = 22;       // Playfield kenar boşluğu
const BOSS_X_PAD = 56;             // Boss duvar mesafesi
```

---

## 9. Bilinen Kısıtlamalar (Mevcut Durum)

1. **Performans Optimizasyonu** — Çok fazla mermi ve düşman olduğunda FPS düşüşleri.
2. **Kısıtlı Düşman Hareketleri** — Düşman yapay zekası hala basit dikey/sinüs hareketlerle sınırlı.
3. **Multi-Language Desteği** — Bazı kısımlar hala İngilizce/Türkçe karışık.
4. **Boss Çeşitliliği** — Sadece 2 ana boss tipi mevcut, mekanikler geliştirilebilir.
5. **Asset Pipeline** — Bazı efektler hala doğrudan kod içinde poligon çizimiyle yapılıyor, shader desteği eklenebilir.
