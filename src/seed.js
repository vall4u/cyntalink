'use strict';

/**
 * Generates a warm/cool editorial SVG data URI for instant, CORS-safe
 * collection covers and fallback thumbnails.
 */
function createEditorialIllustration({ bg1, bg2, accent, iconText, title, subtitle }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" rx="36" fill="url(#g)"/>
    <circle cx="490" cy="110" r="140" fill="${accent}" fill-opacity="0.16"/>
    <circle cx="110" cy="490" r="170" fill="${accent}" fill-opacity="0.12"/>
    <rect x="64" y="64" width="472" height="472" rx="28" fill="#ffffff" fill-opacity="0.72" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/>
    <circle cx="300" cy="235" r="76" fill="${accent}" fill-opacity="0.18"/>
    <text x="300" y="258" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="64" font-weight="700" fill="${accent}">${iconText}</text>
    <text x="300" y="380" text-anchor="middle" font-family="Georgia, serif" font-size="33" font-weight="700" fill="#231917">${title}</text>
    <text x="300" y="424" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="20" font-weight="500" fill="#6e5a56">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEFAULT_SEED = {
  profile: {
    name: 'cyntaclaw ❤',
    handle: 'cyntaclaw',
    tagline: 'mostly abt beauties💋 • cool—light summer • the hands behind @markedbyliebe ✨ seperti kata ci mehong PaLuGaDa, apa yang lu cari gua ada 🫵🏻😚',
    location: 'die/sie • Beauty, cosmetic & personal care',
    verified: true,
    themeColor: '#b55d7a',
    themePreset: 'cool-summer-berry',
    domainLabel: 'cyntaclaw.rekomin.bio',
    announcementText: '🍵 Spill the tea • ❅ Recommendations Products (#01 – #20) ❅ Ketik nomor produk di kolom pencarian!',
    avatarUrl: 'https://images.msha.ke/6804d66f-a17a-4321-b221-025bda208352?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828',
    socials: [
      { platform: 'instagram', label: 'IG @cyntaclaw', url: 'https://www.instagram.com/cyntaclaw/' },
      { platform: 'markedbyliebe', label: '@markedbyliebe', url: 'https://www.instagram.com/markedbyliebe/' },
      { platform: 'threads', label: 'Threads @cyntaclaw', url: 'https://www.threads.net/@cyntaclaw' },
      { platform: 'mshake', label: 'msha.ke/cyntaclaw', url: 'https://msha.ke/cyntaclaw' }
    ]
  },
  collections: [
    {
      id: 'col-complexion',
      slug: 'complexion-cool-light-summer',
      title: 'Complexion & Flawless Base',
      category: 'Complexion',
      description: 'Skintint, breathable cushion, serum concealer, liquid blush, contour, highlighter, loose powder & setting spray andalan.',
      themeColor: '#b55d7a',
      featured: true,
      sortOrder: 1,
      coverUrl: createEditorialIllustration({
        bg1: '#fceaf2',
        bg2: '#f0c4d7',
        accent: '#a63e63',
        iconText: 'BASE',
        title: 'Complexion & Base',
        subtitle: 'Cool—Light Summer Glow'
      })
    },
    {
      id: 'col-eyes',
      slug: 'eye-makeup-softlens',
      title: 'Eye Makeup & Softlens Spill',
      category: 'Eyes & Softlens',
      description: 'Softlens biru & natural brown yang sering ditanyain, eyeshadow palette Korean look, brow tipis, mascara & eyeliner.',
      themeColor: '#6f78a6',
      featured: true,
      sortOrder: 2,
      coverUrl: createEditorialIllustration({
        bg1: '#ebeffa',
        bg2: '#c9d2f0',
        accent: '#525c91',
        iconText: 'EYES',
        title: 'Eyes & Softlens',
        subtitle: 'Korean Look Essentials'
      })
    },
    {
      id: 'col-lips',
      slug: 'lippies-mlbb-summer',
      title: 'Lippies, Velvet & MLBB Shades',
      category: 'Lippies💋',
      description: 'Koleksi lip tint bare grape MLBB, lip velvet multifungsi (blush + corrector + bibir), dan lipbalm SPF andalan.',
      themeColor: '#c94a6a',
      featured: true,
      sortOrder: 3,
      coverUrl: createEditorialIllustration({
        bg1: '#fde8ee',
        bg2: '#f7bdd0',
        accent: '#b83357',
        iconText: 'LIPS',
        title: 'Lippies & MLBB',
        subtitle: 'Bare Grape & Velvet Tint'
      })
    },
    {
      id: 'col-skincare-hijab',
      slug: 'pashmina-acne-care',
      title: 'Pashmina & Skincare Rescue',
      category: 'Hijab & Care',
      description: 'Pashmina Calla super affordable yang sering dipakai di konten dan acne patch penyelamat jerawat kematian.',
      themeColor: '#6f8274',
      featured: false,
      sortOrder: 4,
      coverUrl: createEditorialIllustration({
        bg1: '#eaefec',
        bg2: '#cad6ce',
        accent: '#536658',
        iconText: 'CARE',
        title: 'Pashmina & Care',
        subtitle: 'Daily Hijab & Skin Rescue'
      })
    }
  ],
  items: [
    {
      id: 'item-01',
      collectionId: 'col-complexion',
      code: '01',
      title: 'Skintint Rosé All Day',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Radiant Finish',
      url: 'https://shope.ee/20TVOOkPox',
      note: 'cari skintint yang radiant finish dan gak heavy? pake punya Rosé all day aja🫵🏻😙',
      specs: ['Radiant finish', 'Lightweight & gak heavy', 'Top Pick #1 di msha.ke/cyntaclaw'],
      featured: true,
      sortOrder: 1,
      imageUrl: 'https://images.msha.ke/0ead5fc8-98de-4116-9c1a-1bc494a21bdf?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-02',
      collectionId: 'col-eyes',
      code: '02',
      title: 'Softlens Biru',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Paling Ditanyain',
      url: 'https://shope.ee/5fMnlMZbJh',
      note: 'banyak yg nanyain nih',
      specs: ['Cool-tone blue lens', 'Nyaman dipakai', 'Top Pick #2 di msha.ke/cyntaclaw'],
      featured: true,
      sortOrder: 2,
      imageUrl: 'https://images.msha.ke/44dbff09-99ae-4636-ad34-f7ba61e5d8d4?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-03',
      collectionId: 'col-eyes',
      code: '03',
      title: 'CLIO Pro Eye Palette',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Korean Look',
      url: 'https://shope.ee/2AmvbAPGcP',
      note: 'asli warnanya cakep cakep puol',
      specs: ['Pigmented & blendable', 'Cool-light summer friendly', 'Top Pick #3 di msha.ke/cyntaclaw'],
      featured: true,
      sortOrder: 3,
      imageUrl: 'https://images.msha.ke/4b2f97f5-e850-4bb2-a150-281f90ce627f?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-04',
      collectionId: 'col-skincare-hijab',
      code: '04',
      title: 'Pashmina CALLA',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Affordable Pars',
      url: 'https://shope.ee/2fj3D0wzwq',
      note: 'pashminanya bagus bagus ni, harganya jg affordable pars',
      specs: ['Mudah dibentuk', 'Harga super affordable', 'Top Pick #4 di msha.ke/cyntaclaw'],
      featured: true,
      sortOrder: 4,
      imageUrl: 'https://images.msha.ke/69ec90e4-f92d-4c68-9da4-7cff49ba670d?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-05',
      collectionId: 'col-eyes',
      code: '05',
      title: 'Secondate Brow People',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Micro Brow',
      url: 'https://shope.ee/6KcUZXV9ya',
      note: 'Brow super tipis w/ smooth glides gampang diatur dan bisa banget buat bikin hair stroke tipis-tipis',
      specs: ['Ujung super tipis', 'Smooth glides', 'Natural hair-stroke effect'],
      featured: false,
      sortOrder: 5,
      imageUrl: 'https://images.msha.ke/8abc899d-c8a9-464a-8975-2b4ee03d3c3b?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-06',
      collectionId: 'col-skincare-hijab',
      code: '06',
      title: 'Acne Patch Rescue',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Jerawat Rescue',
      url: 'https://shope.ee/6zspNsisDb',
      note: 'bagus banget buat ngebasmi jerawat kematian kalian 🤯😗',
      specs: ['cepat kempesin jerawat', 'Nempel kuat', 'Top Pick #6 di msha.ke/cyntaclaw'],
      featured: false,
      sortOrder: 6,
      imageUrl: 'https://images.msha.ke/001f44c9-01a9-4980-8138-eca4c8a42753?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-07',
      collectionId: 'col-eyes',
      code: '07',
      title: 'Rom&nd Han All Fix Mascara',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Long Lasting',
      url: 'https://shope.ee/6ALcEqu1HV',
      note: 'Ada 3 warna loh, long lasting, ada efek lengtheningnya dan volumizing jg, cocok untuk kaum eyelashes pendek dan tipiz sperti gue🥸',
      specs: ['Tersedia 3 warna', 'Lengthening & volumizing', 'Tahan lentik seharian'],
      featured: true,
      sortOrder: 7,
      imageUrl: 'https://images.msha.ke/81d5d009-4e51-4ab9-8d7d-ec87ac23faf6?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-08',
      collectionId: 'col-eyes',
      code: '08',
      title: 'Softlense Natural Brown',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Super Natural',
      url: 'https://shope.ee/2q5AGwJGNe',
      note: 'pokoknya kalian harus punya warna coklatnya bagus banget super naturall~',
      specs: ['Natural brown ring', 'Cocok buat daily makeup', 'Top Pick #8 di msha.ke/cyntaclaw'],
      featured: false,
      sortOrder: 8,
      imageUrl: 'https://images.msha.ke/1c856fb8-d493-459a-9d00-b2ed52d1b22f?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-09',
      collectionId: 'col-lips',
      code: '09',
      title: 'Peripera Peri’s Ink Velvet [02]',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: '3-in-1 Versatile',
      url: 'https://shope.ee/3fgQ24x5cK',
      note: 'Lip velvet lembut yang versatile bisa dipake buat blush, corrector, dan bibir',
      specs: ['Shade 02', 'Bisa untuk bibir, blush & corrector', 'Tekstur velvet lembut'],
      featured: true,
      sortOrder: 9,
      imageUrl: 'https://images.msha.ke/846d7c85-9c4f-451b-805d-d2d79cc5c7fd?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-10',
      collectionId: 'col-complexion',
      code: '10',
      title: 'Mad For Makeup Spotless Serum Concealer',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Acne Safe <3',
      url: 'https://shope.ee/9pH3NcYh2i',
      note: 'Concealer lightweight enakeun acne safe jugaaa <3',
      specs: ['Lightweight formula', 'Acne-safe ingredients', 'Hydrating serum concealer'],
      featured: false,
      sortOrder: 10,
      imageUrl: 'https://images.msha.ke/fd0d1dcc-393c-4417-aeaf-66995f0cf37d?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-11',
      collectionId: 'col-complexion',
      code: '11',
      title: 'Somethinc Copy Paste Breathable Cushion',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Cushion Cantulity',
      url: 'https://shope.ee/7AGICta4RZ',
      note: 'Cushion cantulity',
      specs: ['Breathable coverage', 'Flawless skin finish', 'Top Pick #11 di msha.ke/cyntaclaw'],
      featured: true,
      sortOrder: 11,
      imageUrl: 'https://images.msha.ke/fe27fcff-b861-4859-aeab-9972a599d1dd?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-12',
      collectionId: 'col-complexion',
      code: '12',
      title: 'Tavi Liquid Blush',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Natural Flush',
      url: 'https://shope.ee/604KosoY41',
      note: 'Kaum kaum necurel look blushnya pake ini',
      specs: ['Natural second-skin flush', 'Gampang di-blend', 'Top Pick #12 di msha.ke/cyntaclaw'],
      featured: false,
      sortOrder: 12,
      imageUrl: 'https://images.msha.ke/910f776f-b7e2-4132-be76-751fdd1bf8ef?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-13',
      collectionId: 'col-complexion',
      code: '13',
      title: 'Luxcrime Glow Getter Setting Spray',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Luminous Glow',
      url: 'https://shope.ee/3L3Ze6MPNX',
      note: 'A glow-boosting setting spray that sets makeup, hydrates skin and provides a visible luminous glow. Enriched with Soybean Seed Extract as Vitamin E and Glycerin.',
      specs: ['Glow-boosting finish', 'Vitamin E & Glycerin', 'Long-lasting hydration'],
      featured: false,
      sortOrder: 13,
      imageUrl: 'https://images.msha.ke/dec8fbd4-dbbd-40ec-81b8-73601f1938f9?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-14',
      collectionId: 'col-complexion',
      code: '14',
      title: 'Somethinc Hooman Loose Powder',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Anti Longsor',
      url: 'https://shope.ee/2q7J3LBGan',
      note: 'Loose powder anti longsor',
      specs: ['Blurring pore effect', 'Oil control seharian', 'Top Pick #14 di msha.ke/cyntaclaw'],
      featured: false,
      sortOrder: 14,
      imageUrl: 'https://images.msha.ke/fcc815c0-cf7b-4b18-b1ee-a1bd1c5aac21?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-15',
      collectionId: 'col-eyes',
      code: '15',
      title: 'Pinkflash Eyeliner',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Super Affordable',
      url: 'https://shope.ee/1LIVGgW5Fj',
      note: 'Super affordable eyelinerrr :>',
      specs: ['Waterproof & smudgeproof', 'Ujung kuas presisi', 'Ramah kantong'],
      featured: false,
      sortOrder: 15,
      imageUrl: 'https://images.msha.ke/db572966-b5e5-4526-821b-8d4b7e4c3483?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-16',
      collectionId: 'col-lips',
      code: '16',
      title: 'Rom&nd Juicy Lasting Tint [Bare Grape]',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Perfect MLBB',
      url: 'https://shope.ee/7zpPD3z8pc',
      note: 'Perfect mlbb shade',
      specs: ['Shade Bare Grape (Cool-Light Summer)', 'Glossy juicy finish', 'Top Pick #16 di msha.ke/cyntaclaw'],
      featured: true,
      sortOrder: 16,
      imageUrl: 'https://images.msha.ke/77334fc6-ba90-4c0a-9e75-0b9594070577?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-17',
      collectionId: 'col-complexion',
      code: '17',
      title: 'Too Cool for School Contour Shading [Modern]',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Cool Tone Shading',
      url: 'https://shope.ee/9zaTarjxtb',
      note: 'Shade [Modern] pas banget buat shading hidung & rahang cool—light summer tanpa kelihatan merah/kusam.',
      specs: ['Shade Modern (Cool/Neutral)', '3 gradasi warna dalam 1 pan', 'Natural shadow finish'],
      featured: false,
      sortOrder: 17,
      imageUrl: 'https://images.msha.ke/fb472992-1e91-47f0-ba67-af2bf44dd735?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-18',
      collectionId: 'col-complexion',
      code: '18',
      title: 'Somethinc Halo Potion Highlighter',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Glowingghh',
      url: 'https://shope.ee/g2oTmDLLf',
      note: 'Highlighter glowingghh',
      specs: ['Wet-look glass skin glow', 'Menyatu di atas cushion', 'Top Pick #18 di msha.ke/cyntaclaw'],
      featured: false,
      sortOrder: 18,
      imageUrl: 'https://images.msha.ke/17edbd8d-424d-4d64-b24e-43398ef655b7?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-19',
      collectionId: 'col-eyes',
      code: '19',
      title: 'Rom&nd Better Than Palette Eyeshadow',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Eyeshadow Gemecc',
      url: 'https://shope.ee/6V0bQea2Eu',
      note: 'Eyeshadow gemecc',
      specs: ['Matte + Glitter Korea', 'halus & minim fallout', 'Top Pick #19 di msha.ke/cyntaclaw'],
      featured: false,
      sortOrder: 19,
      imageUrl: 'https://images.msha.ke/a54cdda1-a34f-402b-8845-1635f2879ca8?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    },
    {
      id: 'item-20',
      collectionId: 'col-lips',
      code: '20',
      title: 'Sebamed Lipbalm SPF 30',
      price: 'Cek Promo Shopee',
      originalPrice: '',
      marketplace: 'Shopee',
      badge: 'Lip Sunscreen💋',
      url: 'https://shope.ee/3pzqFslM4m',
      note: 'Inimah suncreennya bibir andalan💋',
      specs: ['SPF 30 UV Protection', 'Melembapkan bibir kering', 'Top Pick #20 di msha.ke/cyntaclaw'],
      featured: false,
      sortOrder: 20,
      imageUrl: 'https://images.msha.ke/89df0a87-74fb-4a73-bb6a-966e15c9c0cd?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828'
    }
  ]
};

module.exports = {
  DEFAULT_SEED,
  createEditorialIllustration
};
