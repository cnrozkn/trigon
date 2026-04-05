# TRIGON — Geliştirme Yol Haritası (ROADMAP)

> **Son Güncelleme:** 3 Nisan 2026 (Aşama 0 + Aşama 2 teslimat güncellemesi)  
> **Referans:** [PRD.md](./PRD.md)  
> **Kullanım:** Her aşama bağımsız olarak AI'a verilebilir. Aşamalar sırasıyla yapılmalıdır.

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

## AŞAMA 0: TECH STACK GÜNCELLEMESİ

**Durum:** Büyük ölçüde tamamlandı (konfigürasyon + build/dev + CLI tooling doğrulandı, Android Studio GUI kontrolü manuel beklemede)

**Hedef:** Tüm bağımlılıkları en stabil ve güncel sürümlere yükselt. Mağaza gereksinimlerini karşılayacak tooling kurulumunu yap.

**Tahmini Efor:** Düşük  
**Bağımlılık:** Yok (ilk aşama)

### 0.1 Runtime Bağımlılık Güncellemeleri

**Mevcut → Hedef sürümler:**

| Bağımlılık | Mevcut | Hedef | Değişiklik |
|------------|--------|-------|------------|
| phaser | 3.90.0 | **3.90.0** | ✅ Zaten güncel (Phaser 4 RC var ama production-ready değil) |
| vite | ^6.0.0 | **^8.0.3** | ⬆️ Major upgrade (6 → 8) |
| @capacitor/core | ^6.2.0 | **^8.3.0** | ⬆️ Major upgrade (6 → 8) |
| @capacitor/ios | ^6.2.0 | **^8.3.0** | ⬆️ Major upgrade |
| @capacitor/android | ^6.2.0 | **^8.3.0** | ⬆️ Major upgrade |
| @capacitor/cli (dev) | ^6.2.0 | **^8.3.0** | ⬆️ Major upgrade |

**Yapılacaklar:**
- [x] Node.js 22 LTS kurulumu doğrula: `node -v` → v22.x olmalı
- [x] `package.json` bağımlılıklarını güncelle
- [x] `npm install` ile temiz kurulum
- [x] Vite 8 breaking changes kontrol:
  - `vite.config.js` syntax uyumu
  - `optimizeDeps` yapılandırması hala geçerli mi
  - Phaser alias hala çalışıyor mu
- [x] Capacitor 8 migration:
  - `capacitor.config.json` → `capacitor.config.ts` (opsiyonel ama önerilen)
  - `appId` alanı eklenmeli (örn: `com.trigon.game`)
  - `webDir: 'dist'` doğrulanmalı
- [x] `npm run dev` ile oyunun hala çalıştığını doğrula
- [x] `npm run build` ile production build başarılı mı kontrol et

### 0.2 Vite Config Güncellemesi

**Yapılacaklar:**
- [x] `vite.config.js` güncelle:
  ```javascript
  import { defineConfig } from 'vite';

  export default defineConfig({
    base: './',
    resolve: {
      alias: {
        phaser: 'phaser/dist/phaser.esm.js',
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2022',        // Modern browser target
      sourcemap: false,         // Production'da kapalı
      minify: 'esbuild',       // Hızlı minification
    },
    optimizeDeps: {
      exclude: ['phaser'],
    },
  });
  ```

### 0.3 Capacitor Config Güncellemesi

**Yapılacaklar:**
- [x] `capacitor.config.json` güncelle:
  ```json
  {
    "appId": "com.trigon.game",
    "appName": "Trigon",
    "webDir": "dist",
    "server": {
      "androidScheme": "https"
    },
    "ios": {
      "contentInset": "always",
      "allowsLinkPreview": false
    },
    "android": {
      "allowMixedContent": false
    }
  }
  ```

### 0.4 Geliştirme Araçları Doğrulama

**Yapılacaklar:**
- [x] Aşağıdaki araçların minimum sürümlerini kontrol et:

  | Araç | Minimum | Kontrol Komutu |
  |------|---------|----------------|
  | Node.js | 22.x LTS | `node -v` |
  | npm | 10.x+ | `npm -v` |
  | Xcode | 26.0 | `xcodebuild -version` |
  | macOS | Sequoia 15.6+ | `sw_vers` |
  | Android Studio | Otter 2025.2.1+ | Android Studio → About |
  | JDK | 17+ | `java -version` |
  | CocoaPods | 1.16+ | `pod --version` |

- [x] Eksik araçlar varsa kurulum notlarını belge
- [x] Bu kontroller Aşama 7'de tekrar gerekecek — burada temel hazırlık yapılır

