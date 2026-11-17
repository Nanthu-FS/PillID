'use client';

// Downsize a photo in the browser before upload. Phone photos are several MB;
// Vercel rejects request bodies over ~4.5 MB, and the model doesn't need more
// than this to read an imprint.

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await loadViaImg(file);
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process this photo in your browser.');
  ctx.fillStyle = '#fff'; // flatten transparency
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function loadViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as a photo. Try a JPEG or PNG.'));
    };
    img.src = url;
  });
}
