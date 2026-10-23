/** Image loading is limited to web images and embedded image data. Local files
 * are read by the converter and embedded, never emitted as file:// URLs. */
export const IMAGE_ALLOWED_ATTRS = new Set(['src', 'alt', 'title', 'style', 'referrerpolicy'])
export const IMAGE_DATA_PATTERN = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon|svg\+xml)(?:;charset=[\w-]+)?(?:;base64)?,/i

export function isSafeImageSrc(source: string): boolean {
  if (/[\u0000-\u0020\u007f]/.test(source)) return false
  if (IMAGE_DATA_PATTERN.test(source)) return true
  try {
    const url = new URL(source)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
  } catch {
    return false
  }
}
