import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY precisam estar configuradas.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const loginEmail = import.meta.env.VITE_SUPABASE_LOGIN_EMAIL || 'airbnb@morada.app'

const fallbackImages = {
  'Apt Ataulfo de Paiva': 'https://picsum.photos/seed/ataulfo-apartment/1200/900',
  'Apt Bartolomeu Mitre': 'https://picsum.photos/seed/bartolomeu-interior/1200/900',
  'Studio Gávea': 'https://picsum.photos/seed/gavea-studio/1200/900',
}

export const toProperty = row => ({
  id: String(row.id),
  organizationId: row.organization_id,
  name: row.name,
  short: row.name.replace(/^Apt\s+/i, '').replace(/^Studio\s+/i, ''),
  color: row.color,
  address: row.address,
  status: row.status === 'active' ? 'Ativo' : row.status === 'maintenance' ? 'Manutenção' : 'Inativo',
  photoPath: row.photo_path,
  image: row.image || fallbackImages[row.name] || `https://picsum.photos/seed/${encodeURIComponent(row.name)}/1200/900`,
})

export const toReservation = row => ({
  id: String(row.id),
  organizationId: row.organization_id,
  propertyId: String(row.property_id),
  guest: row.primary_guest_name,
  others: (row.reservation_guests || []).map(guest => guest.full_name).join(', '),
  checkin: row.checkin_at,
  checkout: row.checkout_at,
  value: Number(row.stay_amount),
  phone: row.guest_phone || '',
  status: ({ pending: 'Pendente', confirmed: 'Confirmada', checked_in: 'Check-in', checked_out: 'Check-out', cancelled: 'Cancelada' })[row.status] || row.status,
})

export async function loadPortfolio() {
  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, full_name, role')
    .limit(1)

  if (membershipError) throw membershipError
  const membership = memberships?.[0]
  if (!membership) throw new Error('Usuário sem acesso à organização. Associe-o em organization_members.')

  const [{ data: propertyRows, error: propertyError }, { data: reservationRows, error: reservationError }] = await Promise.all([
    supabase.from('properties').select('*').eq('organization_id', membership.organization_id).order('name'),
    supabase.from('reservations').select('*, reservation_guests(full_name)').eq('organization_id', membership.organization_id).order('checkin_at'),
  ])
  if (propertyError) throw propertyError
  if (reservationError) throw reservationError

  const properties = await Promise.all((propertyRows || []).map(async row => {
    if (!row.photo_path) return toProperty(row)
    const { data } = await supabase.storage.from('property-images').createSignedUrl(row.photo_path, 3600)
    return toProperty({ ...row, image: data?.signedUrl })
  }))

  return {
    organizationId: membership.organization_id,
    member: membership,
    properties,
    reservations: (reservationRows || []).map(toReservation),
  }
}

const safeFileName = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase()

export async function saveProperty({ organizationId, id, name, address, color, photoFile, currentPhotoPath }) {
  let photoPath = currentPhotoPath || null
  if (photoFile) {
    photoPath = `${organizationId}/${crypto.randomUUID()}-${safeFileName(photoFile.name)}`
    const { error: uploadError } = await supabase.storage.from('property-images').upload(photoPath, photoFile, { upsert: false })
    if (uploadError) throw uploadError
  }

  const payload = { organization_id: organizationId, name: name.trim(), address: address.trim(), color, photo_path: photoPath }
  const query = id
    ? supabase.from('properties').update(payload).eq('id', id).eq('organization_id', organizationId)
    : supabase.from('properties').insert(payload)
  const { data, error } = await query.select().single()
  if (error) throw error

  let image
  if (data.photo_path) {
    const { data: signed } = await supabase.storage.from('property-images').createSignedUrl(data.photo_path, 3600)
    image = signed?.signedUrl
  }
  return toProperty({ ...data, image })
}

export async function saveReservation({ organizationId, form }) {
  const status = ({ Confirmada: 'confirmed', Pendente: 'pending' })[form.status] || 'confirmed'
  const { data, error } = await supabase.from('reservations').insert({
    organization_id: organizationId,
    property_id: Number(form.propertyId),
    primary_guest_name: form.guest.trim(),
    guest_phone: form.phone.trim() || null,
    stay_amount: Number(form.value),
    checkin_at: new Date(form.checkin).toISOString(),
    checkout_at: new Date(form.checkout).toISOString(),
    status,
  }).select().single()
  if (error) throw error

  const guests = form.others.split(',').map(name => name.trim()).filter(Boolean)
  if (guests.length) {
    const { error: guestsError } = await supabase.from('reservation_guests').insert(guests.map(full_name => ({
      organization_id: organizationId,
      reservation_id: data.id,
      full_name,
    })))
    if (guestsError) throw guestsError
  }

  return toReservation({ ...data, reservation_guests: guests.map(full_name => ({ full_name })) })
}
