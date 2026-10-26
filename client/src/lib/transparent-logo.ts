// Remove only near-white pixels connected to the image border.
// Enclosed white artwork (such as lettering inside a colored mark) is preserved.
export function clearWhiteBorder(data: Uint8ClampedArray, width: number, height: number): void {
  // Already-transparent artwork and all-white logos need no background cleanup.
  let coloredPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) return;
    if (Math.min(data[i], data[i + 1], data[i + 2]) < 240) coloredPixels++;
  }
  if (!coloredPixels) return;
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  const add = (pixel: number) => {
    if (seen[pixel]) return;
    seen[pixel] = 1;
    const i = pixel * 4;
    if (data[i + 3] === 0 || (data[i] >= 240 && data[i + 1] >= 240 && data[i + 2] >= 240)) {
      queue.push(pixel);
    }
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  for (let head = 0; head < queue.length; head++) {
    const pixel = queue[head];
    data[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) add(pixel - 1);
    if (x < width - 1) add(pixel + 1);
    if (y > 0) add(pixel - width);
    if (y < height - 1) add(pixel + width);
  }
}

const cache = new Map<string, Promise<string>>();

export function transparentLogo(src: string): Promise<string> {
  const existing = cache.get(src);
  if (existing) return existing;
  const result = new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = new URL(src, window.location.href);
    if (url.origin !== window.location.origin && url.protocol !== "data:") image.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("Logo loading timed out")), 10000);
    image.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Cannot process logo transparency");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        clearWhiteBorder(pixels.data, canvas.width, canvas.height);
        context.putImageData(pixels, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Cannot load studio logo"));
    };
    image.src = src;
  });
  cache.set(src, result);
  result.catch(() => cache.delete(src));
  return result;
}