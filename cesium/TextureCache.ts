import * as Cesium from 'cesium'

// Cache for procedural textures to avoid regeneration
const textureCache = new Map<string, HTMLCanvasElement>()

export function generateRockTexture(size = 128, options?: { hex?: string; contrast?: number; brightness?: number }): HTMLCanvasElement {
	const cacheKey = `rock_${size}`
	
	if (textureCache.has(cacheKey)) {
		return textureCache.get(cacheKey)!
	}

	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')!
	const img = ctx.createImageData(size, size)
	
	const baseColor = (() => {
		const hex = options?.hex || '#5a4a3f' // dark brownish rock
		const bigint = parseInt(hex.replace('#',''), 16)
		return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
	})()

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const nx = x / size - 0.5, ny = y / size - 0.5
			const d = Math.sqrt(nx * nx + ny * ny)
			const mask = Math.max(0, 1 - d * 2)
			const s1 = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453
			const n1 = s1 - Math.floor(s1)
			const s2 = Math.sin((x + 11.3) * 4.123 + (y + 3.7) * 9.731) * 15731.743
			const n2 = s2 - Math.floor(s2)
			const noise = n1 * 0.6 + n2 * 0.4
			let r = baseColor.r * 0.6 + noise * 40, g = baseColor.g * 0.6 + noise * 35, b = baseColor.b * 0.6 + noise * 30
			const shade = 0.6 + mask * 0.4
			r *= shade; g *= shade; b *= shade
			const rim = Math.max(0, Math.min(1, (d - 0.38) * 3.0))
			r += rim * 80; g += rim * 40
			const a = mask
			const i = (y * size + x) * 4
			img.data[i] = Math.max(0, Math.min(255, r))
			img.data[i + 1] = Math.max(0, Math.min(255, g))
			img.data[i + 2] = Math.max(0, Math.min(255, b))
			img.data[i + 3] = Math.max(0, Math.min(255, a * 255))
		}
	}
	ctx.putImageData(img, 0, 0)
	
	textureCache.set(cacheKey, canvas)
	return canvas
}

export function preloadTextures() {
	// Pre-generate common texture sizes
	generateRockTexture(128)
	generateRockTexture(256)
	generateRockTexture(512)
}

export function clearTextureCache() {
	textureCache.clear()
}
