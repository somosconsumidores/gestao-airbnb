import { useEffect, useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, Buildings, CalendarBlank, Camera, CaretDown, ChartLineUp, Check, Clock, CurrencyDollar, Funnel, HouseLine, List, LockKey, MagnifyingGlass, PencilSimple, Plus, SignOut, WarningCircle, X } from '@phosphor-icons/react'
import { loadPortfolio, loginEmail, saveProperty, saveReservation, supabase, updateReservation } from './lib/supabase'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function Login({ onLogin }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onLogin(login, password)
    } catch { setError('Login ou senha incorretos. Tente novamente.') }
    finally { setLoading(false) }
  }
  return <main className="login-page">
    <div className="login-art" aria-hidden="true"><div className="art-copy"><span>Morada</span><h1>Hospitalidade bem gerida começa aqui.</h1><p>Agenda, operação e resultados dos seus imóveis em um único lugar.</p></div></div>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><span className="brand-mark"><HouseLine weight="fill" /></span><strong>morada</strong></div>
        <div><p className="eyebrow">Área dos administradores</p><h2>Bem-vindo de volta</h2><p className="muted">Acesse a central de gestão de Sandro e Joana.</p></div>
        <label>Login<input value={login} onChange={e => setLogin(e.target.value)} placeholder="Digite seu login" autoComplete="username" /></label>
        <label>Senha<div className="input-icon"><input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Digite sua senha" autoComplete="current-password" /><LockKey /></div></label>
        {error && <p className="form-error"><WarningCircle />{error}</p>}
        <button className="primary full" type="submit" disabled={loading}>{loading?'Validando acesso…':'Entrar na plataforma'} <ArrowRight /></button>
        <p className="secure"><LockKey /> Ambiente de acesso restrito</p>
      </form>
    </section>
  </main>
}

