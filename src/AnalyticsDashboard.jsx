import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { analyze, historyBounds, monthKey, businessDate } from './lib/analytics'
import './analytics.css'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const precise = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const percent = value => `${number.format(value)}%`

function Chart({ title, subtitle, data, field, color, valueFormat = currency.format, summary }) {
  const max = Math.max(1, ...data.map(m => m[field]))
  return <article className="analytics-chart" style={{ '--series': color }}>
    <header><div><span className="analytics-kicker">Evolução mensal</span><h3>{title}</h3><p>{subtitle}</p></div><strong>{summary}</strong></header>
    <div className="analytics-plot-scroll"><div className="analytics-plot" style={{ minWidth: Math.max(300, data.length * 66) }}>
      <div className="analytics-axis" aria-hidden="true">{[1, .5, 0].map(tick => <span key={tick}>{valueFormat(max * tick)}</span>)}</div>
      <div className="analytics-bars">{data.map(m => <div className="analytics-month" key={m.key}>
        <div className="analytics-track"><button className={m[field] ? '' : 'zero'} style={{ height: `${m[field] / max * 100}%` }} aria-label={`${title}, ${format(m.date, 'MMMM yyyy', { locale: ptBR })}: ${field === 'occupancy' ? percent(m[field]) : precise.format(m[field])}`}>
          <span className="analytics-tooltip"><small>{format(m.date, 'MMMM yyyy', { locale: ptBR })}</small><b>{field === 'occupancy' ? percent(m[field]) : precise.format(m[field])}</b></span>
        </button></div><span>{format(m.date, 'MMM', { locale: ptBR })}</span><small>{format(m.date, 'yyyy')}</small>
      </div>)}</div>
    </div></div>
  </article>
}

