import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

type ReservationPayload = { reservation_id?: number }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]!))

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const authorization = req.headers.get("Authorization")
  if (!authorization) return json({ error: "Unauthorized" }, 401)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const resendApiKey = Deno.env.get("RESEND_API_KEY")
  const alertFrom = Deno.env.get("ALERT_FROM") || "Agenda Airbnb <onboarding@resend.dev>"
  if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured" }, 500)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""))
  if (userError) return json({ error: "Unauthorized" }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { reservation_id } = await req.json() as ReservationPayload
  if (!reservation_id) return json({ error: "reservation_id is required" }, 400)

  const { data: reservation, error: reservationError } = await userClient
    .from('reservations')
    .select('id, organization_id, primary_guest_name, stay_amount, checkin_at, checkout_at, properties(name)')
    .eq('id', reservation_id)
    .single()
  if (reservationError || !reservation) return json({ error: "Reservation not found or forbidden" }, 404)

  const property = Array.isArray(reservation.properties) ? reservation.properties[0] : reservation.properties
  if (!property) return json({ error: "Property not found" }, 404)

  const { data: recipients, error: recipientsError } = await adminClient
    .from('notification_recipients')
    .select('email')
    .eq('organization_id', reservation.organization_id)
    .eq('enabled', true)
  if (recipientsError) return json({ error: "Unable to load recipients" }, 500)

  const emails = recipients.map((recipient: { email: string }) => recipient.email)
  if (!emails.length) return json({ error: "No enabled recipients" }, 422)

  const html = `<div style="font-family:Arial,sans-serif;color:#111827"><h2>Reserva confirmada</h2><p><strong>Hóspede:</strong> ${escapeHtml(reservation.primary_guest_name)}</p><p><strong>Imóvel:</strong> ${escapeHtml(property.name)}</p><p><strong>Entrada:</strong> ${new Date(reservation.checkin_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><p><strong>Saída:</strong> ${new Date(reservation.checkout_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><p><strong>Valor:</strong> ${Number(reservation.stay_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>`
  const deliveries = await Promise.all(emails.map(async (email: string) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: alertFrom, to: [email], subject: `Nova reserva — ${property.name}`, html }),
    })
    return { email, ok: response.ok, result: await response.json() }
  }))

  await adminClient.from('notification_events').insert(deliveries.map(delivery => ({
    organization_id: reservation.organization_id,
    reservation_id,
    event_type: 'reservation_created',
    recipient_email: delivery.email,
    provider_message_id: delivery.result.id || null,
    status: delivery.ok ? 'sent' : 'failed',
    error_message: delivery.ok ? null : JSON.stringify(delivery.result),
  })))

  const failed = deliveries.filter(delivery => !delivery.ok)
  if (failed.length) return json({ error: "One or more deliveries failed", sent: deliveries.length - failed.length, failed: failed.map(delivery => delivery.email) }, 502)
  return json({ ok: true, recipients: deliveries.length, ids: deliveries.map(delivery => delivery.result.id) })
})
