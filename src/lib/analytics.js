import { addMonths, differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns'

export const isReceived = r => ['Check-in', 'Check-out'].includes(r.status) || (r.status === 'Cancelada' && /valor recebido/i.test(r.notes || ''))
export const validRevenue = r => Number(r.value) > 0 && (r.status !== 'Cancelada' || isReceived(r))
export const monthKey = date => format(date, 'yyyy-MM')
const nights = r => Math.max(0, differenceInCalendarDays(parseISO(r.checkout), parseISO(r.checkin)))

export function historyBounds(reservations, now = new Date()) {
  const months = reservations.map(r => r.checkin?.slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)).sort()
  return { from: months[0] || monthKey(now), to: months.at(-1) || monthKey(now) }
}

export function analyze(reservations, properties, propertyId, from, to) {
  const selectedProperties = properties.filter(p => propertyId === 'all' || p.id === propertyId)
  const ids = new Set(selectedProperties.map(p => p.id))
  const selected = reservations.filter(r => ids.has(r.propertyId))
  const start = parseISO(`${from}-01`), end = addMonths(parseISO(`${to}-01`), 1)
  const monthly = []
  for (let date = startOfMonth(start); date < end; date = addMonths(date, 1)) {
    const next = addMonths(date, 1)
    const bookings = selected.filter(r => parseISO(r.checkin) >= date && parseISO(r.checkin) < next)
    const financial = bookings.filter(validRevenue)
    const received = financial.filter(isReceived).reduce((sum, r) => sum + Number(r.value), 0)
    const scheduled = financial.filter(r => !isReceived(r)).reduce((sum, r) => sum + Number(r.value), 0)
    // Unique property-nights prevent overlapping reservations from inflating occupancy.
    const occupied = new Set()
    selected.filter(r => r.status !== 'Cancelada').forEach(r => {
      const a = Math.max(0, differenceInCalendarDays(parseISO(r.checkin), date))
      const b = Math.min(differenceInCalendarDays(next, date), differenceInCalendarDays(parseISO(r.checkout), date))
      for (let day = a; day < b; day++) occupied.add(`${r.propertyId}:${day}`)
    })
    const capacity = differenceInCalendarDays(next, date) * selectedProperties.length
    monthly.push({ key: monthKey(date), date, received, scheduled, total: received + scheduled, occupancy: capacity ? occupied.size / capacity * 100 : 0, occupied: occupied.size, capacity })
  }
  const bookings = selected.filter(r => parseISO(r.checkin) >= start && parseISO(r.checkin) < end)
  const stays = bookings.filter(r => r.status !== 'Cancelada')
  const paidNights = stays.filter(validRevenue).reduce((sum, r) => sum + nights(r), 0)
  const stayRevenue = stays.filter(validRevenue).reduce((sum, r) => sum + Number(r.value), 0)
  const total = monthly.reduce((s, m) => s + m.total, 0)
  const received = monthly.reduce((s, m) => s + m.received, 0)
  const capacity = monthly.reduce((s, m) => s + m.capacity, 0)
  const occupied = monthly.reduce((s, m) => s + m.occupied, 0)
  const comparison = selectedProperties.map(p => {
    const rows = bookings.filter(r => r.propertyId === p.id && validRevenue(r))
    return { ...p, total: rows.reduce((s, r) => s + Number(r.value), 0), received: rows.filter(isReceived).reduce((s, r) => s + Number(r.value), 0) }
  }).sort((a, b) => b.total - a.total)
  return { monthly, total, received, scheduled: total - received, occupancy: capacity ? occupied / capacity * 100 : 0, adr: paidNights ? stayRevenue / paidNights : 0, revpar: capacity ? stayRevenue / capacity : 0, nights: occupied, stays: stays.length, length: stays.length ? stays.reduce((s, r) => s + nights(r), 0) / stays.length : 0, cancellation: bookings.length ? (bookings.length - stays.length) / bookings.length * 100 : 0, comparison }
}