**Doğrulama Notları (3 Nisan 2026):**
- Node.js: `v22.21.1` ✅ (hedef: 22.x)
- npm: `10.9.4` ✅ (hedef: 10.x+)
- Xcode: `26.2` ✅ (hedef: 26.0+)
- macOS: `15.7.3` ✅ (hedef: Sequoia 15.6+)
- JDK: `21.0.9` ✅ (hedef: 17+)
- CocoaPods: `1.16.2` ✅ (hedef: 1.16+)
- Android Studio: CLI üzerinden doğrulanamadı; **About ekranından manuel kontrol bekliyor** ⏳
- `npm run dev`: Vite 8.0.3 sağlıklı açıldı (`http://localhost:5173`) ✅
- `npm run build`: production build başarılı ✅

### 0.5 package.json Hedef Durumu

```json
{
  "name": "trigon",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:host": "vite --host",
    "build": "vite build",
    "preview": "vite preview",
    "cap:sync": "npm run build && npx cap sync",
    "cap:add:android": "npx cap add android",
    "cap:add:ios": "npx cap add ios",
    "cap:open:ios": "npx cap open ios",
    "cap:open:android": "npx cap open android"
  },
  "dependencies": {
    "@capacitor/android": "^8.3.0",
    "@capacitor/core": "^8.3.0",
    "@capacitor/ios": "^8.3.0",
    "phaser": "3.90.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.3.0",
    "esbuild": "^0.27.7",
    "vite": "^8.0.3"
  }
}
```

---

## AŞAMA 1: JUICE & GÖRSEL POLISH

**Durum:** Tamamlandı

**Hedef:** Oyunu "canlı" ve "sulu" hissettirir. Tek bir mekanik değişmez; sadece görsel/hissi geri bildirim eklenir.

**Tahmini Efor:** Orta  
**Bağımlılık:** Yok (ilk aşama)

### 1.1 Canlı Arka Plan

