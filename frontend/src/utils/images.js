// src/utils/images.js
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const isImageFile = (file) => Boolean(file && file.type && file.type.startsWith('image/'));

/** Converts a File into an attachment { name, mimeType, data } (base64 without the data: prefix). */
export function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new Error(`${file?.name || 'File'} is not an image`));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error(`${file.name} is larger than 10 MB`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve({
        name: file.name || `image-${Date.now()}.png`,
        mimeType: file.type,
        data: comma === -1 ? result : result.slice(comma + 1),
      });
    };
    reader.readAsDataURL(file);
  });
}

export const attachmentToDataUrl = (img) => `data:${img.mimeType || 'image/png'};base64,${img.data}`;

export function filesFromDataTransfer(dataTransfer) {
  const out = [];
  if (!dataTransfer) return out;
  if (dataTransfer.items) {
    for (const item of dataTransfer.items) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
  } else if (dataTransfer.files) {
    out.push(...dataTransfer.files);
  }
  return out;
}
