'use strict';

/**
 * Shared utilities for Rekomin Bio:
 * 1. Native <dialog closedby="any"> light-dismiss fallback & returnValue reset
 * 2. Client-side WebP image resizer/compressor (RKImageUpload equivalent)
 * 3. 1080x1920 (5x scale of 216x384) HTML5 2D Canvas Instagram Story Card Renderer
 *    with 4 templates: 'foto' (Foto Cover), 'tema' (Warna Tema), 'muda' (Warna Muda), 'teratas' (3 Teratas)
 */

const BASE_W = 216;
const BASE_H = 384;
const EXPORT_SCALE = 5; // 216*5 = 1080, 384*5 = 1920

export function initLightDismissDialogs(root = document) {
  const dialogs = root.querySelectorAll('dialog');
  for (const dialog of dialogs) {
    if (!dialog.dataset.rkDialogBound) {
      dialog.dataset.rkDialogBound = '1';
      dialog.addEventListener('close', () => {
        dialog.returnValue = '';
      });
    }
  }

  // Fallback for browsers without native <dialog closedby="any"> support (e.g. Safari)
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of root.querySelectorAll('dialog[closedby="any"]')) {
      if (dialog.dataset.rkLightDismissBound) continue;
      dialog.dataset.rkLightDismissBound = '1';
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        if (e.target !== dialog) {
          pressedOutside = false;
          return;
        }
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (e.target === dialog && pressedOutside && outside(e, dialog)) {
          dialog.close();
        }
        pressedOutside = false;
      });
    }
  }
}

export async function compressImageToDataUrl(file, maxSize = 480, quality = 0.84) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Pilih file gambar yang valid (JPG, PNG, WebP).');
  }
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  if (width > maxSize || height > maxSize) {
    if (width >= height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === 'function') bitmap.close();
  return canvas.toDataURL('image/webp', quality);
}

