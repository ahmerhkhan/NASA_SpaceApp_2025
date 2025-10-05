import * as Cesium from 'cesium'

export function flyToForEntry(viewer: Cesium.Viewer, lat: number, lon: number, opts?: { maxHeight?: number; duration?: number; maxRadiusKm?: number }) {
	const C = Cesium
	const derivedMax = (opts?.maxRadiusKm ? Math.min(opts.maxRadiusKm * 2000 * 1000, 6_000_000) : 6_000_000)
	const height = Math.min(opts?.maxHeight ?? derivedMax, 6_000_000)
	viewer.camera.flyTo({
		destination: C.Cartesian3.fromDegrees(lon, lat, height),
		duration: opts?.duration ?? 1.0,
		orientation: { heading: 0, pitch: C.Math.toRadians(-85), roll: 0 }
	})
}

export function focusImpactArea(viewer: Cesium.Viewer, lat: number, lon: number, maxRadiusKm: number) {
	const C = Cesium
	const height = Math.max(maxRadiusKm * 1500, 500_000)
	viewer.camera.flyTo({
		destination: C.Cartesian3.fromDegrees(lon, lat, height),
		duration: 1.2,
		orientation: { heading: 0, pitch: C.Math.toRadians(-85), roll: 0 }
	})
}

export function cameraShake(viewer: Cesium.Viewer, ms = 500, intensity = 1.0) {
	const base = viewer.camera.positionWC.clone()
	const baseOrientation = viewer.camera.orientation.clone()
	const start = performance.now()
	
	const jitter = () => {
		const t = (performance.now() - start) / ms
		if (t < 1) {
			// More realistic shake with decreasing intensity
			const amp = 8000 * intensity * (1 - t) * (1 - t) // Quadratic decay
			const shakeX = (Math.random() - 0.5) * amp
			const shakeY = (Math.random() - 0.5) * amp
			const shakeZ = (Math.random() - 0.5) * amp * 0.5 // Less vertical shake
			
			const dest = new Cesium.Cartesian3(base.x + shakeX, base.y + shakeY, base.z + shakeZ)
			
			// Add slight rotation shake
			const rotX = (Math.random() - 0.5) * 0.02 * intensity * (1 - t)
			const rotY = (Math.random() - 0.5) * 0.02 * intensity * (1 - t)
			const rotZ = (Math.random() - 0.5) * 0.01 * intensity * (1 - t)
			
			viewer.camera.setView({ 
				destination: dest,
				orientation: Cesium.Transforms.headingPitchRollQuaternion(
					dest,
					new Cesium.HeadingPitchRoll(rotZ, rotX, rotY)
				)
			})
			requestAnimationFrame(jitter)
		} else {
			// Smooth return to original position
			viewer.camera.flyTo({
				destination: base,
				orientation: baseOrientation,
				duration: 0.5
			})
		}
	}
	jitter()
}

export function cinematicImpactFocus(
	viewer: Cesium.Viewer, 
	lat: number, 
	lon: number, 
	maxRadiusKm: number,
	opts?: { minHeight?: number; maxHeight?: number; duration?: number; sizeAwareFov?: boolean }
) {
	const C = Cesium
	const minH = opts?.minHeight ?? 400_000
	const maxH = opts?.maxHeight ?? 6_000_000
	const height = Math.max(Math.min(maxRadiusKm * 2000, maxH), minH)
	
	viewer.camera.flyTo({
		destination: C.Cartesian3.fromDegrees(lon, lat, height),
		orientation: { 
			heading: 0, 
			pitch: C.Math.toRadians(-78),
			roll: 0 
		},
		duration: opts?.duration ?? 1.6,
		complete: () => {
			// Slight camera movement for cinematic feel
			setTimeout(() => {
				viewer.camera.flyTo({
					destination: C.Cartesian3.fromDegrees(lon, lat, Math.max(minH, height * 0.8)),
					orientation: { 
						heading: C.Math.toRadians(15), 
						pitch: C.Math.toRadians(-82),
						roll: 0 
					},
					duration: 1.5
				})
			}, 1000)
		}
	})
}


