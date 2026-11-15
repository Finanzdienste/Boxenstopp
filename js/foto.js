/*
 * Fotos fürs Hochladen und für die KI vorbereiten: verkleinern, als JPEG,
 * als base64 – ohne den Rest der App (die Sachen-App unter sachen/ braucht nur
 * das). ansicht-ki.js gibt es für die Resteverwertung, Amys Import, die
 * Angebote und die Speisekarte weiter.
 */

/** Standard: höchstens 1280 px an der langen Kante. */
const KANTE = 1280;

export const blobZuB64 = (blob) => new Promise((ok, nein) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => nein(r.error);
  r.readAsDataURL(blob);
});

async function bildLaden(datei) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(datei); } catch { /* weiter mit <img> */ }
  }
  const url = URL.createObjectURL(datei);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Auf höchstens 1280 px verkleinern und als JPEG – das spart Zeit und Geld (Speisekarten: größer, sonst ist die Schrift weg). */
export async function fotoVorbereiten(datei, kante = KANTE) {
  const bild = await bildLaden(datei);
  const b = bild.width || bild.naturalWidth;
  const h = bild.height || bild.naturalHeight;
  const s = Math.min(1, kante / Math.max(b, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  if (typeof bild.close === 'function') bild.close();
  const blob = await new Promise((ok) => { c.toBlob(ok, 'image/jpeg', 0.82); });
  if (!blob) throw new Error('kein Bild');
  return { url: URL.createObjectURL(blob), b64: await blobZuB64(blob) };
}