export default function AnalyticsDashboard({ reservations, properties }) {
  const bounds = historyBounds(reservations)
  const [property, setProperty] = useState('all')
  const [period, setPeriod] = useState('all')
  const [customFrom, setFrom] = useState(bounds.from)
  const [customTo, setTo] = useState(bounds.to)
  const now = new Date()
  const today = businessDate(now)
  const from = period === 'all' ? bounds.from : period === 'year' ? `${now.getFullYear()}-01` : period === '12' ? monthKey(addMonths(now, -11)) : customFrom
  const to = period === 'all' ? bounds.to : period === 'year' ? `${now.getFullYear()}-12` : period === '12' ? monthKey(now) : customTo
  const valid = /^\d{4}-\d{2}$/.test(from) && /^\d{4}-\d{2}$/.test(to) && from <= to
  const data = useMemo(() => valid ? analyze(reservations, properties, property, from, to, today) : null, [reservations, properties, property, from, to, valid, today])
  const metrics = data && [
    ['Ocupação do período', percent(data.occupancy), `${data.nights} noites ocupadas · inclui reservas futuras`],
    ['Diária média · ADR', currency.format(data.adr), 'Receita das estadias ÷ noites das estadias'],
    ['Receita por noite disponível', currency.format(data.revpar), 'RevPAR · receita das estadias ÷ capacidade do período'],
    ['Reservas ativas', number.format(data.stays), 'Reservas com check-in no período'],
    ['Duração média', `${number.format(data.length)} noites`, 'Média por reserva ativa'],
    ['Taxa de cancelamento', percent(data.cancellation), 'Canceladas ÷ reservas com check-in no período'],
  ]
  return <section className="analytics-dashboard">
    <div className="analytics-intro"><div><span className="analytics-kicker">Inteligência do portfólio</span><h2>Seu negócio, em perspectiva.</h2><p>Histórico, receitas contratadas e desempenho dos imóveis em uma única leitura.</p></div><span className="analytics-live">Atualizado em {format(now, 'dd/MM/yyyy')}</span></div>
    <div className="analytics-filters">
      <label>Imóvel<select value={property} onChange={e => setProperty(e.target.value)}><option value="all">Todos os imóveis</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Período<select value={period} onChange={e => { setFrom(from); setTo(to); setPeriod(e.target.value) }}><option value="all">Todo o histórico + programado</option><option value="year">Ano atual</option><option value="12">Últimos 12 meses</option><option value="custom">Personalizado</option></select></label>
      <label>De<input aria-label="Mês inicial" type="month" value={from} onInput={e => {setFrom(e.currentTarget.value);setTo(to);setPeriod('custom')}} /></label>
      <label>Até<input aria-label="Mês final" type="month" value={to} onInput={e => {setTo(e.currentTarget.value);setFrom(from);setPeriod('custom')}} /></label>
    </div>
    {!valid ? <p className="analytics-empty" role="alert">Selecione um período válido: o mês inicial deve ser anterior ou igual ao mês final.</p> : <>
      <div className="analytics-revenues">{[['Receita total', data.total, 'Recebida + programada', 'total'], ['Receita recebida', data.received, 'Reservas iniciadas até hoje', 'received'], ['Receita programada', data.scheduled, 'Reservas com início após hoje', 'scheduled']].map(([label, value, hint, tone]) => <article key={tone} className={tone}><span>{label}</span><strong>{currency.format(value)}</strong><small>{hint}</small></article>)}</div>
      {!data.total && <p className="analytics-empty">Nenhuma receita neste recorte. Experimente outro imóvel ou amplie o período.</p>}
      <Chart title="Receita total" subtitle="Toda a receita do mês de check-in, recebida e programada." data={data.monthly} field="total" color="#e65c00" summary={currency.format(data.total)} />
      <div className="analytics-chart-pair"><Chart title="Receita recebida" subtitle="Reservas com receita reconhecida." data={data.monthly} field="received" color="#24796c" summary={currency.format(data.received)} /><Chart title="Receita programada" subtitle="Valores ainda previstos nas reservas." data={data.monthly} field="scheduled" color="#5378b3" summary={currency.format(data.scheduled)} /></div>
      <div className="analytics-section-title"><h3>Eficiência da operação</h3><span>Indicadores do mesmo recorte</span></div>
      <div className="analytics-metrics">{metrics.map(([label, value, hint]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</div>
      <div className="analytics-chart-pair"><Chart title="Ocupação mensal" subtitle="Noites reservadas sobre a capacidade dos imóveis selecionados." data={data.monthly} field="occupancy" color="#24796c" valueFormat={percent} summary={percent(data.occupancy)} />
      <article className="analytics-ranking"><span className="analytics-kicker">Composição da receita</span><h3>Desempenho por imóvel</h3><p>Participação na receita total do período.</p>{data.comparison.map(p => <div className="analytics-property" key={p.id}><div><span><i style={{background:p.color}} />{p.name}</span><b>{currency.format(p.total)}</b></div><div className="analytics-share"><i style={{width:`${data.total ? p.total / data.total * 100 : 0}%`,background:p.color || '#e65c00'}} /></div><small>{percent(data.total ? p.total/data.total*100:0)} do total · {currency.format(p.received)} recebidos</small></div>)}</article></div>
      <details className="analytics-method"><summary>Como os indicadores são calculados</summary><p>Receitas são atribuídas integralmente ao mês do check-in. “Recebida” inclui reservas com data de início até hoje, inclusive, independentemente do horário ou status operacional. “Programada” inclui reservas com início após hoje. A classificação usa o dia atual em São Paulo e representa a regra de previsão financeira do negócio.</p><p>Cancelamentos sem recebimento não geram receita. Cancelamentos recebidos entram nas receitas, mas não na ocupação, ADR ou RevPAR. Ocupação distribui as noites por mês, exclui o dia de checkout e conta uma única vez cada noite de cada imóvel. A capacidade considera todos os imóveis selecionados disponíveis durante todo o período; bloqueios e datas de início de operação não são cadastrados. ADR e duração usam estadias completas com check-in no período. RevPAR usa a receita dessas estadias sobre as noites disponíveis no período. Os indicadores incluem reservas futuras e não representam lucro: despesas pessoais não são custos operacionais dos imóveis.</p></details>
    </>}
  </section>
}
