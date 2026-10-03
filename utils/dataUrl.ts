export const dataUrlToBlob = (dataUrl: string): Blob => {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Expected an inline data URL');
  }

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    throw new Error('Malformed data URL');
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const parts = metadata.split(';').filter(Boolean);
  const mimeType = parts[0]?.includes('/') ? parts[0] : 'application/octet-stream';
  const isBase64 = parts.includes('base64');

  if (isBase64) {
    const decoded = atob(payload);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType });
};