export async function copyTextWithFallback(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return true;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

function parseHexRgb(hex = '#d9534f') {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((x) => x + x).join('') : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16) || 0xd9534f;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function mixColors(hexA, hexB, ratioA = 0.85) {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  const r = Math.round(a.r * ratioA + b.r * (1 - ratioA));
  const g = Math.round(a.g * ratioA + b.g * (1 - ratioA));
  const bl = Math.round(a.b * ratioA + b.b * (1 - ratioA));
  return `rgb(${r}, ${g}, ${bl})`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fillStyle) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawCoverImage(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapLines(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        for (let j = i + 1; j < words.length; j++) {
          const nextTry = `${current} ${words[j]}`;
          if (ctx.measureText(`${nextTry}…`).width <= maxWidth) {
            current = nextTry;
          } else {
            current = `${current}…`;
            break;
          }
        }
        break;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

function loadImageSafe(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderStoryCanvas(canvas, { profile, collection, items = [], template = 'foto' }) {
  const dpr = EXPORT_SCALE;
  canvas.width = BASE_W * dpr;
  canvas.height = BASE_H * dpr;

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);

  const themeColor = collection?.themeColor || profile?.themeColor || '#d9534f';
  const category = (collection?.category || 'Rekomendasi Pilihan').toUpperCase();
  const title = collection?.title || `${profile?.name || 'Creator'} Picks`;
  const domain = profile?.domainLabel || `${profile?.handle || 'creator'}.rekomin.bio`;
  const countLabel = `${items.length} produk pilihan`;

  const coverImg = await loadImageSafe(collection?.coverUrl || profile?.avatarUrl);

  if (template === 'foto') {
    // Template 1: Full-bleed Cover Photo with rich editorial gradient overlay
    ctx.fillStyle = '#1c1514';
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    if (coverImg) {
      drawCoverImage(ctx, coverImg, 0, 0, BASE_W, BASE_H);
    } else {
      const fallbackGrad = ctx.createLinearGradient(0, 0, BASE_W, BASE_H);
      fallbackGrad.addColorStop(0, themeColor);
      fallbackGrad.addColorStop(1, '#181211');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, BASE_H);
    overlay.addColorStop(0, 'rgba(15, 10, 9, 0.25)');
    overlay.addColorStop(0.45, 'rgba(15, 10, 9, 0.35)');
    overlay.addColorStop(1, 'rgba(15, 10, 9, 0.92)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // Top creator pill
    fillRoundRect(ctx, 16, 18, BASE_W - 32, 24, 12, 'rgba(255, 255, 255, 0.16)');
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`@${profile?.handle || 'creator'} • Koleksi Pilihan`, 26, 30);

    // Category pill
    ctx.font = '700 7px "Plus Jakarta Sans", sans-serif';
    const catW = ctx.measureText(category).width + 14;
    fillRoundRect(ctx, 18, BASE_H - 132, catW, 16, 8, themeColor);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(category, 25, BASE_H - 124);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 18px Georgia, serif';
    ctx.textBaseline = 'top';
    const lines = wrapLines(ctx, title, BASE_W - 36, 3);
    lines.forEach((line, idx) => {
      ctx.fillText(line, 18, BASE_H - 108 + idx * 21);
    });

    // Item count & Bottom CTA domain pill
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '500 8px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${countLabel} • Cek link di bio`, 18, BASE_H - 44);

    fillRoundRect(ctx, 18, BASE_H - 29, BASE_W - 36, 18, 9, '#ffffff');
    ctx.fillStyle = '#1f1615';
    ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🔗 ${domain}`, 28, BASE_H - 20);
  } else if (template === 'tema' || template === 'muda') {
    // Template 2 ('tema') & Template 3 ('muda')
    const isLight = template === 'muda';
    const bgFill = isLight ? mixColors('#ffffff', themeColor, 0.86) : themeColor;
    const textPrimary = isLight ? '#201615' : '#ffffff';
    const textSecondary = isLight ? 'rgba(32, 22, 21, 0.68)' : 'rgba(255, 255, 255, 0.82)';

    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // Decorative ambient circles
    ctx.beginPath();
    ctx.arc(BASE_W - 20, 30, 62, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? mixColors('#ffffff', themeColor, 0.72) : 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    // Top Header
    ctx.fillStyle = textSecondary;
    ctx.font = '700 7px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(category, 18, 22);

    ctx.fillStyle = textPrimary;
    ctx.font = '700 16px Georgia, serif';
    const lines = wrapLines(ctx, title, BASE_W - 36, 3);
    lines.forEach((line, idx) => {
      ctx.fillText(line, 18, 35 + idx * 19);
    });

    const cardY = 38 + lines.length * 19 + 8;
    const cardH = BASE_H - cardY - 48;

    // Framed Cover Card
    ctx.save();
    roundRectPath(ctx, 18, cardY, BASE_W - 36, cardH, 14);
    ctx.clip();
    if (coverImg) {
      drawCoverImage(ctx, coverImg, 18, cardY, BASE_W - 36, cardH);
    } else {
      ctx.fillStyle = isLight ? themeColor : 'rgba(0,0,0,0.22)';
      ctx.fillRect(18, cardY, BASE_W - 36, cardH);
    }
    ctx.restore();

    // Count badge floating on framed image
    fillRoundRect(ctx, 26, cardY + cardH - 24, 78, 16, 8, 'rgba(20, 14, 13, 0.78)');
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 7px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(countLabel, 33, cardY + cardH - 16);

    // Bottom domain bar
    fillRoundRect(
      ctx,
      18,
      BASE_H - 34,
      BASE_W - 36,
      20,
      10,
      isLight ? '#201615' : '#ffffff'
    );
    ctx.fillStyle = isLight ? '#ffffff' : '#201615';
    ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`🔗 ${domain}`, 28, BASE_H - 24);
  } else {
    // Template 4 ('teratas'): Top 3 Products Showcase
    const bgFill = mixColors('#ffffff', themeColor, 0.88);
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // Category pill
    fillRoundRect(ctx, 18, 20, 88, 15, 7.5, themeColor);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 6.5px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('TOP 3 REKOMENDASI', 25, 27.5);

    // Collection Title
    ctx.fillStyle = '#201615';
    ctx.font = '700 15px Georgia, serif';
    ctx.textBaseline = 'top';
    const lines = wrapLines(ctx, title, BASE_W - 36, 2);
    lines.forEach((line, idx) => {
      ctx.fillText(line, 18, 42 + idx * 18);
    });

    const topThree = items.slice(0, 3);
    const itemThumbs = await Promise.all(topThree.map((it) => loadImageSafe(it.imageUrl)));

    let startY = 88;
    for (let i = 0; i < 3; i++) {
      const item = topThree[i];
      const rowH = 72;
      fillRoundRect(ctx, 16, startY, BASE_W - 32, rowH, 12, '#ffffff');

      if (item) {
        // Thumbnail
        ctx.save();
        roundRectPath(ctx, 22, startY + 8, 56, 56, 9);
        ctx.clip();
        if (itemThumbs[i]) {
          drawCoverImage(ctx, itemThumbs[i], 22, startY + 8, 56, 56);
        } else {
          ctx.fillStyle = mixColors('#ffffff', themeColor, 0.7);
          ctx.fillRect(22, startY + 8, 56, 56);
        }
        ctx.restore();

        // Item code & Marketplace
        fillRoundRect(ctx, 86, startY + 10, 26, 13, 6, themeColor);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 6.5px "Plus Jakarta Sans", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${item.code}`, 91, startY + 16.5);

        ctx.fillStyle = '#7a6864';
        ctx.font = '600 6.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(item.marketplace || 'Shopee', 117, startY + 16.5);

        // Item Title
        ctx.fillStyle = '#201615';
        ctx.font = '700 8.5px "Plus Jakarta Sans", sans-serif';
        ctx.textBaseline = 'top';
        const itemLines = wrapLines(ctx, item.title, BASE_W - 108, 2);
        itemLines.forEach((l, lIdx) => {
          ctx.fillText(l, 86, startY + 27 + lIdx * 11);
        });

        // Item Price
        ctx.fillStyle = themeColor;
        ctx.font = '700 8px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(item.price || 'Cek Harga', 86, startY + 52);
      } else {
        ctx.fillStyle = '#9e8c88';
        ctx.font = '500 8px "Plus Jakarta Sans", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('Slot produk rekomendasi berikutnya', 32, startY + rowH / 2);
      }

      startY += rowH + 8;
    }

    // Bottom CTA Pill
    fillRoundRect(ctx, 16, BASE_H - 34, BASE_W - 32, 20, 10, '#201615');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🔗 Ketik kode # di ${domain}`, 26, BASE_H - 24);
  }

  ctx.restore();
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal membuat file gambar Story.'));
    }, 'image/png');
  });
}