function Sidebar({ view, setView, logout }) {
  const items = [['dashboard', ChartLineUp, 'Visão geral'], ['calendar', CalendarBlank, 'Calendário'], ['reservations', List, 'Reservas'], ['properties', Buildings, 'Imóveis']]
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><HouseLine weight="fill" /></span><strong>morada</strong></div>
    <nav>{items.map(([id, Icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon />{label}</button>)}</nav>
    <div className="sidebar-foot"><div className="avatars"><span>SA</span><span>JM</span><div><strong>Sandro & Joana</strong><small>Administradores</small></div></div><button className="icon-button" onClick={logout} title="Sair"><SignOut /></button></div>
  </aside>
}

function Topbar({ title, onNew }) {
  return <header className="topbar"><div><p>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p><h1>{title}</h1></div><button className="primary" onClick={onNew}><Plus weight="bold" /> Nova reserva</button></header>
}

function Dashboard({ reservations, properties, setView, onNew }) {
  const [scheduledPropertyId, setScheduledPropertyId] = useState('all')
  const financialReservations = reservations.filter(reservation => Number(reservation.value) > 0)
  const activeReservations = reservations.filter(reservation => reservation.status !== 'Cancelada')
  const paidReservations = financialReservations.filter(reservation =>
    ['Check-in', 'Check-out'].includes(reservation.status)
    || (reservation.status === 'Cancelada' && /valor recebido/i.test(reservation.notes))
  )
  const paidStays = paidReservations.filter(reservation => reservation.status !== 'Cancelada')
  const paidRevenue = paidReservations.reduce((sum, reservation) => sum + Number(reservation.value), 0)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nightsInMonth = reservation => Math.max(0, (Math.min(parseISO(reservation.checkout), monthEnd) - Math.max(parseISO(reservation.checkin), monthStart)) / 86400000)
  const stayNights = reservation => {
    const checkin = parseISO(reservation.checkin)
    const checkout = parseISO(reservation.checkout)
    const checkinDate = new Date(checkin.getFullYear(), checkin.getMonth(), checkin.getDate())
    const checkoutDate = new Date(checkout.getFullYear(), checkout.getMonth(), checkout.getDate())
    return Math.max(0, Math.round((checkoutDate - checkinDate) / 86400000))
  }
  const occupiedNights = activeReservations.reduce((sum, reservation) => sum + nightsInMonth(reservation), 0)
  const occupancy = properties.length ? Math.min(100, Math.round((occupiedNights / (properties.length * ((monthEnd - monthStart) / 86400000))) * 100)) : 0
  const forecastReservations = activeReservations.filter(reservation =>
    ['Confirmada', 'Pendente'].includes(reservation.status)
    && parseISO(reservation.checkout) >= now
  )
  const forecastRevenue = forecastReservations.reduce((sum, reservation) => sum + Number(reservation.value), 0)
  const paidNights = paidStays.reduce((sum, reservation) => sum + stayNights(reservation), 0)
  const forecastNights = forecastReservations.reduce((sum, reservation) => sum + stayNights(reservation), 0)
  const totalDailyNights = paidNights + forecastNights
  const averageDailyRate = totalDailyNights ? (paidRevenue + forecastRevenue) / totalDailyNights : 0
  const scheduledReservations = forecastReservations.filter(reservation =>
    scheduledPropertyId === 'all' || reservation.propertyId === scheduledPropertyId
  )
  const scheduledRevenue = scheduledReservations.reduce((sum, reservation) => sum + Number(reservation.value), 0)
  const scheduledRevenueByMonth = Object.values(scheduledReservations.reduce((months, reservation) => {
    const checkin = parseISO(reservation.checkin)
    const key = format(checkin, 'yyyy-MM')
    months[key] ||= { key, date: checkin, value: 0, bookings: 0 }
    months[key].value += Number(reservation.value)
    months[key].bookings += 1
    return months
  }, {})).sort((a, b) => a.key.localeCompare(b.key))
  const maxScheduledRevenue = Math.max(...scheduledRevenueByMonth.map(month => month.value), 1)
  const next = [...activeReservations].filter(reservation => parseISO(reservation.checkout) >= now).sort((a,b) => a.checkin.localeCompare(b.checkin))[0]
  const prop = id => properties.find(p => p.id === id)
  const propertyStats = property => {
    const financialBookings = financialReservations.filter(reservation => reservation.propertyId === property.id)
    const operationalBookings = activeReservations.filter(reservation => reservation.propertyId === property.id)
    const earnings = financialBookings.reduce((sum, reservation) => sum + Number(reservation.value), 0)
    const nights = operationalBookings.reduce((sum, reservation) => sum + nightsInMonth(reservation), 0)
    const occupied = Math.min(100, Math.round((nights / ((monthEnd - monthStart) / 86400000)) * 100))
    return { earnings, occupied }
  }
  const root = useRef()
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(min-width: 681px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.from('.hero-copy > *', { y: 28, opacity: 0, stagger: .08, duration: .7, ease: 'power3.out' })
      gsap.from('.metric-card', { y: 34, opacity: 0, stagger: .1, duration: .7, delay: .15, ease: 'power3.out' })
      gsap.utils.toArray('.property-image').forEach(img => gsap.fromTo(img, { scale: .8, opacity: .55 }, { scale: 1, opacity: 1, scrollTrigger: { trigger: img, start: 'top 92%', end: 'bottom 35%', scrub: .7 } }))
    })
    return () => media.revert()
  }, { scope: root })
  return <div ref={root}>
    <section className="hero-split">
      <div className="hero-copy"><p className="eyebrow">Setembro em movimento</p><h2>Gestão Airbnb <span className="inline-photo" /> mais inteligente.</h2><p>Uma leitura clara do que entra, do que sai e do que merece sua atenção agora.</p><div className="hero-actions"><button className="primary" onClick={onNew}>Cadastrar reserva <ArrowRight /></button><button className="secondary" onClick={() => setView('calendar')}>Abrir calendário</button></div></div>
      <div className="hero-visual"><img src="https://picsum.photos/seed/rio-modern-home/1200/1000" alt="Interior contemporâneo de apartamento" /><div className="next-stay"><Clock /><div><span>Próximo check-in</span><strong>{next ? format(parseISO(next.checkin), "d MMM 'às' HH:mm", { locale: ptBR }) : 'Nenhum'}</strong><small>{next?.guest} · {prop(next?.propertyId)?.short}</small></div></div></div>
    </section>
    <section className="metrics-grid">
      <article className="metric-card revenue"><div className="metric-head"><span>Receita paga</span><CurrencyDollar /></div><strong>{money.format(paidRevenue)}</strong><p><b>{paidStays.length}</b> {paidStays.length===1?'estadia paga':'estadias pagas'}</p><svg viewBox="0 0 500 100" preserveAspectRatio="none"><path d="M0 84 C55 72 72 82 120 60 S205 74 252 42 S340 50 390 24 S455 38 500 8" fill="none" stroke="#E65C00" strokeWidth="4"/><path d="M0 84 C55 72 72 82 120 60 S205 74 252 42 S340 50 390 24 S455 38 500 8 L500 100 L0 100Z" fill="url(#grad)"/><defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#E65C00" stopOpacity=".22"/><stop offset="1" stopColor="#E65C00" stopOpacity="0"/></linearGradient></defs></svg></article>
      <article className="metric-card"><div className="metric-head"><span>Taxa de ocupação</span><CalendarBlank /></div><strong>{occupancy}<span>%</span></strong><div className="progress"><i style={{width:`${occupancy}%`}} /></div><p>Calculada sobre o mês atual</p></article>
      <article className="metric-card"><div className="metric-head"><span>Diária média geral</span><ChartLineUp /></div><strong>{money.format(averageDailyRate)}</strong><p>{money.format(paidRevenue + forecastRevenue)} ÷ {totalDailyNights} noites pagas e previstas</p></article>
    </section>
    <section className="scheduled-revenue-card">
      <div className="scheduled-revenue-copy"><div><p className="eyebrow">Previsão de caixa</p><h2>Receita programada mês a mês</h2></div><div className="scheduled-revenue-side"><label className="scheduled-property-filter"><span>Filtrar imóvel</span><select value={scheduledPropertyId} onChange={event => setScheduledPropertyId(event.target.value)}><option value="all">Todos os imóveis</option>{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select><CaretDown /></label><div className="scheduled-total"><span>Total programado</span><strong>{money.format(scheduledRevenue)}</strong><small>{scheduledReservations.length} {scheduledReservations.length === 1 ? 'reserva futura' : 'reservas futuras'}</small></div></div></div>
      {scheduledRevenueByMonth.length ? <div className="scheduled-chart" role="img" aria-label="Gráfico de barras da receita programada por mês">
        {scheduledRevenueByMonth.map(month => <div className="scheduled-column" key={month.key}>
          <strong>{money.format(month.value)}</strong>
          <div className="scheduled-track"><i style={{height:`${Math.max(8, (month.value / maxScheduledRevenue) * 100)}%`}}><span>{month.bookings}</span></i></div>
          <div><b>{format(month.date, 'MMM', { locale: ptBR })}</b><small>{format(month.date, 'yyyy')}</small></div>
        </div>)}
      </div> : <p className="empty-state">Ainda não há receita programada para os próximos meses.</p>}
    </section>
    <section className="section-head"><div><p className="eyebrow">Portfólio ativo</p><h2>O pulso de cada endereço</h2></div><button className="text-button" onClick={() => setView('properties')}>Ver todos <ArrowRight /></button></section>
    <section className="property-row">{properties.map(p => {const stats=propertyStats(p);return <article className="property-card group" key={p.id}><div className="image-wrap"><img className="property-image" src={p.image} alt={p.name} /><span style={{background:p.color}}>{p.status}</span></div><div><small>{p.address}</small><h3>{p.name}</h3><p>{stats.occupied}% ocupado · {money.format(stats.earnings)}</p></div></article>})}</section>
    <section className="marquee"><div>CHECK-IN CLARO · RECEITA VISÍVEL · OPERAÇÃO TRANQUILA · CHECK-IN CLARO · RECEITA VISÍVEL · OPERAÇÃO TRANQUILA ·</div></section>
  </div>
}

