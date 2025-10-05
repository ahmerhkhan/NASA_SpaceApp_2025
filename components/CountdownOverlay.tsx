import React, { useState, useEffect } from 'react'

interface CountdownOverlayProps {
	isVisible: boolean
	duration: number
	onComplete?: () => void
}

export default function CountdownOverlay({ isVisible, duration, onComplete }: CountdownOverlayProps) {
	const [count, setCount] = useState(0)
	const [isAnimating, setIsAnimating] = useState(false)

	useEffect(() => {
		if (!isVisible) {
			setCount(0)
			setIsAnimating(false)
			return
		}

		setIsAnimating(true)
		const countdownDuration = Math.ceil(duration)
		let currentCount = countdownDuration

		const interval = setInterval(() => {
			currentCount -= 1
			setCount(currentCount)
			
			if (currentCount <= 0) {
				clearInterval(interval)
				setIsAnimating(false)
				onComplete?.()
			}
		}, 1000)

		return () => clearInterval(interval)
	}, [isVisible, duration, onComplete])

	if (!isVisible || !isAnimating) return null

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			width: '100%',
			height: '100%',
			backgroundColor: 'rgba(0, 0, 0, 0.3)', // Much more transparent
			display: 'flex',
			alignItems: 'flex-start',
			justifyContent: 'center',
			zIndex: 1000,
			pointerEvents: 'none',
			paddingTop: '80px' // Move down from center
		}}>
			<div style={{
				textAlign: 'center',
				color: 'white',
				fontFamily: 'monospace',
				backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent background
				padding: '20px 40px',
				borderRadius: '15px',
				border: '2px solid rgba(255, 68, 68, 0.8)',
				backdropFilter: 'blur(10px)' // Glass effect
			}}>
				<div style={{
					fontSize: count > 0 ? '80px' : '100px', // Smaller when counting
					fontWeight: 'bold',
					textShadow: '0 0 30px #ff4444, 0 0 60px #ff4444',
					animation: count > 0 ? 'pulse 1s ease-in-out' : 'impactPulse 0.5s ease-in-out infinite',
					marginBottom: '15px',
					color: count > 0 ? '#ff4444' : '#ff0000'
				}}>
					{count > 0 ? count : 'IMPACT!'}
				</div>
				<div style={{
					fontSize: '18px',
					opacity: 0.9,
					textTransform: 'uppercase',
					letterSpacing: '3px',
					color: '#ffaaaa'
				}}>
					{count > 0 ? 'Impact in' : 'Meteor Strike'}
				</div>
			</div>
			
			<style jsx>{`
				@keyframes pulse {
					0% { transform: scale(1); }
					50% { transform: scale(1.05); }
					100% { transform: scale(1); }
				}
				@keyframes impactPulse {
					0% { transform: scale(1); opacity: 1; }
					50% { transform: scale(1.1); opacity: 0.8; }
					100% { transform: scale(1); opacity: 1; }
				}
			`}</style>
		</div>
	)
}
