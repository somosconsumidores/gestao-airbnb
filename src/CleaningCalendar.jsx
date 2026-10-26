import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, Broom, CalendarBlank, ClockCounterClockwise } from '@phosphor-icons/react'
import { businessDate } from './lib/analytics'
import { plannedCleanings } from './lib/cleaning'
import './cleaning.css'

export default function CleaningCalendar({ reservations, properties, tasks, onMove, onReset }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [propertyId, setPropertyId] = useState('all')
  const [draggedId, setDraggedId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const today = businessDate(new Date())
  const cleanings = useMemo(() => plannedCleanings(reservations, tasks, today).filter(item => propertyId === 'all' || item.propertyId === propertyId), [reservations, tasks, today, propertyId])
  const propertyById = useMemo(() => new Map(properties.map(property => [property.id, property])), [properties])
  const start = startOfMonth(month)
  const days = eachDayOfInterval({ start, end: endOfMonth(month) })
  const blanks = Array((start.getDay() + 6) % 7).fill(null)
  const monthKey = format(month, 'yyyy-MM')
  const monthCleanings = cleanings.filter(item => item.date.startsWith(monthKey))
  const move = async (item, date) => {
    if (!date || date === item.date || busyId) return
    setError('')
    setBusyId(item.id)
    try { await onMove(item, date) }
    catch (cause) { setError(`Não foi possível reagendar a faxina: ${cause.message}`) }
    finally { setBusyId(null); setDraggedId(null) }
  }
  const reset = async item => {
    if (busyId) return
    setError('')
    setBusyId(item.id)
    try { await onReset(item) }
    catch (cause) { setError(`Não foi possível restaurar a data: ${cause.message}`) }
    finally { setBusyId(null) }
  }
  return <section className="cleaning-page">
    <div className="cleaning-intro"><div><p className="eyebrow">Operação dos imóveis</p><h2>Organização das Faxinas</h2><p>Uma faxina prevista em cada check-out. Arraste para reagendar ou escolha outra data no cartão.</p></div><div className="cleaning-summary"><Broom size={22} /><strong>{monthCleanings.length}</strong><span>{monthCleanings.length === 1 ? 'faxina no mês' : 'faxinas no mês'}</span></div></div>
    <div className="cleaning-toolbar"><div className="cleaning-month-controls"><button type="button" className="icon-button" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior"><ArrowLeft /></button><h3>{format(month, 'MMMM yyyy', { locale: ptBR })}</h3><button type="button" className="icon-button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ArrowRight /></button><button type="button" className="cleaning-today" onClick={() => setMonth(startOfMonth(new Date()))}>Hoje</button></div><label>Imóvel<select value={propertyId} onChange={event => setPropertyId(event.target.value)}><option value="all">Todos os imóveis</option>{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label></div>
    {error && <p className="cleaning-error" role="alert">{error}</p>}
    <div className="cleaning-calendar" role="grid" aria-label={`Faxinas em ${format(month, 'MMMM yyyy', { locale: ptBR })}`}>
      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <div className="cleaning-weekday" key={day} role="columnheader">{day}</div>)}
      {blanks.map((_, index) => <div className="cleaning-empty-day" key={`empty-${index}`} aria-hidden="true" />)}
      {days.map(day => {
        const date = format(day, 'yyyy-MM-dd')
        const dayItems = monthCleanings.filter(item => item.date === date)
        return <div className={`cleaning-day ${isSameDay(day, new Date()) ? 'is-today' : ''}`} key={date} role="gridcell" aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}: ${dayItems.length} faxinas`}
          onDragOver={event => { if (draggedId) event.preventDefault() }}
          onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain') || draggedId; const item = cleanings.find(cleaning => cleaning.id === id); if (item) move(item, date) }}>
          <time dateTime={date}>{format(day, 'd')}</time>
          <div className="cleaning-day-items">{dayItems.map(item => {
            const property = propertyById.get(item.propertyId)
            return <article className={`cleaning-card ${busyId === item.id ? 'is-saving' : ''}`} key={item.id} draggable={busyId === null}
              onDragStart={event => { setDraggedId(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id) }} onDragEnd={() => setDraggedId(null)}
              style={{ '--cleaning-color': property?.color || '#e65c00' }}>
              <strong>{property?.name || 'Imóvel'}</strong><span>Saída {format(new Date(`${item.checkoutDate}T12:00:00`), 'dd/MM')} às {item.checkoutTime}</span><small>{item.guest}</small>
              {item.moved && <em>Reagendada</em>}
              <div className="cleaning-card-actions"><label title="Alterar a data da faxina"><CalendarBlank aria-hidden="true" /><input type="date" aria-label={`Data da faxina de ${property?.name || 'imóvel'} após saída de ${item.guest}`} value={item.date} disabled={busyId !== null} onChange={event => move(item, event.target.value)} /></label>{item.moved && <button type="button" onClick={() => reset(item)} disabled={busyId !== null} title="Voltar para o dia do check-out" aria-label={`Restaurar faxina de ${property?.name || 'imóvel'} para ${item.checkoutDate}`}><ClockCounterClockwise /></button>}</div>
            </article>
          })}</div>
        </div>
      })}
    </div>
    <p className="cleaning-help">Reservas canceladas não geram faxina. Ao criar ou alterar uma reserva, a previsão acompanha o dia do check-out; datas ajustadas manualmente ficam salvas para Sandro e Joana.</p>
  </section>
}