function CalendarView({ reservations, properties, onNew }) {
  const [month, setMonth] = useState(new Date(2026, 8, 1))
  const start = startOfMonth(month), end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })
  const blanks = Array((start.getDay() + 6) % 7).fill(null)
  const dayReservations = day => reservations.flatMap(reservation => {
    const checkin = parseISO(reservation.checkin)
    const checkout = parseISO(reservation.checkout)
    const checkinDate = new Date(checkin.getFullYear(), checkin.getMonth(), checkin.getDate())
    const checkoutDate = new Date(checkout.getFullYear(), checkout.getMonth(), checkout.getDate())
    const events = []
    if (isSameDay(day, checkinDate)) events.push({ reservation, type: 'checkin', time: format(checkin, 'HH:mm') })
    if (day > checkinDate && day < checkoutDate) events.push({ reservation, type: 'stay' })
    if (isSameDay(day, checkoutDate)) events.push({ reservation, type: 'checkout', time: format(checkout, 'HH:mm') })
    return events
  }).sort((a, b) => ({ checkout: 0, checkin: 1, stay: 2 })[a.type] - ({ checkout: 0, checkin: 1, stay: 2 })[b.type])
  return <section className="calendar-shell">
    <div className="calendar-toolbar"><div><button className="icon-button" onClick={()=>setMonth(subMonths(month,1))}><ArrowLeft /></button><button className="icon-button" onClick={()=>setMonth(addMonths(month,1))}><ArrowRight /></button><h2>{format(month, 'MMMM yyyy', { locale: ptBR })}</h2></div><div className="legend">{properties.map(p=><span key={p.id}><i style={{background:p.color}} />{p.short}</span>)}</div></div>
    <div className="calendar-grid weekdays">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=><div key={d}>{d}</div>)}</div>
    <div className="calendar-grid days">{blanks.map((_,i)=><div className="day empty" key={`b${i}`} />)}{days.map(day=>{const events=dayReservations(day);return <button className={`day ${isSameDay(day,new Date())?'today':''}`} key={day.toISOString()} onClick={onNew}><span>{format(day,'d')}</span>{events.slice(0,4).map(event=>{const {reservation,type,time}=event;const p=properties.find(x=>x.id===reservation.propertyId);const movement=type==='checkin'?'Entrada':type==='checkout'?'Saída':null;return <div className={`booking ${movement?'movement':''} ${type}`} style={{borderLeftColor:p.color,background:`${p.color}14`}} key={`${reservation.id}-${type}`} title={`${reservation.guest} · ${p.name}${movement?` · ${movement} às ${time}`:''}`}><b>{reservation.guest.split(' ')[0]}</b><small>{movement?<><span>{p.short} · </span>{movement} {time}</>:p.short}</small></div>})}{events.length>4&&<small className="more-events">+{events.length-4} movimentações</small>}</button>})}</div>
  </section>
}

