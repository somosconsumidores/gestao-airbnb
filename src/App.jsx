import { useEffect, useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, Buildings, CalendarBlank, Camera, CaretDown, ChartLineUp, Check, Clock, CurrencyDollar, HouseLine, List, LockKey, PencilSimple, Plus, SignOut, WarningCircle, X } from '@phosphor-icons/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const propertiesSeed = [
  { id: 'ataulfo', name: 'Apt Ataulfo de Paiva', short: 'Ataulfo', color: '#E65C00', address: 'Leblon, Rio de Janeiro', status: 'Ativo', image: 'https://picsum.photos/seed/ataulfo-apartment/1200/900' },
  { id: 'bartolomeu', name: 'Apt Bartolomeu Mitre', short: 'Bartolomeu', color: '#2F6B5F', address: 'Leblon, Rio de Janeiro', status: 'Ativo', image: 'https://picsum.photos/seed/bartolomeu-interior/1200/900' },
  { id: 'gavea', name: 'Studio Gávea', short: 'Gávea', color: '#7C5C9E', address: 'Gávea, Rio de Janeiro', status: 'Ativo', image: 'https://picsum.photos/seed/gavea-studio/1200/900' }
]

const reservationsSeed = [
  { id: 1, propertyId: 'ataulfo', guest: 'Marina Costa', others: 'Paulo Costa', checkin: '2026-09-03T15:00', checkout: '2026-09-08T11:00', value: 4250, phone: '(11) 98765-2231', status: 'Confirmada' },
  { id: 2, propertyId: 'bartolomeu', guest: 'Ricardo Nunes', others: '', checkin: '2026-09-06T14:00', checkout: '2026-09-11T11:00', value: 5100, phone: '(21) 99618-0932', status: 'Confirmada' },
  { id: 3, propertyId: 'gavea', guest: 'Laura Almeida', others: 'Beatriz Almeida, Caio Luz', checkin: '2026-09-14T15:00', checkout: '2026-09-18T10:00', value: 3200, phone: '', status: 'Confirmada' },
  { id: 4, propertyId: 'ataulfo', guest: 'Eduardo Martins', others: '', checkin: '2026-09-20T15:00', checkout: '2026-09-25T11:00', value: 4750, phone: '(31) 98812-4440', status: 'Pendente' }
]

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }

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
      const response = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({login,password}) })
      if (!response.ok) throw new Error()
      onLogin()
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
  const revenue = reservations.reduce((s, r) => s + Number(r.value), 0)
  const next = [...reservations].sort((a,b) => a.checkin.localeCompare(b.checkin))[0]
  const prop = id => properties.find(p => p.id === id)
  const root = useRef()
  useGSAP(() => {
    gsap.from('.hero-copy > *', { y: 28, opacity: 0, stagger: .08, duration: .7, ease: 'power3.out' })
    gsap.from('.metric-card', { y: 34, opacity: 0, stagger: .1, duration: .7, delay: .15, ease: 'power3.out' })
    gsap.utils.toArray('.property-image').forEach(img => gsap.fromTo(img, { scale: .8, opacity: .55 }, { scale: 1, opacity: 1, scrollTrigger: { trigger: img, start: 'top 92%', end: 'bottom 35%', scrub: .7 } }))
  }, { scope: root })
  return <div ref={root}>
    <section className="hero-split">
      <div className="hero-copy"><p className="eyebrow">Setembro em movimento</p><h2>Gestão Airbnb <span className="inline-photo" /> mais inteligente.</h2><p>Uma leitura clara do que entra, do que sai e do que merece sua atenção agora.</p><div className="hero-actions"><button className="primary" onClick={onNew}>Cadastrar reserva <ArrowRight /></button><button className="secondary" onClick={() => setView('calendar')}>Abrir calendário</button></div></div>
      <div className="hero-visual"><img src="https://picsum.photos/seed/rio-modern-home/1200/1000" alt="Interior contemporâneo de apartamento" /><div className="next-stay"><Clock /><div><span>Próximo check-in</span><strong>{next ? format(parseISO(next.checkin), "d MMM 'às' HH:mm", { locale: ptBR }) : 'Nenhum'}</strong><small>{next?.guest} · {prop(next?.propertyId)?.short}</small></div></div></div>
    </section>
    <section className="metrics-grid">
      <article className="metric-card revenue"><div className="metric-head"><span>Receita prevista</span><CurrencyDollar /></div><strong>{money.format(revenue)}</strong><p><b>+12,4%</b> em relação ao mês anterior</p><svg viewBox="0 0 500 100" preserveAspectRatio="none"><path d="M0 84 C55 72 72 82 120 60 S205 74 252 42 S340 50 390 24 S455 38 500 8" fill="none" stroke="#E65C00" strokeWidth="4"/><path d="M0 84 C55 72 72 82 120 60 S205 74 252 42 S340 50 390 24 S455 38 500 8 L500 100 L0 100Z" fill="url(#grad)"/><defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#E65C00" stopOpacity=".22"/><stop offset="1" stopColor="#E65C00" stopOpacity="0"/></linearGradient></defs></svg></article>
      <article className="metric-card"><div className="metric-head"><span>Taxa de ocupação</span><CalendarBlank /></div><strong>78<span>%</span></strong><div className="progress"><i style={{width:'78%'}} /></div><p>Meta mensal: 82%</p></article>
      <article className="metric-card"><div className="metric-head"><span>Diária média</span><ChartLineUp /></div><strong>{money.format(revenue / Math.max(reservations.length * 5, 1))}</strong><p><b>+8,2%</b> no período</p></article>
    </section>
    <section className="section-head"><div><p className="eyebrow">Portfólio ativo</p><h2>O pulso de cada endereço</h2></div><button className="text-button" onClick={() => setView('properties')}>Ver todos <ArrowRight /></button></section>
    <section className="property-row">{properties.map((p, i) => <article className="property-card group" key={p.id}><div className="image-wrap"><img className="property-image" src={p.image} alt={p.name} /><span style={{background:p.color}}>Ativo</span></div><div><small>{p.address}</small><h3>{p.name}</h3><p>{[84,72,79][i]}% ocupado · {money.format([11200,9800,7600][i])}</p></div></article>)}</section>
    <section className="marquee"><div>CHECK-IN CLARO · RECEITA VISÍVEL · OPERAÇÃO TRANQUILA · CHECK-IN CLARO · RECEITA VISÍVEL · OPERAÇÃO TRANQUILA ·</div></section>
  </div>
}

