import { useEffect, useMemo, useRef, useState } from 'react'
import AnalyticsDashboard from './AnalyticsDashboard'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Buildings, CalendarBlank, Camera, CaretDown, ChartLineUp, Check, Clock, CurrencyDollar, Funnel, HouseLine, List, LockKey, MagnifyingGlass, PencilSimple, Plus, Receipt, SignOut, Wallet, WarningCircle, X } from '@phosphor-icons/react'
import { deleteExpenseOverride, loadPortfolio, loginEmail, saveCashIncome, saveExpense, saveExpenseOverride, saveProperty, saveReservation, supabase, updateReservation } from './lib/supabase'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const Dashboard = AnalyticsDashboard

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
  const items = [['dashboard', ChartLineUp, 'Visão geral'], ['calendar', CalendarBlank, 'Calendário'], ['reservations', List, 'Reservas'], ['properties', Buildings, 'Imóveis'], ['finances', Wallet, 'Finanças Pessoais']]
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><HouseLine weight="fill" /></span><strong>morada</strong></div>
    <nav>{items.map(([id, Icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon />{label}</button>)}</nav>
    <div className="sidebar-foot"><div className="avatars"><span>SA</span><span>JM</span><div><strong>Sandro & Joana</strong><small>Administradores</small></div></div><button className="icon-button" onClick={logout} title="Sair"><SignOut /></button></div>
  </aside>
}

function Topbar({ title, onNew, actionLabel = 'Nova reserva', secondaryAction, secondaryLabel }) {
  return <header className="topbar"><div><p>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p><h1>{title}</h1></div><div className="topbar-actions">{secondaryAction && <button className="secondary income-action" onClick={secondaryAction}><ArrowUp weight="bold" /> {secondaryLabel}</button>}<button className="primary" onClick={onNew}><Plus weight="bold" /> {actionLabel}</button></div></header>
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

function Finances({ reservations, properties, expenses, adjustments, expenseOverrides, onNewExpense, onNewIncome, onEditExpense }) {
  const [mode, setMode] = useState('daily')
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()))
  const propertyById = useMemo(() => new Map(properties.map(property => [property.id, property])), [properties])
  const overrideByExpenseMonth = useMemo(() => new Map(expenseOverrides.map(override => [`${override.expenseId}-${override.month}`, override])), [expenseOverrides])
  const isFinancialReservation = reservation => Number(reservation.value) > 0
    && (reservation.status !== 'Cancelada' || /valor recebido/i.test(reservation.notes))
  const isPaidReservation = reservation => ['Check-in', 'Check-out'].includes(reservation.status)
    || (reservation.status === 'Cancelada' && /valor recebido/i.test(reservation.notes))
  const monthNumber = date => date.getFullYear() * 12 + date.getMonth()
  const movementsForMonth = date => {
    const year = date.getFullYear(), month = date.getMonth()
    const income = reservations.filter(isFinancialReservation).map(reservation => ({
      id: `income-${reservation.id}`,
      date: parseISO(reservation.checkin),
      type: 'income',
      description: `Reserva · ${reservation.guest}`,
      detail: `${propertyById.get(reservation.propertyId)?.short || 'Imóvel'} · ${isPaidReservation(reservation) ? 'Receita paga' : 'Receita prevista'}`,
      amount: Number(reservation.value),
      projected: !isPaidReservation(reservation),
      sortOrder: 2,
    })).filter(item => item.date.getFullYear() === year && item.date.getMonth() === month)
    const outgoing = expenses.filter(expense => expense.active).flatMap(expense => {
      const startsAt = parseISO(expense.incurredOn)
      if (expense.expenseType === 'one_time') {
        return startsAt.getFullYear() === year && startsAt.getMonth() === month
          ? [{ id: `expense-${expense.id}`, date: startsAt, type: 'expense', description: expense.description, detail: 'Despesa pontual', amount: expense.amount, sortOrder: 1 }]
          : []
      }
      if (monthNumber(date) < monthNumber(startsAt)) return []
      const lastDay = new Date(year, month + 1, 0).getDate()
      const occurrence = new Date(year, month, Math.min(expense.recurrenceDay, lastDay))
      const monthKey = format(date, 'yyyy-MM')
      const override = overrideByExpenseMonth.get(`${expense.id}-${monthKey}`)
      return [{ id: `expense-${expense.id}-${year}-${month}`, date: occurrence, type: 'expense', description: expense.description, detail: override ? `Valor ajustado neste mês · base ${money.format(expense.amount)}` : `Recorrente · todo dia ${String(expense.recurrenceDay).padStart(2, '0')}`, amount: override?.amount ?? expense.amount, sortOrder: 1, expense, override, month: monthKey }]
    })
    const extraordinary = adjustments.map(adjustment => ({
      id: `adjustment-${adjustment.id}`,
      date: parseISO(adjustment.occurredAt),
      type: adjustment.entryType,
      description: adjustment.description,
      detail: adjustment.sourceKey === 'opening-adjustment-2026-09-03' ? 'Entrada extraordinária · conciliação bancária' : adjustment.entryType === 'income' ? 'Receita pontual' : 'Despesa pontual',
      amount: adjustment.amount,
      sortOrder: 0,
    })).filter(item => item.date.getFullYear() === year && item.date.getMonth() === month)
    return [...extraordinary, ...outgoing, ...income].sort((a, b) => a.date - b.date || a.sortOrder - b.sortOrder)
  }
  const totals = movements => movements.reduce((result, item) => ({ ...result, [item.type]: result[item.type] + item.amount }), { income: 0, expense: 0 })
  const cashFlowStart = useMemo(() => {
    const startDates = expenses.filter(expense => expense.active).map(expense => parseISO(expense.incurredOn).getTime())
    return startDates.length ? startOfMonth(new Date(Math.min(...startDates))) : startOfMonth(new Date())
  }, [expenses])
  const openingBalanceForMonth = date => {
    if (monthNumber(date) <= monthNumber(cashFlowStart)) return 0
    let cursor = cashFlowStart
    let balance = 0
    while (monthNumber(cursor) < monthNumber(date)) {
      const monthTotals = totals(movementsForMonth(cursor))
      balance += monthTotals.income - monthTotals.expense
      cursor = addMonths(cursor, 1)
    }
    return balance
  }
  const selectedMovements = useMemo(() => movementsForMonth(anchor), [adjustments, anchor, expenses, overrideByExpenseMonth, propertyById, reservations])
  const selectedTotals = totals(selectedMovements)
  const openingBalance = useMemo(() => openingBalanceForMonth(anchor), [adjustments, anchor, cashFlowStart, expenses, overrideByExpenseMonth, propertyById, reservations])
  const closingBalance = openingBalance + selectedTotals.income - selectedTotals.expense
  const runningBalances = useMemo(() => {
    let balance = openingBalance
    return selectedMovements.reduce((balances, item) => {
      balance += item.type === 'income' ? item.amount : -item.amount
      balances.set(item.id, balance)
      return balances
    }, new Map())
  }, [openingBalance, selectedMovements])
  const yearMonths = useMemo(() => {
    let balance = openingBalanceForMonth(new Date(anchor.getFullYear(), 0, 1))
    return Array.from({ length: 12 }, (_, month) => {
      const date = new Date(anchor.getFullYear(), month, 1)
      const monthMovements = movementsForMonth(date)
      const monthTotals = totals(monthMovements)
      if (monthNumber(date) < monthNumber(cashFlowStart)) return { date, ...monthTotals, balance: monthTotals.income - monthTotals.expense }
      if (monthNumber(date) === monthNumber(cashFlowStart)) balance = 0
      balance += monthTotals.income - monthTotals.expense
      return { date, ...monthTotals, balance }
    })
  }, [adjustments, anchor.getFullYear(), cashFlowStart, expenses, overrideByExpenseMonth, propertyById, reservations])
  const maxMonthlyValue = Math.max(...yearMonths.flatMap(item => [item.income, item.expense]), 1)
  const recurringTotal = expenses.filter(expense => expense.active && expense.expenseType === 'recurring').reduce((sum, expense) => sum + expense.amount, 0)
  const goPrevious = () => setAnchor(current => mode === 'daily' ? subMonths(current, 1) : new Date(current.getFullYear() - 1, current.getMonth(), 1))
  const goNext = () => setAnchor(current => mode === 'daily' ? addMonths(current, 1) : new Date(current.getFullYear() + 1, current.getMonth(), 1))
  const periodLabel = mode === 'daily' ? format(anchor, 'MMMM yyyy', { locale: ptBR }) : String(anchor.getFullYear())

  return <section className="finances-page">
    <div className="finance-hero">
      <div><p className="eyebrow">Fluxo de caixa pessoal</p><h2>Saiba o que entra.<br/><span>Antes de gastar.</span></h2><p>Reservas e compromissos financeiros reunidos em uma linha do tempo única.</p></div>
      <div className="finance-fixed"><span>Compromissos recorrentes / mês</span><strong>{money.format(recurringTotal)}</strong><small>{expenses.filter(expense => expense.active && expense.expenseType === 'recurring').length} despesas ativas</small></div>
    </div>
    <div className="finance-toolbar">
      <div className="period-switch" aria-label="Alternar visão do fluxo de caixa"><button className={mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')}>Visão diária</button><button className={mode === 'monthly' ? 'active' : ''} onClick={() => setMode('monthly')}>Visão mensal</button></div>
      <div className="finance-period"><button className="icon-button" onClick={goPrevious} aria-label="Período anterior"><ArrowLeft /></button><strong>{periodLabel}</strong><button className="icon-button" onClick={goNext} aria-label="Próximo período"><ArrowRight /></button></div>
    </div>
    {mode === 'daily' ? <>
      <div className="finance-metrics">
        <article><span><ArrowUp /> Entradas</span><strong>{money.format(selectedTotals.income)}</strong><small>Receitas pagas e previstas</small></article>
        <article><span><ArrowDown /> Saídas</span><strong>{money.format(selectedTotals.expense)}</strong><small>Pontuais e recorrentes</small></article>
        <article className={closingBalance < 0 ? 'negative' : ''}><span><Wallet /> Saldo projetado</span><strong>{money.format(closingBalance)}</strong><small>Saldo inicial + movimentações</small></article>
      </div>
      <div className="cash-ledger">
        <div className="cash-ledger-head"><div><p className="eyebrow">Agenda financeira</p><h3>Movimentações de {format(anchor, 'MMMM', { locale: ptBR })}</h3></div><div className="ledger-actions"><button className="secondary income-action" onClick={onNewIncome}><ArrowUp /> Registrar receita</button><button className="secondary" onClick={onNewExpense}><Plus /> Registrar despesa</button></div></div>
        <div className="ledger-opening"><span>{monthNumber(anchor) === monthNumber(cashFlowStart) ? 'Saldo inicial do controle' : `Saldo trazido de ${format(subMonths(anchor, 1), 'MMMM', { locale: ptBR })}`}</span><strong className={openingBalance < 0 ? 'negative' : ''}>{money.format(openingBalance)}</strong></div>
        {selectedMovements.length ? <><div className="movement-columns"><span>Movimentação</span><span>Saldo da conta</span></div><div className="movement-list">{selectedMovements.map(item => { const runningBalance = runningBalances.get(item.id); return <div className={`movement-row ${item.override ? 'has-override' : ''}`} key={item.id}><time dateTime={format(item.date, 'yyyy-MM-dd')}><b>{format(item.date, 'dd')}</b><span>{format(item.date, 'EEE', { locale: ptBR })}</span></time><i className={item.type}><span>{item.type === 'income' ? <ArrowUp /> : <ArrowDown />}</span></i><div><strong>{item.description}</strong><small>{item.detail}</small>{item.expense && <button type="button" className="adjust-expense" onClick={() => onEditExpense({ expense: item.expense, month: item.month, override: item.override })}><PencilSimple /> {item.override ? 'Editar ajuste' : 'Ajustar mês'}</button>}</div><b className={`movement-amount ${item.type}`}>{item.type === 'income' ? '+' : '−'} {money.format(item.amount)}</b><b className={`running-balance ${runningBalance < 0 ? 'negative' : 'positive'}`}>{money.format(runningBalance)}</b></div>})}</div></> : <p className="empty-state">Nenhuma movimentação prevista para este mês.</p>}
      </div>
    </> : <div className="monthly-flow">
      <div className="monthly-flow-head"><div><p className="eyebrow">Ano completo</p><h3>Entradas e saídas mês a mês</h3></div><div className="flow-legend"><span><i className="income"/>Entradas</span><span><i className="expense"/>Saídas</span></div></div>
      <div className="flow-chart">{yearMonths.map(item => { const monthLabel = format(item.date, 'MMMM', { locale: ptBR }); return <div className="flow-month" key={item.date.toISOString()}><div className="flow-values"><button type="button" className={`flow-bar income ${item.income ? '' : 'zero'}`} style={{ height: `${Math.max(item.income ? 4 : 2, item.income / maxMonthlyValue * 100)}%` }} aria-label={`Entradas de ${monthLabel}: ${money.format(item.income)}`}><span className="flow-tooltip"><small>Entradas</small><strong>{money.format(item.income)}</strong></span></button><button type="button" className={`flow-bar expense ${item.expense ? '' : 'zero'}`} style={{ height: `${Math.max(item.expense ? 4 : 2, item.expense / maxMonthlyValue * 100)}%` }} aria-label={`Saídas de ${monthLabel}: ${money.format(item.expense)}`}><span className="flow-tooltip"><small>Saídas</small><strong>{money.format(item.expense)}</strong></span></button></div><b>{format(item.date, 'MMM', { locale: ptBR })}</b><small className={item.balance < 0 ? 'negative' : ''}>{money.format(item.balance)}</small></div> })}</div>
    </div>}
    <div className="expense-register">
      <div><p className="eyebrow">Despesas cadastradas</p><h3>Seus compromissos</h3><p>As recorrências são projetadas automaticamente em todos os meses.</p></div>
      <div className="expense-register-list">{expenses.map(expense => <div key={expense.id}><span className="expense-icon"><Receipt /></span><div><strong>{expense.description}</strong><small>{expense.expenseType === 'recurring' ? `Recorrente · dia ${String(expense.recurrenceDay).padStart(2, '0')}` : `Pontual · ${format(parseISO(expense.incurredOn), 'dd/MM/yyyy')}`}</small></div><b>{money.format(expense.amount)}</b></div>)}</div>
    </div>
  </section>
}

function ExpenseOverrideModal({ edit, overrides, onClose, onSave, onReset }) {
  const findOverride = month => overrides.find(override => override.expenseId === edit.expense.id && override.month === month)
  const [month, setMonth] = useState(edit.month)
  const [amount, setAmount] = useState(String(edit.override?.amount ?? edit.expense.amount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const activeOverride = findOverride(month)
  const changeMonth = event => {
    const nextMonth = event.target.value
    setMonth(nextMonth)
    setAmount(String(findOverride(nextMonth)?.amount ?? edit.expense.amount))
  }
  const submit = async event => {
    event.preventDefault()
    setError('')
    if (Number(amount) < 0) { setError('O valor previsto não pode ser negativo.'); return }
    setSaving(true)
    try { await onSave({ expenseId: edit.expense.id, month, amount: Number(amount) }) } catch { setError('Não foi possível salvar o ajuste mensal.') } finally { setSaving(false) }
  }
  const reset = async () => {
    setSaving(true)
    setError('')
    try { await onReset({ expenseId: edit.expense.id, month }) } catch { setError('Não foi possível restaurar o valor recorrente.') } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal override-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X /></button><p className="eyebrow">Exceção mensal</p><h2>Ajustar previsão</h2><div className="override-expense-summary"><span>{edit.expense.description}</span><strong>{money.format(edit.expense.amount)}</strong><small>Valor recorrente padrão</small></div><div className="form-grid"><label>Mês do ajuste<input required type="month" value={month} onChange={changeMonth} /></label><label>Valor previsto neste mês<input required min="0" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} /></label></div><p className="override-help">A alteração vale somente para {format(parseISO(`${month}-01`), 'MMMM \'de\' yyyy', { locale: ptBR })}. Nos outros meses, permanece {money.format(edit.expense.amount)}.</p>{error && <p className="form-error"><WarningCircle />{error}</p>}<div className="override-actions">{activeOverride && <button type="button" className="secondary" onClick={reset} disabled={saving}>Restaurar recorrência</button>}<button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar ajuste'} {!saving && <ArrowRight />}</button></div></form></div>
}

function ExpenseModal({ onClose, onSave }) {
  const [form, setForm] = useState({ description: '', amount: '', expenseType: 'recurring', recurrenceDay: '1', incurredOn: format(new Date(), 'yyyy-MM-dd'), startMonth: format(new Date(), 'yyyy-MM') })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async event => {
    event.preventDefault()
    setError('')
    if (Number(form.amount) <= 0) { setError('Informe um valor maior que zero.'); return }
    setSaving(true)
    try { await onSave(form) } catch { setError('Não foi possível salvar a despesa. Revise os dados e tente novamente.') } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal expense-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X /></button><p className="eyebrow">Nova saída</p><h2>Registrar despesa</h2><div className="form-grid"><label className="wide">Natureza da despesa<input required name="description" value={form.description} onChange={update} placeholder="Ex.: Plano de saúde" /></label><label>Valor<input required min="0.01" step="0.01" type="number" name="amount" value={form.amount} onChange={update} placeholder="R$ 0,00" /></label><label>Tipo<select name="expenseType" value={form.expenseType} onChange={update}><option value="recurring">Recorrente</option><option value="one_time">Pontual</option></select></label>{form.expenseType === 'recurring' ? <><label>Dia da recorrência<select name="recurrenceDay" value={form.recurrenceDay} onChange={update}>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>Todo dia {String(index + 1).padStart(2, '0')}</option>)}</select></label><label>Começa em<input required type="month" name="startMonth" value={form.startMonth} onChange={update} /></label></> : <label className="wide">Data da despesa<input required type="date" name="incurredOn" value={form.incurredOn} onChange={update} /></label>}</div>{error && <p className="form-error"><WarningCircle />{error}</p>}<button className="primary full" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar ao fluxo de caixa'} {!saving && <ArrowRight />}</button></form></div>
}

function IncomeModal({ onClose, onSave }) {
  const [form, setForm] = useState({ description: '', amount: '', occurredOn: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async event => {
    event.preventDefault()
    setError('')
    if (Number(form.amount) <= 0) { setError('Informe um valor maior que zero.'); return }
    setSaving(true)
    try { await onSave(form) } catch { setError('Não foi possível salvar a receita. Revise os dados e tente novamente.') } finally { setSaving(false) }
  }
  return <div className="modal-backdrop"><form className="modal income-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X /></button><p className="eyebrow">Nova entrada</p><h2>Registrar receita</h2><div className="income-modal-intro"><span><ArrowUp weight="bold" /></span><p>Esta receita entra no saldo da conta na data informada, junto com os recebimentos das reservas.</p></div><div className="form-grid"><label className="wide">Descrição da receita<input required name="description" value={form.description} onChange={update} placeholder="Ex.: Reembolso ou trabalho pontual" /></label><label>Valor<input required min="0.01" step="0.01" type="number" name="amount" value={form.amount} onChange={update} placeholder="R$ 0,00" /></label><label>Data da entrada<input required type="date" name="occurredOn" value={form.occurredOn} onChange={update} /></label><label className="wide">Observação (opcional)<input name="notes" value={form.notes} onChange={update} placeholder="Inclua um detalhe para lembrar a origem" /></label></div>{error && <p className="form-error"><WarningCircle />{error}</p>}<button className="primary income-primary full" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar receita ao fluxo'} {!saving && <ArrowRight />}</button></form></div>
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
  const [expenses,setExpenses]=useState([])
  const [adjustments,setAdjustments]=useState([])
  const [expenseOverrides,setExpenseOverrides]=useState([])
  const [modal,setModal]=useState(null)
  const [expenseModal,setExpenseModal]=useState(false)
  const [incomeModal,setIncomeModal]=useState(false)
  const [overrideModal,setOverrideModal]=useState(null)
  const [toast,setToast]=useState('')
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);setAuthReady(true)})
    return ()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{
    if(!session){setProperties([]);setReservations([]);setExpenses([]);setAdjustments([]);setExpenseOverrides([]);setOrganizationId(null);return}
    setLoading(true)
    loadPortfolio().then(data=>{setOrganizationId(data.organizationId);setProperties(data.properties);setReservations(data.reservations);setExpenses(data.expenses);setAdjustments(data.adjustments);setExpenseOverrides(data.expenseOverrides)}).catch(error=>setToast(error.message)).finally(()=>setLoading(false))
  },[session])
  const titles={dashboard:'Visão geral',calendar:'Calendário de ocupação',reservations:'Reservas',properties:'Imóveis',finances:'Finanças pessoais'}
  const showToast=message=>{setToast(message);window.setTimeout(()=>setToast(''),5000)}
  const login=async(login,password)=>{if(login.trim().toLowerCase()!=='airbnb')throw new Error('Credenciais inválidas');const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password});if(error)throw error}
  const save=async form=>{if(form.id){try{const reservation=await updateReservation({organizationId,form});setReservations(current=>current.map(item=>item.id===reservation.id?reservation:item).sort((a,b)=>a.checkin.localeCompare(b.checkin)));setModal(null);showToast('Reserva atualizada com sucesso.');return}catch(error){showToast(error.message.includes('overlap')?'Este imóvel já possui outra reserva nessas datas.':`Não foi possível atualizar a reserva: ${error.message}`);throw error}}let reservation;try{reservation=await saveReservation({organizationId,form});setReservations(v=>[...v,reservation].sort((a,b)=>a.checkin.localeCompare(b.checkin)));setModal(null)}catch(error){showToast(error.message.includes('overlap')?'Este imóvel já possui outra reserva nessas datas.':`Não foi possível salvar a reserva: ${error.message}`);throw error}showToast('Reserva salva. Enviando alertas…');try{const {error}=await supabase.functions.invoke('reservation-alert',{body:{reservation_id:Number(reservation.id)}});if(error)throw error;showToast('Reserva salva e alertas enviados para Sandro e Joana.')}catch{showToast('Reserva salva. O alerta será ativado após configurar o segredo da Resend.') }}
  const savePropertyRecord=async form=>{try{const property=await saveProperty({organizationId,id:form.id,name:form.name,address:form.address,color:form.color,photoFile:form.photoFile,currentPhotoPath:form.photoPath});setProperties(current=>form.id?current.map(item=>item.id===property.id?property:item):[...current,property]);showToast('Imóvel salvo com sucesso.')}catch(error){showToast(`Não foi possível salvar o imóvel: ${error.message}`);throw error}}
  const saveExpenseRecord=async form=>{try{const expense=await saveExpense({organizationId,form});setExpenses(current=>[...current,expense].sort((a,b)=>a.incurredOn.localeCompare(b.incurredOn)));setExpenseModal(false);showToast('Despesa adicionada ao fluxo de caixa.')}catch(error){showToast(`Não foi possível salvar a despesa: ${error.message}`);throw error}}
  const saveIncomeRecord=async form=>{try{const income=await saveCashIncome({organizationId,form});setAdjustments(current=>[...current,income].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)));setIncomeModal(false);showToast('Receita adicionada ao fluxo de caixa.')}catch(error){showToast(`Não foi possível salvar a receita: ${error.message}`);throw error}}
  const saveOverrideRecord=async form=>{try{const override=await saveExpenseOverride({organizationId,...form});setExpenseOverrides(current=>[...current.filter(item=>!(item.expenseId===override.expenseId&&item.month===override.month)),override]);setOverrideModal(null);showToast('Previsão mensal ajustada sem alterar a recorrência.')}catch(error){showToast(`Não foi possível ajustar a previsão: ${error.message}`);throw error}}
  const resetOverrideRecord=async form=>{try{await deleteExpenseOverride({organizationId,...form});setExpenseOverrides(current=>current.filter(item=>!(item.expenseId===form.expenseId&&item.month===form.month)));setOverrideModal(null);showToast('Valor recorrente restaurado para este mês.')}catch(error){showToast(`Não foi possível restaurar a recorrência: ${error.message}`);throw error}}
  if(!authReady)return <main className="login-page"><section className="login-panel"><p className="muted">Validando acesso seguro…</p></section></main>
  if(!session)return <Login onLogin={login} />
  if(loading)return <main className="login-page"><section className="login-panel"><p className="muted">Carregando sua operação…</p></section></main>
  const newAction = view === 'finances' ? () => setExpenseModal(true) : () => setModal('new')
  return <main className="app-shell overflow-x-hidden w-full max-w-full"><Sidebar view={view} setView={setView} logout={()=>supabase.auth.signOut()}/><div className="workspace"><Topbar title={titles[view]} onNew={newAction} actionLabel={view === 'finances' ? 'Nova despesa' : 'Nova reserva'} secondaryAction={view === 'finances' ? () => setIncomeModal(true) : null} secondaryLabel="Nova receita"/><div className="content">{view==='dashboard'&&<Dashboard reservations={reservations} properties={properties} setView={setView} onNew={()=>setModal('new')}/>} {view==='calendar'&&<CalendarView reservations={reservations} properties={properties} onNew={()=>setModal('new')}/>} {view==='reservations'&&<Reservations reservations={reservations} properties={properties} onNew={()=>setModal('new')} onEdit={setModal}/>} {view==='properties'&&<Properties properties={properties} onSaveProperty={savePropertyRecord} reservations={reservations} setView={setView}/>} {view==='finances'&&<Finances reservations={reservations} properties={properties} expenses={expenses} adjustments={adjustments} expenseOverrides={expenseOverrides} onNewExpense={()=>setExpenseModal(true)} onNewIncome={()=>setIncomeModal(true)} onEditExpense={setOverrideModal}/>}</div><footer><strong>morada</strong><span>Gestão feita para receber bem.</span><small>Operação de Sandro & Joana</small></footer></div>{modal&&properties.length>0&&<ReservationModal properties={properties} reservation={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={save}/>} {expenseModal&&<ExpenseModal onClose={()=>setExpenseModal(false)} onSave={saveExpenseRecord}/>} {incomeModal&&<IncomeModal onClose={()=>setIncomeModal(false)} onSave={saveIncomeRecord}/>} {overrideModal&&<ExpenseOverrideModal edit={overrideModal} overrides={expenseOverrides} onClose={()=>setOverrideModal(null)} onSave={saveOverrideRecord} onReset={resetOverrideRecord}/>} {toast&&<div className="toast"><Check weight="bold" />{toast}</div>}</main>
}