function Reservations({ reservations, properties, onNew, onEdit }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [propertyId, setPropertyId] = useState('all')
  const [status, setStatus] = useState('all')
  const activeFilters = [query.trim(), propertyId !== 'all', status !== 'all'].filter(Boolean).length
  const propertyById = useMemo(() => new Map(properties.map(property => [property.id, property])), [properties])
  const statusOptions = useMemo(() => [...new Set(reservations.map(reservation => reservation.status))].sort(), [reservations])
  const filteredReservations = useMemo(() => reservations.filter(reservation => {
    const property = propertyById.get(reservation.propertyId)
    const searchable = normalizeSearch([reservation.guest, reservation.phone, property?.name].join(' '))
    return (!query.trim() || searchable.includes(normalizeSearch(query.trim())))
      && (propertyId === 'all' || reservation.propertyId === propertyId)
      && (status === 'all' || reservation.status === status)
  }), [propertyById, propertyId, query, reservations, status])
  const clearFilters = () => { setQuery(''); setPropertyId('all'); setStatus('all') }
  return <section className="table-card">
    <div className="table-intro"><div><p className="eyebrow">Agenda consolidada</p><h2>Todas as reservas</h2></div><button type="button" className={`secondary filter-trigger ${filtersOpen ? 'active' : ''}`} aria-expanded={filtersOpen} aria-controls="reservation-filters" onClick={()=>setFiltersOpen(open=>!open)}><Funnel /> Filtrar {activeFilters > 0 && <span>{activeFilters}</span>}<CaretDown className={filtersOpen ? 'rotated' : ''} /></button></div>
    {filtersOpen && <div className="reservation-filters" id="reservation-filters">
      <label className="reservation-search"><span>Buscar reserva</span><div><MagnifyingGlass /><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Hóspede, telefone ou imóvel" autoFocus /></div></label>
      <label><span>Imóvel</span><select value={propertyId} onChange={event=>setPropertyId(event.target.value)}><option value="all">Todos os imóveis</option>{properties.map(property=><option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
      <label><span>Status</span><select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Todos os status</option>{statusOptions.map(item=><option value={item} key={item}>{item}</option>)}</select></label>
      <div className="filter-summary"><strong>{filteredReservations.length}</strong><span>{filteredReservations.length===1?'reserva encontrada':'reservas encontradas'}</span>{activeFilters > 0 && <button type="button" onClick={clearFilters}>Limpar filtros</button>}</div>
    </div>}
    <div className="table-scroll"><table className="reservation-table"><thead><tr><th>Hóspede</th><th>Imóvel</th><th>Período</th><th>Valor</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{filteredReservations.length ? filteredReservations.map(r=>{const p=propertyById.get(r.propertyId); return <tr key={r.id}><td data-label="Hóspede"><strong>{r.guest}</strong><small>{r.phone || 'Sem telefone'}</small></td><td data-label="Imóvel"><span className="reservation-property"><i className="property-dot" style={{background:p?.color}} />{p?.name || 'Imóvel não encontrado'}</span></td><td data-label="Período"><span className="reservation-period">{format(parseISO(r.checkin),'dd MMM',{locale:ptBR})} — {format(parseISO(r.checkout),'dd MMM',{locale:ptBR})}<small>{format(parseISO(r.checkin),'HH:mm')} / {format(parseISO(r.checkout),'HH:mm')}</small></span></td><td data-label="Valor"><strong>{money.format(r.value)}</strong></td><td data-label="Status"><span className={`status ${r.status.toLowerCase()}`}>{r.status}</span></td><td data-label="Ações"><button type="button" className="edit-reservation" onClick={()=>onEdit(r)} aria-label={`Editar reserva de ${r.guest}`}><PencilSimple /> Editar</button></td></tr>}) : <tr><td className="table-empty" colSpan="6"><MagnifyingGlass /><strong>Nenhuma reserva encontrada</strong><span>Altere ou limpe os filtros para visualizar outras reservas.</span></td></tr>}</tbody></table></div>
    <button className="floating-add" onClick={onNew}><Plus /> Adicionar reserva</button>
  </section>
}

function Properties({ properties, onSaveProperty, reservations, setView }) {
  const blank = { name:'', address:'', image:'', photoFile:null, photoPath:null, color:'#B98A5A' }
  const [editor,setEditor]=useState(null)
  const [selected,setSelected]=useState(null)
  const [detailView,setDetailView]=useState('details')
  const [form,setForm]=useState(blank)
  const [saving,setSaving]=useState(false)
  const openNew=()=>{setForm(blank);setEditor('new')}
  const openEdit=p=>{setForm({name:p.name,address:p.address,image:p.image,photoFile:null,photoPath:p.photoPath,color:p.color});setSelected(null);setEditor(p.id)}
  const choosePhoto=e=>{const file=e.target.files?.[0];if(!file)return;setForm(v=>({...v,photoFile:file,image:URL.createObjectURL(file)}))}
  const save=async e=>{e.preventDefault();setSaving(true);try{await onSaveProperty({...form,id:editor==='new'?null:editor});setEditor(null);setForm(blank)}finally{setSaving(false)}}
  const openProperty=p=>{setSelected(p);setDetailView('details')}
  const gains = useMemo(()=>{
    if(!selected)return []
    const values={}
    reservations.filter(r=>r.propertyId===selected.id).forEach(r=>{const date=parseISO(r.checkin);const key=format(date,'yyyy-MM');values[key]=(values[key]||0)+Number(r.value)})
    return Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,value,label:format(parseISO(`${key}-01`),'MMMM yyyy',{locale:ptBR})}))
  },[selected,reservations])
  const totalGains=gains.reduce((sum,item)=>sum+item.value,0)
  return <>
    <section className="property-list-head"><div><p className="eyebrow">Seu portfólio</p><h2>Imóveis sob gestão</h2><p>Cadastre unidades e acompanhe a performance individual.</p></div><button className="primary" onClick={openNew}><Plus /> Novo imóvel</button></section>
    <section className="accordion-properties">{properties.map((p,i)=><article key={p.id} onClick={()=>openProperty(p)} style={{'--bg':`url(${p.image})`}} tabIndex="0" role="button" aria-label={`Abrir detalhes de ${p.name}`}><div className="accordion-overlay"/><span>0{i+1}</span><div><small>{p.address}</small><h3>{p.name}</h3><p>{p.status} · clique para ver detalhes</p></div></article>)}</section>
    {editor&&<div className="modal-backdrop"><form className="modal property-form" onSubmit={save}><button type="button" className="modal-close" onClick={()=>setEditor(null)}><X /></button><p className="eyebrow">{editor==='new'?'Novo endereço':'Atualizar imóvel'}</p><h2>{editor==='new'?'Cadastrar imóvel':'Editar imóvel'}</h2><div className="property-fields"><label>Nome do imóvel<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Loft Ipanema" /></label><label>Endereço<input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Rua, número, bairro e cidade" /></label><label className="upload-field"><span>Foto do imóvel</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto}/><div className="upload-box">{form.image?<img src={form.image} alt="Prévia do imóvel"/>:<><Camera/><strong>Selecionar foto</strong><small>JPG, PNG ou WebP</small></>}</div></label></div><button className="primary full" disabled={saving}>{saving?'Salvando…':editor==='new'?'Salvar imóvel':'Salvar alterações'}</button></form></div>}
    {selected&&<div className="modal-backdrop"><section className="modal property-detail"><button type="button" className="modal-close" onClick={()=>setSelected(null)}><X /></button>{detailView==='details'?<><div className="detail-photo"><img src={selected.image} alt={selected.name}/><span style={{background:selected.color}}>Ativo</span></div><p className="eyebrow">Detalhes do imóvel</p><h2>{selected.name}</h2><p className="detail-address">{selected.address}</p><div className="detail-actions"><button className="primary" onClick={()=>{setSelected(null);setView('calendar')}}><CalendarBlank/> Ver agenda</button><button className="secondary" onClick={()=>openEdit(selected)}><PencilSimple/> Editar imóvel</button><button className="secondary" onClick={()=>setDetailView('gains')}><ChartLineUp/> Ver ganhos</button></div></>:<><button className="back-button" onClick={()=>setDetailView('details')}><ArrowLeft/> Voltar ao imóvel</button><p className="eyebrow">Histórico financeiro</p><h2>Ganhos de {selected.short}</h2><div className="gains-total"><span>Total geral</span><strong>{money.format(totalGains)}</strong></div><div className="gains-list">{gains.length?gains.map(item=><div key={item.key}><span>{item.label}</span><i style={{width:`${Math.max(12,(item.value/Math.max(...gains.map(g=>g.value)))*100)}%`}}/><strong>{money.format(item.value)}</strong></div>):<p className="empty-state">Ainda não há reservas com ganhos para este imóvel.</p>}</div></>}</section></div>}
  </>
}

