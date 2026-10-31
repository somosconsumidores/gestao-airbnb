import { businessDate } from './analytics.js'

const checkoutTime = value => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))

export function plannedCheckins(reservations) {
  return reservations.filter(reservation => reservation.status !== 'Cancelada' && reservation.checkin)
    .map(reservation => ({ id: reservation.id, propertyId: reservation.propertyId, guest: reservation.guest, date: businessDate(reservation.checkin), checkinTime: checkoutTime(reservation.checkin) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.checkinTime.localeCompare(b.checkinTime))
}

export function plannedCleanings(reservations, tasks, today = businessDate(new Date())) {
  const overrides = new Map(tasks.filter(task => task.taskType === 'cleaning' && task.status !== 'cancelled' && task.reservationId).map(task => [task.reservationId, task]))
  return reservations.filter(reservation => {
    if (reservation.status === 'Cancelada') return false
    const override = overrides.get(reservation.id)
    return businessDate(reservation.checkout) >= today || (override && businessDate(override.dueAt) >= today)
  })
    .map(reservation => {
      const checkoutDate = businessDate(reservation.checkout)
      const override = overrides.get(reservation.id)
      return { id: reservation.id, propertyId: reservation.propertyId, guest: reservation.guest, checkoutDate, checkoutTime: checkoutTime(reservation.checkout), date: override ? businessDate(override.dueAt) : checkoutDate, moved: Boolean(override), task: override }
    }).sort((a, b) => a.date.localeCompare(b.date) || a.checkoutDate.localeCompare(b.checkoutDate))
}
