routerAdd(
  'POST',
  '/backend/v1/epa-copilot',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')
      const body = e.requestInfo().body || {}
      const message = String(body.message || '').trim()
      if (!message) return e.badRequestError('Escreva uma pergunta para o EPA Copilot')

      const result = $ai.agent('epa-copilot').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message,
      })
      return e.json(200, result)
    } catch (err) {
      if (err instanceof SkipAiConfigError)
        return e.json(503, { error: 'EPA Copilot temporariamente indisponível' })
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Não foi possível consultar o EPA Copilot' : err.message,
        })
      }
      if (err instanceof SkipAiError)
        return e.json(err.status || 502, { error: 'Serviço de IA temporariamente indisponível' })
      throw err
    }
  },
  $apis.requireAuth(),
)