function ReservationModal({ properties, reservation, onClose, onSave }) {
  const isEditing = Boolean(reservation)
  const localDateTime = value => value ? format(parseISO(value), "yyyy-MM-dd'T'HH:mm") : ''
  const [form,setForm]=useState(reservation ? {
    id: reservation.id,
    propertyId: reservation.propertyId,
    guest: reservation.guest,
    others: reservation.others,
    value: reservation.value,
    checkin: localDateTime(reservation.checkin),
    checkout: localDateTime(reservation.checkout),
    phone: reservation.phone,
    status: reservation.status,
  } : {propertyId:properties[0].id,guest:'',others:'',value:'',checkin:'',checkout:'',phone:'',status:'Confirmada'})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const update=e=>setForm({...form,[e.target.name]:e.target.value})
  const submit=async e=>{e.preventDefault();setError('');if(new Date(form.checkout)<=new Date(form.checkin)){setError('O check-out precisa ocorrer depois do check-in.');return}setSaving(true);try{await onSave({...form,value:Number(form.value)})}catch{setError('Revise os dados e tente novamente.')}finally{setSaving(false)}}
  return <div className="modal-backdrop"><form className="modal reservation-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X /></button><p className="eyebrow">{isEditing?'Ajustar hospedagem':'Nova hospedagem'}</p><h2>{isEditing?'Editar reserva':'Cadastrar reserva'}</h2><div className="form-grid"><label className="wide">Imóvel<select name="propertyId" value={form.propertyId} onChange={update}>{properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Hóspede principal<input required name="guest" value={form.guest} onChange={update} placeholder="Nome completo" /></label><label>Celular<input name="phone" value={form.phone} onChange={update} placeholder="(00) 00000-0000" /></label><label className="wide">Demais hóspedes<input name="others" value={form.others} onChange={update} placeholder="Separe os nomes por vírgula" /></label><label>Check-in<input required type="datetime-local" name="checkin" value={form.checkin} onChange={update} /></label><label>Check-out<input required type="datetime-local" name="checkout" value={form.checkout} onChange={update} /></label><label>Valor da estadia<input required min="0" step="0.01" type="number" name="value" value={form.value} onChange={update} placeholder="R$ 0,00" /></label><label>Status<select name="status" value={form.status} onChange={update}>{['Pendente','Confirmada','Check-in','Check-out','Cancelada'].map(item=><option key={item}>{item}</option>)}</select></label></div>{error&&<p className="form-error"><WarningCircle />{error}</p>}<button className="primary full" disabled={saving}>{saving?'Salvando…':isEditing?'Salvar alterações':'Confirmar e enviar alertas'} {!saving&&<ArrowRight />}</button></form></div>
}