function CalendarView({ reservations, properties, onNew }) {
  const [month, setMonth] = useState(new Date(2026, 8, 1))
  const start = startOfMonth(month), end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })
  const blanks = Array((start.getDay() + 6) % 7).fill(null)
  const dayReservations = day => reservations.filter(r => { const a=parseISO(r.checkin), b=parseISO(r.checkout); return day >= new Date(a.getFullYear(),a.getMonth(),a.getDate()) && day <= new Date(b.getFullYear(),b.getMonth(),b.getDate()) })
  return <section className="calendar-shell">
    <div className="calendar-toolbar"><div><button className="icon-button" onClick={()=>setMonth(subMonths(month,1))}><ArrowLeft /></button><button className="icon-button" onClick={()=>setMonth(addMonths(month,1))}><ArrowRight /></button><h2>{format(month, 'MMMM yyyy', { locale: ptBR })}</h2></div><div className="legend">{properties.map(p=><span key={p.id}><i style={{background:p.color}} />{p.short}</span>)}</div></div>
    <div className="calendar-grid weekdays">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=><div key={d}>{d}</div>)}</div>
    <div className="calendar-grid days">{blanks.map((_,i)=><div className="day empty" key={`b${i}`} />)}{days.map(day=><button className={`day ${isSameDay(day,new Date())?'today':''}`} key={day.toISOString()} onClick={onNew}><span>{format(day,'d')}</span>{dayReservations(day).slice(0,3).map(r=>{const p=properties.find(x=>x.id===r.propertyId);return <div className="booking" style={{borderLeftColor:p.color,background:`${p.color}14`}} key={r.id}><b>{r.guest.split(' ')[0]}</b><small>{p.short}</small></div>})}</button>)}</div>
  </section>
}

