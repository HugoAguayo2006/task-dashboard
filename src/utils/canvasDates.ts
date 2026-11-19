export function canvasLocalDue(value: string) {
  if (!value.includes('T')) return { date: value.slice(0, 10), time: '' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { date: value.slice(0, 10), time: value.slice(11, 16) }
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hour = String(parsed.getHours()).padStart(2, '0')
  const minute = String(parsed.getMinutes()).padStart(2, '0')
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` }
}
