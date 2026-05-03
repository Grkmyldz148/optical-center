---
date: 2026-05-03
topic: optical-center-drop-in
---

# Optical Center — Drop-in DX Brainstorm

## What We're Building

`optical-center` kütüphanesini **drop-in bir geliştirici deneyimine** çeviriyoruz.
Kullanıcı tek bir deklaratif işaretleyici yazar — CSS'te `optical-center: auto`,
JSX'te `opticalCenter`, Tailwind'de `class="optical-center"`, HTML'de
`<svg optical-center>` — ve sistemin geri kalanı kendiliğinden hallolur.
Hiçbir parametre yok (ikon adı, boyut, scale): "bu element optik ortalansın"
demekten ibaret.

`auto` keyword'u `margin: auto`, `width: auto` ile uyumlu okunur ve ileride
yeni değerlere kapı bırakır: `optical-center: 1.75% 0.41%` (manual override),
`optical-center: none` (devre dışı), `optical-center: var(--my-offset)` (özel).

Kritik kısıt: **runtime'da hiçbir hesaplama yapılmaz.** Ağır pipeline (DoG,
convex hull, simetri analizi) build-time'da çalışır; sonuç doğrudan SVG'nin
viewBox'ına gömülür. Tarayıcı sadece düz, hesaplanmış SVG görür.

## Why This Approach

Üç tasarım kararı bu mimariyi zorunlu kıldı:

1. **Parametre yok kuralı** → CSS'te `optical-center: auto` yazımı tek başına
   yetmez, çünkü PostCSS HTML'i görmez. Yani saf CSS plugin yaklaşımı çıktıyı
   üretemez. Bu yüzden **content inspection** her ortamın build aşamasında
   yapılmalı (Babel, SWC, Vue compiler, vb.).

2. **Runtime hesap yok kuralı** → Sonuç bir CSS dosyasına veya class'a
   yazılamaz; çünkü class ne içerdiğini bilmek zorunda. Çözüm: build-time'da
   **per-element** çıktı üretmek.

3. **Her CSS framework'te first-class olmalı** → Çıktı CSS dünyasında doğal
   yaşamalı: çakışma yok, override edilebilir, DevTools'ta görünür.

Bu üç kuralın tek tutarlı kesişimi: **viewBox rewrite + breadcrumb attribute**.

## Key Decisions

- **Default output mode: viewBox rewrite.** Optik ortalama SVG'nin iç
  koordinat sistemine yazılır, CSS dünyasına dokunulmaz. CSS `translate`,
  `transform`, animation, hover scale → hiçbiri çakışmaz çünkü viewBox
  başka bir katman.

- **Görünürlük: `data-optical-center` breadcrumb.** Boş HTML attribute
  olarak işaretlenir. DevTools'ta görünür, CSS selector ile hedeflenebilir,
  lint/test'te sorgulanabilir. İsteğe bağlı meta attribute'lar
  (`data-optical-original-viewbox`, `data-optical-offset`) dev modunda
  şeffaflık için.

- **Fallback mode: CSS variable + universal rule.** SVG mutate edilemediği
  durumlar (`<use href>` sprite, runtime fetch edilen SVG, dokunulmaması
  istenen icon) için opt-in. Element'e `--oc-x` / `--oc-y` enjekte edilir,
  shipped CSS kuralı bunları `translate: calc(var(--oc-x)*1%) ...` ile
  tüketir. Maliyet: kullanıcının `translate` property'siyle çakışabilir.

- **API yüzeyi: declarative, parametresiz.** Her ortamda aynı semantik:

  | Ortam | Yazım |
  |-------|-------|
  | CSS | `.foo { optical-center: auto }` |
  | HTML | `<svg optical-center>` (boolean attribute) |
  | Tailwind | `class="optical-center"` |
  | JSX | `<svg opticalCenter>` (presence prop) |
  | Vue/Svelte | `<svg optical-center>` |

  CSS dışındaki ortamlarda işaretleyici "presence-based" (varlığı = `auto`).
  Sadece CSS form'unda gelecekte alternatif değerler (`none`, manual offset)
  kabul edilebilir.

