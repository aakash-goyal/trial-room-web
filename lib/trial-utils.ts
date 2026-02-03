export const MAX_DIMENSION = 1080;

export interface InventoryItem {
  id: string;
  store_id: string;
  name: string;
  image_url?: string;
  scale_factor?: number;
  category?: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  shirt: 'Shirt',
  tshirt: 'T-Shirt',
  jeans: 'Jeans',
  trouser: 'Trouser',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

export interface OverlayState {
  x: number;
  y: number;
  scale: number;
}

export function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
        return;
      }

      if (width > height) {
        height = Math.round((height / width) * MAX_DIMENSION);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width / height) * MAX_DIMENSION);
        height = MAX_DIMENSION;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
