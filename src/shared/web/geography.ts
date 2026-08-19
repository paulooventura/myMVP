import { parseQuestionFocus } from '../principles'
import type { DirectAnswer } from './question-kind'

const DIRECT_RELIABILITY: DirectAnswer['reliability'] = {
  confidence: 'high',
  score: 92,
  caveats: ['Computed from geographic coordinates (great-circle distance).'],
  corroboratingChannels: 0,
  groundedClaims: []
}

export interface CityPair {
  from: string
  to: string
}

/** "distance from Nashville to Sao Paulo" → { from, to } */
export function parseDistanceQuestion(question: string): CityPair | null {
  const q = question.trim().replace(/\?+$/, '')

  const patterns = [
    /\bdistance\s+(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/i,
    /\bhow far\s+(?:is|are)\s+(.+?)\s+(?:from|to)\s+(.+)$/i,
    /\bhow many\s+(?:miles|kilometers|km)\s+(?:is it\s+)?(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/i,
    /^(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)\s+distance$/i
  ]

  for (const p of patterns) {
    const m = q.match(p)
    if (m) {
      return { from: cleanPlace(m[1]), to: cleanPlace(m[2]) }
    }
  }

  // "what is the distance from X to Y"
  const what = q.match(
    /^(?:what is|what's|whats)\s+(?:the\s+)?distance\s+(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/i
  )
  if (what) return { from: cleanPlace(what[1]), to: cleanPlace(what[2]) }

  return null
}

function cleanPlace(s: string): string {
  return s
    .replace(/^(the city of|city of)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Coords {
  lat: number
  lon: number
  label: string
}

/** Well-known cities — instant lookup when geocoder is slow/unavailable. */
const KNOWN_CITIES: Record<string, Coords> = {
  nashville: { lat: 36.1627, lon: -86.7816, label: 'Nashville, Tennessee' },
  'sao paulo': { lat: -23.5505, lon: -46.6333, label: 'São Paulo, Brazil' },
  'são paulo': { lat: -23.5505, lon: -46.6333, label: 'São Paulo, Brazil' },
  'new york': { lat: 40.7128, lon: -74.006, label: 'New York City' },
  london: { lat: 51.5074, lon: -0.1278, label: 'London, UK' },
  paris: { lat: 48.8566, lon: 2.3522, label: 'Paris, France' },
  tokyo: { lat: 35.6762, lon: 139.6503, label: 'Tokyo, Japan' },
  'los angeles': { lat: 34.0522, lon: -118.2437, label: 'Los Angeles' },
  chicago: { lat: 41.8781, lon: -87.6298, label: 'Chicago' },
  miami: { lat: 25.7617, lon: -80.1918, label: 'Miami' },
  atlanta: { lat: 33.749, lon: -84.388, label: 'Atlanta' },
  memphis: { lat: 35.1495, lon: -90.049, label: 'Memphis' },
  austin: { lat: 30.2672, lon: -97.7431, label: 'Austin' },
  'rio de janeiro': { lat: -22.9068, lon: -43.1729, label: 'Rio de Janeiro' },
  'buenos aires': { lat: -34.6037, lon: -58.3816, label: 'Buenos Aires' }
}

export async function tryDistanceAnswer(question: string): Promise<DirectAnswer | null> {
  const pair = parseDistanceQuestion(question)
  if (!pair) return null

  const [a, b] = await Promise.all([resolvePlace(pair.from), resolvePlace(pair.to)])
  if (!a || !b) {
    return {
      answer:
        `**Question:** ${parseQuestionFocus(question)}\n\n` +
        `**Answer:** I couldn't resolve one or both places ("${pair.from}", "${pair.to}") to coordinates. ` +
        `Try full city names with country (e.g. "Nashville, USA" to "São Paulo, Brazil").`,
      reliability: {
        confidence: 'low',
        score: 30,
        caveats: ['Geocoding failed for one or both places.'],
        corroboratingChannels: 0,
        groundedClaims: []
      }
    }
  }

  const km = haversineKm(a.lat, a.lon, b.lat, b.lon)
  const miles = km * 0.621371

  return {
    answer:
      `**Question:** ${parseQuestionFocus(question)}\n\n` +
      `**Answer:** The great-circle distance from **${a.label}** to **${b.label}** is about **${formatNum(miles)} miles** (${formatNum(km)} km).\n\n` +
      `**Reasoning:** Straight-line ("as the crow flies") distance from coordinates — actual travel distance by road or flight may differ.`,
    reliability: DIRECT_RELIABILITY
  }
}

async function resolvePlace(name: string): Promise<Coords | null> {
  const key = name.toLowerCase().trim()
  if (KNOWN_CITIES[key]) return KNOWN_CITIES[key]

  try {
    const params = new URLSearchParams({ q: name, format: 'json', limit: '1' })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en' }
    })
    if (!res.ok) return null
    const data = (await res.json()) as { lat: string; lon: string; display_name: string }[]
    if (!data[0]) return null
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      label: data[0].display_name.split(',').slice(0, 3).join(',').trim()
    }
  } catch {
    return null
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

const CAPITALS: Record<string, string> = {
  france: 'Paris',
  usa: 'Washington, D.C.',
  'united states': 'Washington, D.C.',
  brazil: 'Brasília',
  japan: 'Tokyo',
  uk: 'London',
  'united kingdom': 'London',
  germany: 'Berlin',
  italy: 'Rome',
  spain: 'Madrid',
  canada: 'Ottawa',
  mexico: 'Mexico City',
  australia: 'Canberra',
  india: 'New Delhi',
  china: 'Beijing',
  russia: 'Moscow',
  argentina: 'Buenos Aires',
  colombia: 'Bogotá',
  tennessee: 'Nashville'
}

export function tryCapitalAnswer(question: string): DirectAnswer | null {
  const q = question.toLowerCase()
  const m = q.match(/\b(?:what is|what's|whats)\s+(?:the\s+)?capital\s+(?:of|city of)\s+(.+?)\??$/i)
  if (!m) return null

  const place = m[1].trim().replace(/\?+$/, '')
  const capital = CAPITALS[place.toLowerCase()]
  if (!capital) return null

  return {
    answer: `**Answer:** The capital of ${place} is **${capital}**.`,
    reliability: {
      confidence: 'high',
      score: 90,
      caveats: [],
      corroboratingChannels: 0,
      groundedClaims: []
    }
  }
}
