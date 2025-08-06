import { describe, it, expect } from 'vitest'
import { decodePolyline, calculateCenter, calculateBounds } from './polylineDecoder'

describe('polylineDecoder', () => {
  describe('decodePolyline', () => {
    it('should decode a simple polyline', () => {
      // This is a known encoded polyline for a simple path
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
      const result = decodePolyline(encoded)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toBeInstanceOf(Array)
      expect(result[0]).toHaveLength(2)
      
      // Check that coordinates are reasonable (in decimal degrees)
      result.forEach(([lng, lat]) => {
        expect(lng).toBeGreaterThan(-180)
        expect(lng).toBeLessThan(180)
        expect(lat).toBeGreaterThan(-90)
        expect(lat).toBeLessThan(90)
      })
    })

    it('should return empty array for empty string', () => {
      const result = decodePolyline('')
      expect(result).toEqual([])
    })

    it('should handle single point polyline', () => {
      // Encoded polyline for coordinates near [0, 0]
      const encoded = '??' 
      const result = decodePolyline(encoded)
      
      expect(result).toHaveLength(1)
      expect(typeof result[0][0]).toBe('number')
      expect(typeof result[0][1]).toBe('number')
    })
  })

  describe('calculateCenter', () => {
    it('should calculate center of coordinates', () => {
      const coordinates: [number, number][] = [
        [-122.4, 37.8],
        [-122.3, 37.7],
        [-122.5, 37.9]
      ]
      
      const center = calculateCenter(coordinates)
      expect(center[0]).toBeCloseTo(-122.4, 1)
      expect(center[1]).toBeCloseTo(37.8, 1)
    })

    it('should return [0, 0] for empty coordinates', () => {
      const result = calculateCenter([])
      expect(result).toEqual([0, 0])
    })

    it('should return the same coordinate for single point', () => {
      const coordinates: [number, number][] = [[-122.4, 37.8]]
      const result = calculateCenter(coordinates)
      expect(result).toEqual([-122.4, 37.8])
    })
  })

  describe('calculateBounds', () => {
    it('should calculate correct bounding box', () => {
      const coordinates: [number, number][] = [
        [-122.4, 37.8],
        [-122.3, 37.7],
        [-122.5, 37.9]
      ]
      
      const bounds = calculateBounds(coordinates)
      expect(bounds).toEqual([[-122.5, 37.7], [-122.3, 37.9]])
    })

    it('should return [[0, 0], [0, 0]] for empty coordinates', () => {
      const result = calculateBounds([])
      expect(result).toEqual([[0, 0], [0, 0]])
    })

    it('should return same point twice for single coordinate', () => {
      const coordinates: [number, number][] = [[-122.4, 37.8]]
      const result = calculateBounds(coordinates)
      expect(result).toEqual([[-122.4, 37.8], [-122.4, 37.8]])
    })

    it('should handle negative coordinates correctly', () => {
      const coordinates: [number, number][] = [
        [-10, -20],
        [10, 20],
        [0, 0]
      ]
      
      const bounds = calculateBounds(coordinates)
      expect(bounds).toEqual([[-10, -20], [10, 20]])
    })
  })
})