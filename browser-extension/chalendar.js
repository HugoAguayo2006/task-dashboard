/* global chrome */
(() => {
  const extensionKey = 'canvasSubmissionSync'
  const pageKey = 'chalendar:canvas-submissions'

  function publish(value) {
    if (!value || !Array.isArray(value.ids) || !value.syncedAt) return
    const ids = value.ids.filter((id) => typeof id === 'string' && /^\d+$/.test(id))
    const next = JSON.stringify({ ids, syncedAt: value.syncedAt })
    if (window.localStorage.getItem(pageKey) === next) return
    window.localStorage.setItem(pageKey, next)
    window.dispatchEvent(new Event('chalendar:canvas-submissions-updated'))
  }

  void chrome.storage.local.get(extensionKey).then((result) => publish(result[extensionKey]))
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[extensionKey]) publish(changes[extensionKey].newValue)
  })
})()
