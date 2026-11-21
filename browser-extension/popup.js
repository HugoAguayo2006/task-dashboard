/* global chrome */
void chrome.storage.local.get('canvasSubmissionSync').then(({ canvasSubmissionSync: value }) => {
  const status = document.getElementById('status')
  const last = document.getElementById('last')
  const error = document.getElementById('error')
  if (!value?.syncedAt) {
    status.textContent = 'Abre Canvas con tu sesión iniciada para sincronizar.'
  } else {
    status.textContent = `${value.ids?.length || 0} entregas detectadas.`
    last.textContent = `Última consulta: ${new Date(value.syncedAt).toLocaleString('es-MX')}`
  }
  error.textContent = value?.error || ''
})
