import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { Resend } from 'resend'

const alertPlugin = (env) => ({
  name: 'reservation-alerts',
  configureServer(server) {
    server.middlewares.use('/api/login', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const credentials = JSON.parse(body)
          const valid = credentials.login === env.ADMIN_LOGIN && credentials.password === env.ADMIN_PASSWORD
          res.statusCode = valid ? 200 : 401
          res.end(JSON.stringify({ ok: valid }))
        } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Requisição inválida' }))
        }
      })
    })
    server.middlewares.use('/api/alerts', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        res.setHeader('Content-Type', 'application/json')
        if (!env.RESEND_API_KEY) {
          res.statusCode = 503
          return res.end(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }))
        }
        try {
          const data = JSON.parse(body)
          const resend = new Resend(env.RESEND_API_KEY)
          const result = await resend.emails.send({
            from: env.ALERT_FROM || 'Agenda Airbnb <onboarding@resend.dev>',
            to: (env.ALERT_RECIPIENTS || '').split(',').map(email => email.trim()).filter(Boolean),
            subject: `Nova reserva — ${data.property}`,
            html: `<div style="font-family:Arial,sans-serif;color:#111827"><h2>Reserva confirmada</h2><p><strong>Hóspede:</strong> ${data.guest}</p><p><strong>Imóvel:</strong> ${data.property}</p><p><strong>Entrada:</strong> ${data.checkin}</p><p><strong>Saída:</strong> ${data.checkout}</p><p><strong>Valor:</strong> ${data.value}</p></div>`
          })
          res.end(JSON.stringify({ ok: true, id: result.data?.id }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })
    })
  }
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), alertPlugin(env)] }
})
