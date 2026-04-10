# Android Keystore

## Dosyalar

| Dosya | Git'te mi? | Açıklama |
|-------|-----------|----------|
| `trigon-release.jks` | **HAYIR** (.gitignore'da) | Ham keystore — yerel |
| `trigon-release.jks.enc` | **EVET** | AES-256 şifreli keystore — repoda |
| `keystore.properties` | **HAYIR** (.gitignore'da) | Şifre + alias — yerel |
| `keystore.properties.template` | **EVET** | Şablon dosya |

---

## Kurulum (Takım üyeleri için)

### 1. Şifreli keystoru çöz

```bash
cd keystore/
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in trigon-release.jks.enc \
  -out trigon-release.jks \
  -pass pass:"TAKIM_SIFRESINI_GIR"
```

> Şifreyi takım password manager'ından (1Password / Bitwarden vb.) alın.

### 2. keystore.properties oluştur

```bash
cp keystore.properties.template keystore.properties
```

`keystore.properties` dosyasını aç ve değerleri doldur:

```
storeFile=../keystore/trigon-release.jks
storePassword=TAKIM_SIFRESINI_GIR
keyAlias=trigon-key
keyPassword=TAKIM_SIFRESINI_GIR
```

---

## Şifreli dosyayı güncelleme (keystore değişirse)

```bash
cd keystore/
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -in trigon-release.jks \
  -out trigon-release.jks.enc \
  -pass pass:"TAKIM_SIFRESINI_GIR"
git add trigon-release.jks.enc
git commit -m "chore: update encrypted keystore"
```

---

## Keystore Bilgileri

- **Alias:** `trigon-key`
- **Algoritma:** RSA 2048
- **Geçerlilik:** 10.000 gün (~27 yıl)
- **Organizasyon:** Trigonx / Istanbul