- **İki taraflı mimari:**
  - **Taraf 1 — Content Inspector (per-environment):** SVG'yi gören taraf.
    Babel/SWC (JSX), Vue compiler hook, Svelte preprocessor, Vite/Rollup
    HTML transformer, SVG asset loader. Her biri ince (~200-400 satır),
    ortak çekirdeği tüketir.
  - **Taraf 2 — Çekirdek motor (`@optical-center/core`):** Mevcut TS kodu,
    framework-agnostic. `getOpticalCenter(imageData) → {dx, dy}` API'si.

- **Paket dağılımı (planlanan):**
  ```
  @optical-center/core         ← motor (mevcut)
  @optical-center/cli          ← klasör tarayıcı
  @optical-center/babel        ← JSX inspector
  @optical-center/swc          ← SWC inspector (Next.js)
  @optical-center/vite         ← orkestratör
  @optical-center/webpack      ← loader
  @optical-center/postcss      ← `optical-center: auto` derleyicisi
  @optical-center/tailwind     ← utility class kaydedicisi
  @optical-center/vue          ← compiler hook
  @optical-center/svelte       ← preprocessor
  @optical-center/astro        ← integration
  @optical-center/lucide       ← pre-baked lucide adapter
  ```

- **MVP scope'undan dışarı bırakılanlar:** Tüm icon library adapter'ları
  ilk sürümde yok. Vue/Svelte/Astro adapter'ları ikinci dalga. İlk MVP:
  core + cli + vite + babel (React+Vite ekosistemi yeterince geniş bir
  kanıt yüzeyi).

## Open Questions

- **MVP'nin ilk paketi hangisi:** `@optical-center/vite` (React+Vite
  pratik test) mi yoksa `@optical-center/cli` (framework-bağımsız ilk
  ürün) mi? CLI önce çıkarsa Vite plugin onu sarar.

- **Icon paketleri için strateji:** Lucide/Heroicons gibi paketleri biz
  pre-bake edip publish mı edelim, yoksa kullanıcıya CLI verip kendi
  baking'ini mi yaptıralım? İkisi de mümkün, lisans ve mainentance yükü
  farklı.

- **viewBox padding edge case:** Bazı ikonlar viewBox'ın kenarına yakın
  çiziliyor. viewBox shift olunca path kırpılabilir. CLI bu durumu tespit
  edip uyarı vermeli mi, yoksa otomatik viewBox'ı genişletip kompanse mi
  etmeli?

- **`<use href="#play">` sprite senaryosu:** Sprite'ı build-time'da
  rewrite mi edelim, consume aşamasında variable mode'a mı düşelim?

- **CSS pseudo-property type system:** PostCSS plugin için TypeScript
  tarafında ambient declaration var mı, yoksa sadece runtime parsing yeterli mi?

- **Cache stratejisi:** Build'de aynı SVG defalarca işlenmemeli. Hash
  bazlı cache nereye yazılır (node_modules/.cache vs proje root)?

- **0.745 correction scale:** Build flag'iyle override edilebilir mi
  olmalı? (Şu an `final-model.ts`'de sabit.)

## Next Steps

→ `/ce:plan` ile implementation planına geç. Plan dökümanı şunları net
içermeli:
- İlk paketin (muhtemelen `@optical-center/cli` + `@optical-center/vite`)
  dosya yapısı
- Babel/SWC AST transform'unun girdi/çıktı kontratı
- viewBox rewrite algoritmasının somut formülü (mevcut `dxPercent`,
  `dyPercent` API'sinden viewBox değerlerine dönüşüm)
- Test stratejisi (golden SVG'ler için snapshot test)
- Mevcut `src/` kodunun monorepo yapısına nasıl bölüneceği
