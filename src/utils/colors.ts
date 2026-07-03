export const palette = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#22d3ee',
  '#fb7185',
  '#c084fc',
]

export const canvasColor = '#4ade80'

function normalizeHex(hex: string) {
  const value = hex.replace('#', '')
  if (value.length === 3) {
    return value
      .split('')
      .map((character) => character + character)
      .join('')
  }
  return value
}

function colorLuminance(hex: string) {
  const value = normalizeHex(hex)
  if (!/^[\da-f]{6}$/i.test(value)) return 0
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255
}

export function readableColor(hex: string) {
  const luminance = colorLuminance(hex)
  return luminance > 0.6 ? '#111827' : '#f8fafc'
}

export function visibleOnLightColor(hex: string) {
  return colorLuminance(hex) > 0.82 ? '#111827' : hex
}