function Reservations({ reservations, properties, onNew }) {
  return <section className="table-card"><div className="table-intro"><div><p className="eyebrow">Agenda consolidada</p><h2>Todas as reservas</h2></div><button className="secondary"><CaretDown /> Filtrar</button></div><div className="table-scroll"><table><thead><tr><th>Hóspede</th><th>Imóvel</th><th>Período</th><th>Valor</th><th>Status</th></tr></thead><tbody>{reservations.map(r=>{const p=properties.find(x=>x.id===r.propertyId); return <tr key={r.id}><td><strong>{r.guest}</strong><small>{r.phone || 'Sem telefone'}</small></td><td><span className="property-dot" style={{background:p.color}} />{p.name}</td><td>{format(parseISO(r.checkin),'dd MMM',{locale:ptBR})} — {format(parseISO(r.checkout),'dd MMM',{locale:ptBR})}<small>{format(parseISO(r.checkin),'HH:mm')} / {format(parseISO(r.checkout),'HH:mm')}</small></td><td><strong>{money.format(r.value)}</strong></td><td><span className={`status ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>})}</tbody></table></div><button className="floating-add" onClick={onNew}><Plus /> Adicionar reserva</button></section>
}

function Properties({ properties, setProperties, reservations, setView }) {
  const blank = { name:'', address:'', image:'' }
  const [editor,setEditor]=useState(null)
  const [selected,setSelected]=useState(null)
  const [detailView,setDetailView]=useState('details')
  const [form,setForm]=useState(blank)
  const openNew=()=>{setForm(blank);setEditor('new')}
  const openEdit=p=>{setForm({name:p.name,address:p.address,image:p.image});setSelected(null);setEditor(p.id)}
  const choosePhoto=e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>setForm(v=>({...v,image:reader.result}));reader.readAsDataURL(file)}
  const save=e=>{e.preventDefault();if(editor==='new'){const id=Date.now().toString();setProperties([...properties,{id,name:form.name,short:form.name.split(' ').slice(-1)[0],color:'#B98A5A',address:form.address,status:'Ativo',image:form.image||`https://picsum.photos/seed/${encodeURIComponent(form.name)}/1200/900`}])}else{setProperties(properties.map(p=>p.id===editor?{...p,...form,short:form.name.split(' ').slice(-1)[0]}:p))}setEditor(null);setForm(blank)}
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
    {editor&&<div className="modal-backdrop"><form className="modal property-form" onSubmit={save}><button type="button" className="modal-close" onClick={()=>setEditor(null)}><X /></button><p className="eyebrow">{editor==='new'?'Novo endereço':'Atualizar imóvel'}</p><h2>{editor==='new'?'Cadastrar imóvel':'Editar imóvel'}</h2><div className="property-fields"><label>Nome do imóvel<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Loft Ipanema" /></label><label>Endereço<input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Rua, número, bairro e cidade" /></label><label className="upload-field"><span>Foto do imóvel</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto}/><div className="upload-box">{form.image?<img src={form.image} alt="Prévia do imóvel"/>:<><Camera/><strong>Selecionar foto</strong><small>JPG, PNG ou WebP</small></>}</div></label></div><button className="primary full">{editor==='new'?'Salvar imóvel':'Salvar alterações'}</button></form></div>}
    {selected&&<div className="modal-backdrop"><section className="modal property-detail"><button type="button" className="modal-close" onClick={()=>setSelected(null)}><X /></button>{detailView==='details'?<><div className="detail-photo"><img src={selected.image} alt={selected.name}/><span style={{background:selected.color}}>Ativo</span></div><p className="eyebrow">Detalhes do imóvel</p><h2>{selected.name}</h2><p className="detail-address">{selected.address}</p><div className="detail-actions"><button className="primary" onClick={()=>{setSelected(null);setView('calendar')}}><CalendarBlank/> Ver agenda</button><button className="secondary" onClick={()=>openEdit(selected)}><PencilSimple/> Editar imóvel</button><button className="secondary" onClick={()=>setDetailView('gains')}><ChartLineUp/> Ver ganhos</button></div></>:<><button className="back-button" onClick={()=>setDetailView('details')}><ArrowLeft/> Voltar ao imóvel</button><p className="eyebrow">Histórico financeiro</p><h2>Ganhos de {selected.short}</h2><div className="gains-total"><span>Total geral</span><strong>{money.format(totalGains)}</strong></div><div className="gains-list">{gains.length?gains.map(item=><div key={item.key}><span>{item.label}</span><i style={{width:`${Math.max(12,(item.value/Math.max(...gains.map(g=>g.value)))*100)}%`}}/><strong>{money.format(item.value)}</strong></div>):<p className="empty-state">Ainda não há reservas com ganhos para este imóvel.</p>}</div></>}</section></div>}
  </>
}

function ReservationModal({ properties, onClose, onSave }) {
  const [form,setForm]=useState({propertyId:properties[0].id,guest:'',others:'',value:'',checkin:'',checkout:'',phone:'',status:'Confirmada'})
  const update=e=>setForm({...form,[e.target.name]:e.target.value})
  const submit=e=>{e.preventDefault();onSave({...form,id:Date.now(),value:Number(form.value)})}
  return <div className="modal-backdrop"><form className="modal reservation-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X /></button><p className="eyebrow">Nova hospedagem</p><h2>Cadastrar reserva</h2><div className="form-grid"><label className="wide">Imóvel<select name="propertyId" value={form.propertyId} onChange={update}>{properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Hóspede principal<input required name="guest" value={form.guest} onChange={update} placeholder="Nome completo" /></label><label>Celular<input name="phone" value={form.phone} onChange={update} placeholder="(00) 00000-0000" /></label><label className="wide">Demais hóspedes<input name="others" value={form.others} onChange={update} placeholder="Separe os nomes por vírgula" /></label><label>Check-in<input required type="datetime-local" name="checkin" value={form.checkin} onChange={update} /></label><label>Check-out<input required type="datetime-local" name="checkout" value={form.checkout} onChange={update} /></label><label className="wide">Valor da estadia<input required min="0" type="number" name="value" value={form.value} onChange={update} placeholder="R$ 0,00" /></label></div><button className="primary full">Confirmar e enviar alertas <ArrowRight /></button></form></div>
}

export default function App() {
  const [logged,setLogged]=useState(()=>sessionStorage.getItem('morada-auth')==='1')
  const [view,setView]=useState('dashboard')
  const [properties,setProperties]=useState(()=>readStore('morada-properties',propertiesSeed))
  const [reservations,setReservations]=useState(()=>readStore('morada-reservations',reservationsSeed))
  const [modal,setModal]=useState(false)
  const [toast,setToast]=useState('')
  useEffect(()=>localStorage.setItem('morada-properties',JSON.stringify(properties)),[properties])
  useEffect(()=>localStorage.setItem('morada-reservations',JSON.stringify(reservations)),[reservations])
  const titles={dashboard:'Visão geral',calendar:'Calendário de ocupação',reservations:'Reservas',properties:'Imóveis'}
  const save=async r=>{setReservations(v=>[...v,r]);setModal(false);const p=properties.find(x=>x.id===r.propertyId);setToast('Reserva salva. Enviando alertas…');try{const response=await fetch('/api/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...r,property:p.name,value:money.format(r.value)})});if(!response.ok)throw new Error();setToast('Reserva salva e alertas enviados para Sandro e Joana.')}catch{setToast('Reserva salva. Configure a Resend para ativar os alertas por email.')}setTimeout(()=>setToast(''),5000)}
  if(!logged)return <Login onLogin={()=>{sessionStorage.setItem('morada-auth','1');setLogged(true)}} />
  return <main className="app-shell overflow-x-hidden w-full max-w-full"><Sidebar view={view} setView={setView} logout={()=>{sessionStorage.removeItem('morada-auth');setLogged(false)}}/><div className="workspace"><Topbar title={titles[view]} onNew={()=>setModal(true)}/><div className="content">{view==='dashboard'&&<Dashboard reservations={reservations} properties={properties} setView={setView} onNew={()=>setModal(true)}/>} {view==='calendar'&&<CalendarView reservations={reservations} properties={properties} onNew={()=>setModal(true)}/>} {view==='reservations'&&<Reservations reservations={reservations} properties={properties} onNew={()=>setModal(true)}/>} {view==='properties'&&<Properties properties={properties} setProperties={setProperties} reservations={reservations} setView={setView}/>}</div><footer><strong>morada</strong><span>Gestão feita para receber bem.</span><small>Operação de Sandro & Joana</small></footer></div>{modal&&<ReservationModal properties={properties} onClose={()=>setModal(false)} onSave={save}/>} {toast&&<div className="toast"><Check weight="bold" />{toast}</div>}</main>
}