export default function App() {
  const [session,setSession]=useState(null)
  const [authReady,setAuthReady]=useState(false)
  const [loading,setLoading]=useState(false)
  const [organizationId,setOrganizationId]=useState(null)
  const [view,setView]=useState('dashboard')
  const [properties,setProperties]=useState([])
  const [reservations,setReservations]=useState([])
  const [modal,setModal]=useState(null)
  const [toast,setToast]=useState('')
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);setAuthReady(true)})
    return ()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{
    if(!session){setProperties([]);setReservations([]);setOrganizationId(null);return}
    setLoading(true)
    loadPortfolio().then(data=>{setOrganizationId(data.organizationId);setProperties(data.properties);setReservations(data.reservations)}).catch(error=>setToast(error.message)).finally(()=>setLoading(false))
  },[session])
  const titles={dashboard:'Visão geral',calendar:'Calendário de ocupação',reservations:'Reservas',properties:'Imóveis'}
  const showToast=message=>{setToast(message);window.setTimeout(()=>setToast(''),5000)}
  const login=async(login,password)=>{if(login.trim().toLowerCase()!=='airbnb')throw new Error('Credenciais inválidas');const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password});if(error)throw error}
  const save=async form=>{if(form.id){try{const reservation=await updateReservation({organizationId,form});setReservations(current=>current.map(item=>item.id===reservation.id?reservation:item).sort((a,b)=>a.checkin.localeCompare(b.checkin)));setModal(null);showToast('Reserva atualizada com sucesso.');return}catch(error){showToast(error.message.includes('overlap')?'Este imóvel já possui outra reserva nessas datas.':`Não foi possível atualizar a reserva: ${error.message}`);throw error}}let reservation;try{reservation=await saveReservation({organizationId,form});setReservations(v=>[...v,reservation].sort((a,b)=>a.checkin.localeCompare(b.checkin)));setModal(null)}catch(error){showToast(error.message.includes('overlap')?'Este imóvel já possui outra reserva nessas datas.':`Não foi possível salvar a reserva: ${error.message}`);throw error}showToast('Reserva salva. Enviando alertas…');try{const {error}=await supabase.functions.invoke('reservation-alert',{body:{reservation_id:Number(reservation.id)}});if(error)throw error;showToast('Reserva salva e alertas enviados para Sandro e Joana.')}catch{showToast('Reserva salva. O alerta será ativado após configurar o segredo da Resend.') }}
  const savePropertyRecord=async form=>{try{const property=await saveProperty({organizationId,id:form.id,name:form.name,address:form.address,color:form.color,photoFile:form.photoFile,currentPhotoPath:form.photoPath});setProperties(current=>form.id?current.map(item=>item.id===property.id?property:item):[...current,property]);showToast('Imóvel salvo com sucesso.')}catch(error){showToast(`Não foi possível salvar o imóvel: ${error.message}`);throw error}}
  if(!authReady)return <main className="login-page"><section className="login-panel"><p className="muted">Validando acesso seguro…</p></section></main>
  if(!session)return <Login onLogin={login} />
  if(loading)return <main className="login-page"><section className="login-panel"><p className="muted">Carregando sua operação…</p></section></main>
  return <main className="app-shell overflow-x-hidden w-full max-w-full"><Sidebar view={view} setView={setView} logout={()=>supabase.auth.signOut()}/><div className="workspace"><Topbar title={titles[view]} onNew={()=>setModal('new')}/><div className="content">{view==='dashboard'&&<Dashboard reservations={reservations} properties={properties} setView={setView} onNew={()=>setModal('new')}/>} {view==='calendar'&&<CalendarView reservations={reservations} properties={properties} onNew={()=>setModal('new')}/>} {view==='reservations'&&<Reservations reservations={reservations} properties={properties} onNew={()=>setModal('new')} onEdit={setModal}/>} {view==='properties'&&<Properties properties={properties} onSaveProperty={savePropertyRecord} reservations={reservations} setView={setView}/>}</div><footer><strong>morada</strong><span>Gestão feita para receber bem.</span><small>Operação de Sandro & Joana</small></footer></div>{modal&&properties.length>0&&<ReservationModal properties={properties} reservation={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={save}/>} {toast&&<div className="toast"><Check weight="bold" />{toast}</div>}</main>
}
