import { fetchClient, API_BASE_URL } from './core';
import { toast } from '../components/Toast';

// 1. 定义配置接口 (这样编辑器会有代码提示)
export interface CompressOptions {
  maxWidth?: number; // 默认 1600
  quality?: number; // 默认 0.7 (0~1)
  type?: 'image/jpeg' | 'image/png' | 'image/webp'; // 默认 image/webp
}

export interface UploadOptions {
  forceCloudinary?: boolean;
  folder?: string;
  useOriginalName?: boolean;
}

// Helper: Convert File to Base64 Data URI (Raw)
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Helper: Client-side Image Compression
 */
export const compressImage = (file: File, options: CompressOptions = {}): Promise<string> => {
  const { maxWidth = 1600, quality = 0.7, type = 'image/webp' } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(type, quality));
        } else {
          resolve(event.target?.result as string);
        }
      };

      img.onerror = (e) => reject(new Error('Image load failed'));
    };

    reader.onerror = (e) => reject(new Error('File read failed'));
  });
};

// Helper to upload to Cloudflare R2
const uploadToR2 = async (file: File, options?: UploadOptions): Promise<string> => {
  const formData = new FormData();

  // 1. Append text fields FIRST
  // Default folder set to 'uploads' to prevent root directory pollution
  formData.append('folder', options?.folder || '');

  // Explicitly append metadata for strict backend validation
  formData.append('fileType', file.type || 'application/octet-stream');
  formData.append('fileName', file.name);

  if (options?.useOriginalName !== undefined) {
    formData.append('useOriginalName', String(options.useOriginalName));
  }

  // 2. Append file LAST
  formData.append('files', file); // Field name MUST be 'files'

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`R2 Upload Failed: ${response.status} ${errText}`);
  }

  const data = await response.json();

  // The backend owns the current delivery/CDN domain. Persisted business data
  // is normalized to an R2 object key by the API compatibility layer.
  if (data.url || data.publicUrl) {
    return data.url || data.publicUrl;
  }

  if (Array.isArray(data.data) && data.data.length > 0) {
    const uploaded = data.data[0];
    if (uploaded.url || uploaded.publicUrl) return uploaded.url || uploaded.publicUrl;
    if (uploaded.r2Url) return uploaded.r2Url;
  }

  if (data.r2Url) {
    return data.r2Url;
  }

  // Fallback for legacy format
  if (data.success && data.urls && data.urls.length > 0) {
    return data.urls[0];
  }

  console.error('R2 Upload Response:', data);
  throw new Error('R2 Upload returned no URLs');
};

// Helper to upload to Cloudinary directly
const uploadToCloudinary = async (file: File, options?: UploadOptions): Promise<string> => {
  const config = await fetchClient<{ cloudName: string; apiKey: string }>('/cloudinary/config');
  const signData = await fetchClient<{ timestamp: number; signature: string }>(
    '/cloudinary/signature'
  );

  const formData = new FormData();

  // 1. Text fields first
  formData.append('api_key', config.apiKey);
  formData.append('timestamp', signData.timestamp.toString());
  formData.append('signature', signData.signature);

  if (options?.folder) {
    formData.append('folder', options.folder);
  }

  // 2. File last
  formData.append('file', file);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`Cloudinary Upload Failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.secure_url;
};

// NEW: Helper to upload image (Public for components)
// Strategy: Try R2 first -> Fail -> Try Cloudinary -> Fail -> Return Base64 (Local)
export const uploadImage = async (file: File, options?: UploadOptions): Promise<string> => {
  // 1. Force Cloudinary (e.g. for Avatar face detection features)
  if (options?.forceCloudinary) {
    try {
      return await uploadToCloudinary(file, options);
    } catch (e) {
      console.error('Forced Cloudinary upload failed:', e);
      toast.error('Avatar upload failed. Trying local compression.');
      return await compressImage(file);
    }
  }

  // 2. Default: Try R2 First
  try {
    return await uploadToR2(file, options);
  } catch (r2Error) {
    console.warn('R2 upload failed, falling back to Cloudinary:', r2Error);

    // 3. Fallback: Cloudinary
    try {
      const cloudinaryUrl = await uploadToCloudinary(file, options);
      // Optional: Toast to inform user of fallback? Maybe too noisy.
      return cloudinaryUrl;
    } catch (cloudinaryError) {
      console.error('Cloudinary fallback failed:', cloudinaryError);

      // 4. Fallback: Local Base64
      try {
        const compressed = await compressImage(file);
        toast.info('Uploads failed. Using local compression.');
        return compressed;
      } catch (compressError) {
        return await fileToBase64(file);
      }
    }
  }
};