**Mevcut:** Düz siyah arkaplan (#0a0a12) — cansız, boş.

**Yapılacaklar:**
- [x] **Kayan grid çizgileri:** İnce, düşük-alpha neon çizgiler yavaşça yukarı kayar (Geometry Wars tarzı)
  - Dikey ve yatay çizgiler, 60-80px aralık
  - Renk: `rgba(100, 180, 255, 0.06)` gibi çok soluk mavi
  - Hız: ~15-20 px/saniye yukarı kayma
  - Phaser TileSprite veya shader-free Graphics API ile çizilebilir
- [x] **Breathing glow:** Arkaplanın koyu mavi ↔ koyu mor arası nefes alırcasına 8-10 saniyelik döngüde geçişi
  - Merkezdeki radial gradient'in alpha'sı pulse eder
  - `alpha: 0.03 → 0.08 → 0.03` gibi çok subtle
- [x] **Seviyeye göre renk shift:** Level arttıkça arka plan tonu kademeli değişir
  - Level 1-4: Koyu mavi
  - Level 5-9: Koyu mor
  - Level 10-14: Koyu kırmızı-mor
  - Level 15+: Koyu amber
  - Geçişler smooth tween ile

### 1.2 Player Trail (İz Efekti)

**Mevcut:** Oyuncu hareket ederken hiçbir iz bırakmıyor.

**Yapılacaklar:**
- [x] **Afterimage trail:** Hareket sırasında geride soluk ghost üçgenler bırakılır
  - Her 3-4 frame'de bir ghost sprite spawn, alpha 0.3 → 0 (200ms)
  - Hareket hızına göre yoğunluk artabilir
- [x] **Kalkan halka efekti:** shieldCharges > 0 iken oyuncu etrafında dönen ince halka
  - Halka sayısı = shield charge sayısı
  - Yavaş rotasyon (1 tur / 3 saniye)
  - Renk: `#4488ff` soluk mavi

### 1.3 Mermi Juice

**Mevcut:** Mermiler düz çizgi olarak gidiyor, isabet anında sadece düşman renk değiştiriyor.

**Yapılacaklar:**
- [x] **Muzzle flash:** Ateş anında üçgenin ucunda küçük beyaz/cyan patlama (3-4 partikül, 80ms ömür)
- [x] **Bullet trail:** Merminin arkasında ince cyan çizgi (afterimage veya trail particles)
  - Her 2 frame'de 1 partikül, alpha 0.4 → 0, 150ms ömür
- [x] **Impact burst:** İsabet anında küçük yıldız/spark patlaması
  - Normal hit: 4-5 küçük cyan partikül
  - Crit hit: 8-10 büyük altın partikül + floating "+CRIT" text (500ms yukarı kayarak kaybolur)

### 1.4 Düşman Ölüm Juice

**Mevcut:** Partiküller var ama yetersiz. Sadece kare/nokta patlama.

**Yapılacaklar:**
- [x] **Wireframe genişleme:** Ölüm anında düşmanın outline'ı genişleyerek kaybolur (scale 1 → 2.5, alpha 1 → 0, 200ms)
- [x] **Frame freeze:** Her kill'de 30-50ms physics duraklaması (hit-stop / freeze frame effect)
  - Sadece hissedilir, oyunu yavaşlatmaz
  - Boss kill'de 150ms freeze + beyaz flash
- [x] **Geometrik parça dağılımı:** Ölüm parçalarının küçük üçgen/daire olarak dağılması (mevcut kareye ek)

### 1.5 Damage Popup Numbers

**Mevcut:** Yok. Hasar görünmüyor.

**Yapılacaklar:**
- [x] İsabet anında düşman pozisyonunda hasar miktarı görünsün
- [x] Normal hit: beyaz "1" (veya hasar miktarı), küçük font, 400ms yukarı kayarak kaybolur
- [x] Crit hit: altın büyük font "4!" (hasar×2), scale-in animasyonu, 600ms
- [x] Frost hit: mavi "❄ 1" göstergesi

### 1.6 Playfield Çerçeve İyileştirmesi

**Mevcut:** İnce statik çerçeve.

**Yapılacaklar:**

- [x] Level atlandığında çerçevenin kısa bir pulse animasyonu (lineWidth 2 → 4 → 2, 300ms)

### 1.7 Menu Ekranı Polish

**Mevcut:** Sadece text var, arkaplan boş.

**Yapılacaklar:**
- [x] Menü arkasında yavaş dönen büyük geometrik şekil (üçgen veya hexagon wireframe)
- [x] Küçük yüzen parçacıklar (ambient particles — yavaş, random yönlü, düşük alpha)
- [x] "Tap to Play" text'ine scale pulse eklenmesi (sadece alpha değil, hafif büyüme de)

---

## AŞAMA 2: SES SİSTEMİ

**Durum:** Tamamlandı (v1 — Web Audio procedural ses + adaptif müzik + kill streak notaları)

**Hedef:** Web Audio API ile procedural ses üretimi. Harici ses dosyası kullanılmaz — tamamen kod ile üretilir (0-asset felsefesine uygun).

**Tahmini Efor:** Yüksek  
**Bağımlılık:** Aşama 1 tamamlanmış olmalı (görsel feedback ile senkronize ses)

### 2.1 Ses Motoru Altyapısı

**Yapılacaklar:**
- [x] `src/audio/SoundEngine.js` — Web Audio API wrapper sınıfı
  - AudioContext yönetimi (user gesture ile resume)
  - Master volume kontrolü
  - SFX volume ve Music volume ayrı kanal
  - Mute/unmute desteği
- [x] Mobilde ses başlatma: İlk dokunuşta AudioContext.resume()
- [x] Ses ayarları localStorage'da saklanmalı

### 2.2 Procedural SFX

Tüm sesler oscillator + gain + filter ile kod içinde üretilir:

| SFX | Yöntem | Süre |
|-----|--------|------|
| **Ateş** | Kısa beyaz gürültü burst + high-pass filter | 50ms |
| **İsabet** | Düşük frekanslı thump + noise | 80ms |
| **Crit** | Yüksek pitch metalik ting | 100ms |
| **Düşman ölüm** | Kısa patlama (noise → silence, pitch drop) | 120ms |
| **Boss ölüm** | Uzun reverse cymbal + bass boom | 500ms |
| **Kalkan absorb** | Cam tınlaması (sine wave, hızlı fade) | 150ms |
| **Level up** | Yükselen arpej (3 nota: C-E-G) | 300ms |
| **Game over** | Aşağı inen pitch + reverb trail | 800ms |
| **Upgrade seçim** | UI konfirm ses (kısa çift beep) | 100ms |
| **Reroll** | Kart karıştırma sesi (noise burst dizisi) | 200ms |
| **Banish** | Uzaklaşan woosh | 250ms |

### 2.3 Procedural Müzik (Basit Synth Loop)

- [x] `src/audio/MusicEngine.js` — Basit arpejatör tabanlı müzik döngüsü
  - Pentatonik scale (A minor pentatonic: A-C-D-E-G)
  - Tempo: 120-140 BPM
  - Bass: Düşük sine wave, her beat'te kök nota
  - Arpej: Rastgele pentatonik nota seçimi, 8th note pattern
  - Pad: Sürekli çalan düşük-volume chord drone
- [x] **Adaptive katmanlar:**
  - Level 1-4: Sadece ambient pad
  - Level 5-9: + bass line
  - Level 10+: + arpej melody
  - Boss fight: + percussion (kick hat pattern)
  - Upgrade seçimi sırasında: müzik volume %30'a düşer

### 2.4 Kill Streak Melodisi

- [x] Ardışık kill'lerde her kill farklı nota çalar (pentatonik sırada)
  - Kill 1: A4, Kill 2: C5, Kill 3: D5, Kill 4: E5, Kill 5: G5, Kill 6: A5 → tekrar
  - Streak kırılınca nota sıfırlanır
  - Bu, oyuncunun bilinçsiz olarak kill ritmine bağlanmasını sağlar

**Uygulama Notları (v1):**
- `src/audio/` altında `SoundEngine`, `MusicEngine` ve facade eklendi.
- Olay tabanlı SFX entegrasyonu `PlayScene` akışına bağlandı (fire/hit/crit/death/boss/shield/level/gameover/draft).
- Menüden oyuna ilk dokunuşta güvenli `resume` akışı eklendi.
- Ses ayarları `src/utils/Storage.js` ile localStorage’da saklanıyor.

---

## AŞAMA 3: HUD, UI & META-GAME

**Durum:** Tamamlandı

**Hedef:** Oyuncuya ilerleme hissi ver, verileri sakla, profesyonel UI oluştur.

**Tahmini Efor:** Orta  
**Bağımlılık:** Aşama 1 tamamlanmış olmalı

### 3.1 Gelişmiş HUD

**Mevcut:** Sadece "Score: XXX" metni sol üstte.

**Yapılacaklar:**
- [x] **Level göstergesi:** Sol üstte "LV.5" gibi seviye numarası

- [x] **Combo sayacı:** Ekranın ortasında büyük font (aktif combo sırasında)
  - "×3" "×5" "×10" gibi büyüyen gösterim
  - Combo bitmeden görünür, bitince fade-out

### 3.2 Game Over Ekranı

**Mevcut:** Yok. Direkt menüye dönüş.

**Yapılacaklar:**
- [x] PlayScene'de game over durumunda overlay ekranı göster:
  - "GAME OVER" başlık (büyük, kırmızı pulsing)
  - Final skor (büyük font)
  - Ulaşılan seviye
  - High score karşılaştırması ("NEW BEST!" animasyonu veya "Best: XXXX")
  - Total kills this run
  - "Tap to Retry" butonu → PlayScene restart
  - "Menu" butonu → Menu sahnesine dön
- [x] Game over ekranında run istatistikleri:
  - Süre (ne kadar oynadı)
  - En yüksek combo
  - Seçilen upgrade'ler listesi

### 3.3 Data Persistence (localStorage)

**Mevcut:** Hiçbir veri kayıt edilmiyor.

**Yapılacaklar:**
- [x] `src/utils/Storage.js` — localStorage wrapper
- [x] Kaydedilecek veriler:
  ```javascript
  {
    highScore: number,
    bestLevel: number,
    totalGamesPlayed: number,
    totalKills: number,
    totalPlayTimeMs: number,
    settings: {
      sfxVolume: number,      // 0-1
      musicVolume: number,    // 0-1
      hapticEnabled: boolean
    }
  }
  ```
- [x] Her run sonunda otomatik kayıt
- [x] Menu ekranında high score gösterimi

### 3.4 Pause Sistemi

**Mevcut:** Yok.

**Yapılacaklar:**
- [x] Sağ üst köşede pause butonu (iki dikey bar ikonu, Graphics API ile)
- [x] Pause overlay:
  - "PAUSED" başlık
  - "Resume" butonu
  - "Restart" butonu
  - "Menu" butonu
  - Ses ayarları (SFX/Music volume slider'ları)
- [x] Pause sırasında physics, fire timer, spawn timer, upgrade timer duraklatılır
- [x] Upgrade modal açıkken pause butonu gizlenir

### 3.5 Upgrade Modal İyileştirmesi

**Mevcut:** Çalışıyor ama polish eksik.

**Yapılacaklar:**
- [x] Kart seçildiğinde flip/glow animasyonu
- [x] Her rarity'nin farklı parlama efekti: Common → yeşil glow, Rare → mavi glow, Epic → mor glow
- [x] Kartların hover'ında scale-up + glow intensify
- [x] Modal açılırken kartlar aşağıdan yukarı slide-in animasyonu ile gelsin
- [x] Seçim sonrası kısa "upgrade acquired" text feedback (oyun alanı üstünde 1 saniyelik floating text)
- [x] **Dil birliği:** Banish açıklamasını İngilizce yap veya tüm UI'ı Türkçe'ye çevir (kullanıcı tercihine göre)

### 3.6 Onboarding (İlk Oyun)

**Mevcut:** Yok.

**Yapılacaklar:**
- [x] İlk oyunda (gamesPlayed === 0) kısa overlay talimatlar:
  - Frame 1: "Hareket ettirmek için sürükle" + animasyonlu ok
  - Frame 2: "Otomatik ateş eder" + mermi animasyonu
  - Frame 3: "Düşmanlardan kaç!" + düşman görseli
- [x] 3 frame, her biri 2 saniye veya dokunuşla geçiş
- [x] Sadece ilk oyunda gösterilir (localStorage flag)

**Uygulama Notları (v1):**
- `PlayScene` içinde level/progress/shield/combo HUD, game-over overlay ve run istatistikleri eklendi.
- `Storage` katmanı audio + game profile (`highScore`, `bestLevel`, `totalGamesPlayed`, `totalKills`, `totalPlayTimeMs`) ile genişletildi.
- `settings` tarafında `sfxVolume`, `musicVolume`, `hapticEnabled` kalıcılığı desteklendi.
- Menu ekranına persistence metrikleri (`Best`, `Games`) yansıtıldı.
- Upgrade modal için rarity glow, hover scale, slide-in ve selection feedback eklendi.
- İlk oyun için 3 adımlı onboarding overlay akışı eklendi.

---

## AŞAMA 4: DÜŞMAN ÇEŞİTLİLİĞİ & DALGA SİSTEMİ

**Durum:** Tamamlandı

**Hedef:** Oynanışı derinleştir, monotonluğu kır, taktiksel karar verme ekle.

**Tahmini Efor:** Yüksek  
**Bağımlılık:** Aşama 1 ve 3 tamamlanmış olmalı

### 4.1 Yeni Düşman Tipleri

**Mevcut:** Sadece 1 tip (daire) + boss (polygon).

**Yapılacaklar:**

#### Tip 1: Zigzag Runner (Üçgen Düşman)
- [x] Texture: Ters üçgen (aşağı bakan), turuncu neon
- [x] Hareket: Hızlı zigzag (sinüs dalga, yüksek frekans)
- [x] HP: Düşük (1-2)
- [x] Hız: Normal düşmanların 1.5×
- [x] İlk görülme: Level 3+

#### Tip 2: Tank (Kare Düşman)
- [x] Texture: Kare, kalın kenar, sarı-yeşil neon
- [x] Hareket: Yavaş, düz dikey iniş
- [x] HP: Yüksek (normal düşmanın 3×)
- [x] Özellik: Ölürken küçük mermi patlaması (4 yöne 1'er shrapnel)
- [x] İlk görülme: Level 5+

#### Tip 3: Splitter (Elmas/Baklava Düşman)
- [x] Texture: 45° döndürülmüş kare (elmas), mor neon
- [x] Hareket: Normal hız
- [x] HP: Orta
- [x] Özellik: Ölürken 2 küçük mini-düşmana bölünür (her biri 1 HP, ters yönlere dağılır)
- [x] İlk görülme: Level 7+

#### Tip 4: Shooter (Altıgen Düşman)
- [x] Texture: Küçük hexagon, kırmızı neon
- [x] Hareket: Yavaş iniş, belirli Y'de durup ateş eder
- [x] HP: Orta
- [x] Özellik: Her 2 saniyede oyuncuya doğru mermi atar (kırmızı küçük parçacık)
  - Oyuncu mermisi düşman mermisini yok edebilir (collision eklendi)
- [x] İlk görülme: Level 10+

#### Tip 5: Shield Bearer (Pentagon Düşman)
- [x] Texture: Küçük pentagon, cyan neon + kalkan aurasıyla
- [x] Hareket: Normal
- [x] HP: Orta
- [x] Özellik: Ön tarafında kalkan var, sadece yandan veya pierce mermiyle vurulabilir
  - İlk `shieldHP` kadar hasar absorbe eder, sonra normal HP'ye geçer
- [x] İlk görülme: Level 12+

### 4.2 Dalga (Wave) Sistemi

**Mevcut:** Düşmanlar sürekli ve monoton spawn oluyor (timer-based).

**Yapılacaklar:**
- [x] `src/systems/WaveManager.js` oluştur
- [x] Her level belirli sayıda wave içerir:
  ```
  Level 1: 3 wave × 6-8 düşman
  Level 5: 4 wave × 10-12 düşman + boss wave
  Level 10: 5 wave × 12-15 düşman (mixed types) + boss wave
  ```
- [x] Wave yapısı:
  ```javascript
  {
    enemies: [
      { type: 'circle', count: 6, spawnDelay: 400 },
      { type: 'zigzag', count: 2, spawnDelay: 600 },
    ],
    spawnPattern: 'sequential' | 'burst' | 'sides' | 'v_formation'
  }
  ```

- [x] **Wave clear bonus:** Tüm wave temizlenince +100 bonus skor + patlama efekti
- [x] **Level clear:** Son wave (boss dahil) temizlenince upgrade seçimi + büyük "LEVEL CLEAR!" animasyonu
- [x] Spawn pattern'leri:
  - `sequential`: Tek tek gelir
  - `burst`: Hepsi aynı anda
  - `sides`: Sol ve sağ kenarlardan
  - `v_formation`: V şeklinde düşüş

### 4.3 Power-up Drop Sistemi

**Mevcut:** Texture'lar üretiliyor ama kullanılmıyor.

**Yapılacaklar:**
- [x] Düşman öldüğünde %8 şansla power-up drop
- [x] Power-up'lar yavaşça aşağı düşer (vy: 30-40)
- [x] Oyuncu dokunarak toplar
- [x] Tipler (zaten texture'lar var):
  | Power-up | Texture | Efekt | Süre |
  |----------|---------|-------|------|
  | Shield | `powerup_shield` | +1 shield charge | Anında |
  | Pierce | `powerup_pierce` | Tüm mermiler 5 sn pierce | 5s |
  | Slow | `powerup_slow` | Tüm düşmanlar %50 yavaş | 4s |
- [x] Aktif power-up göstergesi HUD'da (timer bar)
- [x] Power-up toplarken ses efekti + parlama efekti

### 4.4 Enemy Spawn Level Tablosu

Aşağıdaki tablo hangi level'da hangi düşman tipinin aktifleştiğini gösterir:

| Level | Daire | Zigzag | Tank | Splitter | Shooter | Shield Bearer |
|-------|-------|--------|------|----------|---------|---------------|
| 1-2 | ✅ | — | — | — | — | — |
| 3-4 | ✅ | ✅ | — | — | — | — |
| 5-6 | ✅ | ✅ | ✅ | — | — | — |
| 7-9 | ✅ | ✅ | ✅ | ✅ | — | — |
| 10-11 | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| 12+ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Uygulama Notları (v1):**
- Wave tabanlı ilerleme için `src/systems/WaveManager.js`, `src/systems/WaveDefinitions.js` ve `src/systems/EnemyFactory.js` eklendi.
- `PlayScene` timer/kill threshold yerine dalga temizleme akışıyla seviye atlar; wave clear bonusu ve level clear upgrade tetikleyicisi eklendi.
- Yeni düşman tipleri (zigzag, tank, splitter, shooter, shield bearer) texture + davranış + özel ölüm etkileriyle entegre edildi.
- `src/systems/PowerupSystem.js` ile `%8` drop, pickup collision, `pierce`/`slow` süreli bufflar ve HUD timer barı eklendi.
- Shooter mermileri ile oyuncu mermisi çarpışması ve shield bearers için önden bloklama/yandan vurma kuralı uygulandı.
- Stabilizasyon güncellemesi: power-up pickup'lar yan sınırlar içinde tutuldu, enemy projectile'lar üst/yan sınırda da temizlenir hale getirildi ve küçük düşmanlarda HP metni auto-fit ile taşma sorunu giderildi.
- Son dokunuş: üçgen tabanlı düşmanlarda HP font/stroke daha kompakt hale getirildi ve pickup sistemine stuck-watchdog eklenerek ekranda sabit kalma edge-case'i temizlendi.

---

## AŞAMA 5: COMBO, FEVER & ZORLUK EĞRİSİ

**Hedef:** "Hipnotize edici" akıcılığı sağla. Oyuncuyu flow state'e sok.

**Tahmini Efor:** Orta-Yüksek  
**Bağımlılık:** Aşama 1, 2, 3 tamamlanmış olmalı

### 5.1 Kill Streak / Combo Sistemi

**Mevcut:** Tamamlandı. Ardışık kill'ler combo kademesi, skor çarpanı ve görsel/ses geri bildirimi ile ödüllendiriliyor.

**Yapılacaklar:**
- [x] Combo sayacı: ardışık kill'ler sayılır
- [x] Combo timer: son kill'den 2.5 saniye içinde yeni kill olmazsa combo sıfırlanır
- [x] Combo kademeleri:

  | Kill Streak | Combo | Skor Çarpanı | Görsel | Ses |
  |-------------|-------|-------------|--------|-----|
  | 0-4 | ×1 | 1× | — | — |
  | 5-14 | ×2 | 1.5× | Hafif glow | ascending tone |
  | 15-29 | ×3 | 2× | Screen edge pulse | arpej hızlanır |
  | 30-59 | ×5 | 3× | Background color shift | bass drop |
  | 60+ | ×10 FEVER | 5× | ← Fever Mode aktif → | crescendo |

- [x] Combo sayısı ekranın üst-orta kısmında büyük font ile gösterilir
- [x] Her kademe atlamasında kısa "COMBO ×3!" text flash
- [x] Combo kırılınca: kırmızı patlama efekti + düşüş sesi

### 5.2 Fever Mode

**Tetikleme:** 60+ ardışık kill.

**Yapılacaklar:**
- [x] Fever aktif olunca:
  - Arka plan rengi parlak neon tona geçer (breathing glow yoğunlaşır)
  - Tüm mermiler otomatik piercing olur
  - Ateş hızı 1.5× olur
  - Skor çarpanı 5×
  - Müzik intensify (tüm katmanlar aktif, tempo +%10)
  - Ekranın kenarlarında neon parlama efekti
- [x] Süre: 8 saniye (kill zinciri devam etse bile)
- [x] Ekranda büyük "🔥 FEVER!" yazısı (pulsing, neon)
- [x] Fever bitince: kısa "cool down" — normal moda dönüş, ateş hızı/pierce resetlenir
- [x] Bir run'da birden fazla fever tetiklenebilir

### 5.3 Near-Miss Bonus

**Yapılacaklar:**
- [x] Düşman, overlap olmadan oyuncuya 30px'den yakın geçerse:
  - +50 bonus skor
  - "CLOSE!" floating text (turuncu, 400ms)
  - Kısa adrenalin SFX (kısa whoosh)
  - Hafif screen flash (beyaz, 30ms)
- [x] Near-miss combo ile stack olabilir (near-miss streak bonusu)
- [x] Risk-reward dengesi: yakın geçirmek skor kazandırır ama riskli

### 5.4 Zorluk Eğrisi Düzeltmesi

**Mevcut:** Smooth eğriye geçirildi; hız/HP/spawn yoğunluğu kademeli artıyor.

**Yapılacaklar:**
- [x] Düşman hız çarpanını sigmoid fonksiyona çevir:
  ```javascript
  // YENİ: Smooth sigmoid eğri
  function enemySpeedMultiplier(level) {
    return 0.8 + 2.2 / (1 + Math.exp(-0.25 * (level - 8)));
  }
  // Level 1: ~0.93   Level 5: ~1.30   Level 10: ~2.04
  // Level 15: ~2.64   Level 20: ~2.87  Level 30: ~2.99
  ```
- [x] Düşman HP artışını logaritmik yap:
  ```javascript
  // YENİ: Logaritmik HP artışı
  function enemyBaseHP(level) {
    if (level <= 3) return 1;
    return Math.floor(1 + Math.log2(level - 2) * 1.5);
  }
  // Level 3: 1, Level 5: 2, Level 10: 4, Level 15: 5, Level 20: 6
  ```
- [x] Spawn hızı da sigmoid ile smooth geçiş yapsın (mevcut kırılma noktaları yerine)
- [x] Playtest ile fine-tuning yapılmalı: İlk 3 level kolay ama sıkıcı olmamalı, level 10 civarı zorlayıcı ama adil olmalı

### 5.5 Kamera & Ekran Efektleri

**Yapılacaklar:**
- [x] **Boss girişi:** Hafif zoom-in + zoom-out (1.0 → 1.02 → 1.0, 600ms)
- [x] **Crit hit:** Çok kısa chromatic aberration benzeri efekt (RGB offset, 50ms) — veya basit beyaz flash
- [x] **Düşük kalkan:** Ekran kenarlarında kırmızı vignette (shieldCharges === 1)
- [x] **Boss ölümü:** 200ms slow-motion (time.timeScale = 0.3) + beyaz flash + normal hıza dönüş
- [x] **Level up:** Kısa pulse zoom (1.0 → 1.01 → 1.0, 200ms) + ekran flash

---

## AŞAMA 6: PRESTIGE & SÜRDÜRÜLEBİLİRLİK

**Hedef:** Uzun vadeli oynanış döngüsü oluştur. Oyuncunun geri gelmesini sağla.

**Tahmini Efor:** Yüksek  
**Bağımlılık:** Tüm önceki aşamalar tamamlanmış olmalı

### 6.1 Coin Sistemi

**Yapılacaklar:**
- [ ] Her run'da "coin" kazanılır:
  - Kill başı: 1 coin
  - Boss kill: 25 coin
  - Wave clear: 10 coin
  - Level clear: 15 coin
  - Fever bonus: 50 coin
- [ ] Coin'ler run sonunda (game over'da) toplanır ve localStorage'a kaydedilir
- [ ] HUD'da coin göstergesi (sağ üst köşe, altın simge + sayı)
- [ ] Game over ekranında "Earned: XX coins" gösterimi

### 6.2 Prestige Shop (Kalıcı Upgrade'ler)

**Yapılacaklar:**
- [ ] Menu ekranında "SHOP" butonu
- [ ] Shop ekranı (yeni scene veya overlay):

  | Upgrade | Maliyet | Max Level | Efekt |
  |---------|---------|-----------|-------|
  | Başlangıç Hasarı | 50/100/200 | 3 | +%10/20/30 base damage |
  | Başlangıç Hız | 75/150/300 | 3 | -%5/10/15 base fire delay |
  | Ekstra Reroll | 100/250 | 2 | +1/2 draft reroll hakkı |
  | Başlangıç Shield | 80/200 | 2 | +1/2 shield ile başla |
  | Coin Çarpanı | 200/500 | 2 | +%25/50 coin kazancı |
  | Near-Miss Range | 150 | 1 | Near-miss mesafesi 30 → 40px |

- [ ] Her upgrade kalıcı — run'lar arası devam eder
- [ ] Yeterli coin yoksa buton deaktif (gri)
- [ ] Satın alma animasyonu + SFX

### 6.3 Achievement Sistemi

**Yapılacaklar:**
- [ ] Başarım listesi (Menu'den erişilebilir):

  | Başarım | Koşul | Ödül |
  |---------|-------|------|
  | İlk Kan | 1 düşman öldür | 10 coin |
  | Acemi Pilot | Level 3'e ulaş | 20 coin |
  | Filo Komutanı | 6 üçgen topla | 50 coin |
  | Boss Hunter | İlk boss'u yen | 100 coin |
  | Frost Ustası | 50 düşman yavaşlat | 75 coin |
  | Combo King | 30× combo yap | 100 coin |
  | Fever Time | İlk fever'ı tetikle | 150 coin |
  | Perfectionist | 5 level shield kaybetmeden | 200 coin |
  | Veteran | 100 oyun oyna | 100 coin |
  | Genocide | Toplam 10.000 kill | 500 coin |

- [ ] Başarım açıldığında in-game bildirim (ekranın üstünden slide-in banner)
- [ ] Tamamlanan başarımlar altın çerçeve, tamamlanmayanlar gri

### 6.4 Günlük Challenge

**Yapılacaklar:**
- [ ] Her gün farklı modifikasyonla özel mod:
  - Pazartesi: "Speed Demon" — düşman hızı 2×, ateş hızı 1.5×
  - Salı: "Glass Cannon" — hasar 3×, shield max 1
  - Çarşamba: "Frost World" — tüm mermiler frost, düşman hızı 1.2×
  - Perşembe: "Boss Rush" — sadece boss'lar, ara düşman yok
  - Cuma: "Swarm" — düşman HP hep 1, spawn hızı 3×
  - Cumartesi: "Pierce Party" — tüm mermiler pierce, düşman HP 2×
  - Pazar: "Random Madness" — her wave random modifikasyon
- [ ] Challenge leaderboard (localStorage, kişisel best)
- [ ] Challenge başarımlar: 3 farklı günde challenge oyna → özel ödül
- [ ] Günlük challenge coin bonusu: ×2 coin

### 6.5 Cosmetic Unlock'lar

**Yapılacaklar:**
- [ ] Player renk desenleri (coin ile satın alınır):
  - Default: Beyaz/Cyan
  - Crimson: Kırmızı/Turuncu (200 coin)
  - Royal: Mor/Altın (300 coin)
  - Toxic: Yeşil/Lime (250 coin)
  - Shadow: Koyu gri/Beyaz (350 coin)
- [ ] Mermi trail renk özelleştirmesi
- [ ] Ölüm partikül renk seti

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
