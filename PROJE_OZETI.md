# optical-center — Proje Özeti

## 1. Tek cümlede nedir?

Bir ikonun **görsel olarak** ortada görünmesi için ne kadar kaydırılması gerektiğini hesaplayan bir TypeScript kütüphanesi.

> Geometrik orta ≠ Görsel orta. İnsan gözü bir üçgeni, oynat (▶) ikonunu ya da asimetrik bir şekli "ortada" gördüğünde, aslında piksel olarak ortada değildir. Bu kütüphane "gözün ortada gördüğü" noktayı bulur.

---

## 2. Neden var?

Klasik örnek: bir oynat butonu (▶ üçgen).

- Üçgeni kutunun tam ortasına koyarsanız → **sola yatık** görünür.
- Çünkü üçgenin görsel ağırlık merkezi sağ tarafta (sivri uç solda, geniş taban yok).
- Bu yüzden tasarımcılar bu tip ikonları elle birkaç piksel sağa iter.

Bu kütüphane o "elle iteklemeyi" otomatik yapar.

---

## 3. Nasıl çalışır? (Yüksek seviye)

Pipeline'ın ismi **V2**, çıkış `V2 × 0.745`.

```
PNG/SVG pikselleri
      │
      ▼
[1] Weight map (her piksel ne kadar "ağır görünüyor")
      │   weight = alpha × (1 - parlaklık)
      ▼
[2] DoG filtresi (retina simülasyonu — kenarları belirginleştir)
      │
      ▼
[3] Power compression (V1 görme korteksi simülasyonu — iç doluluğu bastır)
      │
      ▼
[4] Üç farklı merkez hesapla:
      ├── Edge centroid    (kenar yoğunluğunun merkezi) — %40
      ├── Hull centroid    (dış bükey kabuğun merkezi)   — %30
      └── Symmetry center  (simetri ekseninin merkezi)    — %30
      │
      ▼
[5] Üçünü ağırlıklı ortala
      │
      ▼
[6] Asimetri düzeltmesi + dikey önyargı (insan ortayı %3.5 yukarı görür)
      │
      ▼
[7] Geometrik merkezden farkı al → (dx, dy)
      │
      ▼
[8] × 0.745 (insan deneyinden gelen düzeltme katsayısı)
      │
      ▼
   { dx, dy }   ← uygulamaya bunu uygula
```

### `× 0.745` nereden geliyor?

- Faz 2 deneyi: 30 katılımcı, 120 deneme, **2AFC** (zorla seçim) yöntemi.
- İnsanlar V2'nin önerdiği düzeltmenin **%74.5'ini** tercih etti.
- Yani V2 biraz fazla agresif düzeltiyor; bu sabit ile insan algısına kalibre ediliyor.

---

## 4. Kullanım

### Kurulum
```bash
npm install
npm run build
```

### Tek fonksiyon
```typescript
import { getOpticalCenter } from 'optical-center';

const offset = getOpticalCenter(imageData);
// → { dx: 2.1, dy: 1.3 }   (raster pikseli cinsinden)
```

### Girdi
RGBA piksel buffer'ı. Tipik kullanım:
- **Tarayıcıda:** `canvas.getImageData()` veya `OffscreenCanvas`
- **Node'da:** `@resvg/resvg-js` ile SVG → raster

Model **120×120** boyutta doğrulandı; bu boyutta render etmek tavsiye edilir.

### CSS'e uygulama
```typescript
const displayScale = displaySize / 120;
element.style.transform =
  `translate(${offset.dx * displayScale}px, ${offset.dy * displayScale}px)`;
```

---

## 5. Dosya haritası

```
src/
├── index.ts          → Public API (sadece getOpticalCenter export'lar)
├── final-model.ts    → getOpticalCenter() — V2 sonucunu × 0.745 ile çarpar
├── compute-offset.ts → Asıl V2 pipeline (ve eski V1 — geriye dönük uyum)
├── analyzer.ts       → Weight map oluşturma + ağırlıklı centroid
├── preprocessing.ts  → Gaussian blur, DoG, power compression
├── convex-hull.ts    → Andrew monotone chain + hull centroid
├── perceptual.ts     → Dikey önyargı, asimetri analizi, blend
└── symmetry.ts       → Bilateral + radyal simetri analizi
```

**Bağımlılık yok.** Sadece TypeScript devDependency.

---

## 6. İki pipeline var: V1 ve V2

| | V1 (eski) | V2 (yeni, default) |
|--|--|--|
| Centroid sayısı | 2 (mass + hull) | 3 (edge + hull + symmetry) |
| Ön işleme | Yok | DoG + power compression |
| Biyolojik temel | Yok | Retina + V1 + LOC modeli |
| Kullanım | A/B karşılaştırma için tutuluyor | `getOpticalCenter` bunu kullanıyor |

V1 hâlâ export ediliyor ama yeni kod V2 üzerinden gitmeli.

---

## 7. Bilimsel arka plan (kısaca)

Yazar üç faz çalışma yapmış:

| Faz | Yöntem | N | Sonuç |
|--|--|--|--|
| 1 | Method of adjustment | 36 | V2 doğrulandı (RMSE = 2.99 px, r = 0.585) |
| 2 | 2AFC zorla seçim | 30 | **PSE = 0.745** → final modelde kullanılan katsayı |
| 3 | Adjustment fine-tune | 46 | İkon-bazlı doğrulama, methodolojik karakterizasyon |

Referans makaleler:
- Marr & Hildreth (1980) — DoG kenar tespiti
- Naka & Rushton (1966) — retina sıkıştırması
- Proffitt et al. (1983) — algısal merkezin kontur ağırlıklı olması
- Jewell & McCourt (2000) — adjustment görevlerindeki merkez eğilimi

---

## 8. Performans uyarısı

Her ikon için tam pipeline çalışıyor (DoG konvolüsyonu, hull, simetri analizi).

- **~10–50 ms / ikon** (boyuta göre)
- Production için: **build-time** çalıştırıp JSON lookup tablosu üret.
- Tarayıcıda tek tek runtime hesaplama önerilmiyor.

---

## 9. Çıktı tipi

```typescript
interface OpticalCenterResult {
  dx: number;  // sağa kaydır (+) / sola kaydır (-)
  dy: number;  // aşağı kaydır (+) / yukarı kaydır (-)
}
```

Birim: **raster pikseli** (girdi imageData ile aynı). Görüntü boyutuna ölçeklemek senin işin.

---

## 10. Özet özet

- Amaç: ikonu gözün gördüğü ortaya yerleştir.
- Yöntem: biyolojik görme modeli + kullanıcı deneyiyle kalibre edilmiş katsayı.
- API: tek fonksiyon, `getOpticalCenter(imageData) → {dx, dy}`.
- Bağımlılık: yok.
- En uygun kullanım: build-time'da bir kez hesapla, JSON olarak ship et.
