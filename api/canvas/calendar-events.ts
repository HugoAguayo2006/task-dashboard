type VercelRequest = {
  query: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const baseUrl = process.env.CANVAS_BASE_URL
  const accessToken = process.env.CANVAS_ACCESS_TOKEN

  if (!baseUrl || !accessToken) {
    response.status(400).json({
      code: 'missing-token',
      error: 'Configura CANVAS_BASE_URL y CANVAS_ACCESS_TOKEN como variables privadas.',
    })
    return
  }

  const type = first(request.query.type) ?? 'assignment'
  const startDate = first(request.query.start_date)
  const endDate = first(request.query.end_date)
  const canvasUrl = new URL('/api/v1/calendar_events', baseUrl)
  canvasUrl.searchParams.set('type', type)
  if (startDate) canvasUrl.searchParams.set('start_date', startDate)
  if (endDate) canvasUrl.searchParams.set('end_date', endDate)

  try {
    const canvasResponse = await fetch(canvasUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const payload = await canvasResponse.json().catch(() => [])

    if (!canvasResponse.ok) {
      response.status(canvasResponse.status).json({
        code: 'canvas-error',
        error: 'Canvas rechazó la solicitud.',
        detail: payload,
      })
      return
    }

    response.status(200).json({ events: payload })
  } catch {
    response.status(502).json({
      code: 'canvas-error',
      error: 'No se pudo conectar con Canvas.',
    })
  }
}
