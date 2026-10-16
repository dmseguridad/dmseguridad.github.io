/* Capa de datos de la app.
   Hoy guarda todo en localStorage (modo demo, datos de ejemplo).
   Para producción se reemplaza el almacenamiento por Supabase manteniendo
   estas mismas funciones de SalonDB, así las pantallas no cambian. */
(function () {
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  const U = {
    uid: () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8),
    today: () => toISO(new Date()),
    toISO, parseISO,
    addDays: (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); },
    weekday: s => parseISO(s).getDay(),
    month: s => s.slice(0, 7),
    toMin: hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; },
    fromMin: m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
    nowMin: () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },
    fmtTime: hm => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`; },
    fmtDur: min => min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`,
    fmtDate: (s, opts = { day: 'numeric', month: 'short' }) => parseISO(s).toLocaleDateString('es-EC', opts),
    fmtLong: s => parseISO(s).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }),
    money: n => '$' + Number(n || 0).toFixed(2),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    cap: s => s ? s[0].toUpperCase() + s.slice(1) : s,
    first: name => String(name || '').split(' ')[0],
    initials: name => String(name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(),
    phone: p => String(p || '').replace(/\D/g, ''),
    waLink(phone, msg) {
      const p = '593' + U.phone(phone).replace(/^593/, '').replace(/^0/, '');
      return `https://wa.me/${p}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
    },
    DAYS: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    DAYS_SHORT: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  };
  window.U = U;

  const KEY = 'salonapp_db_v1';
  const VERSION = 3;
  const STATUS = {
    pendiente: { label: 'Por confirmar', cls: 'warn' },
    confirmada: { label: 'Confirmada', cls: 'info' },
    completada: { label: 'Atendida', cls: 'ok' },
    cancelada: { label: 'Cancelada', cls: 'bad' },
    no_asistio: { label: 'No asistió', cls: 'bad' },
  };
  const ORDER_STATUS = {
    pendiente: { label: 'Nuevo', cls: 'warn' },
    listo: { label: 'Listo para retirar', cls: 'info' },
    entregado: { label: 'Entregado', cls: 'ok' },
    cancelado: { label: 'Cancelado', cls: 'bad' },
  };
  // Estado del pago cuando el cliente paga por transferencia y sube su comprobante
  const PAY_STATUS = {
    salon: { label: 'Paga en el salón', cls: '' },
    pendiente: { label: 'Falta comprobante', cls: 'warn' },
    en_revision: { label: 'Comprobante por revisar', cls: 'info' },
    verificado: { label: 'Pago verificado', cls: 'ok' },
    rechazado: { label: 'Comprobante rechazado', cls: 'bad' },
  };
  const BANKS = ['Banco Pichincha', 'Banco Guayaquil', 'Produbanco', 'Banco del Pacífico', 'Banco Bolivariano', 'Banco Internacional', 'Banco de Machala', 'Banco del Austro', 'JEP', 'Cooperativa 29 de Octubre', 'DeUna'];
  // Datos de ejemplo: el salón los cambia en Ajustes
  const defaultPayments = () => ({
    transfer: true,
    accounts: [{ id: 'b1', bank: 'Banco Pichincha', type: 'Ahorros', number: '2201234567', holder: 'María Estilo Color', idNumber: '1312345679', email: 'pagos@estiloycolor.ec' }],
    note: 'Transfiere el valor exacto y sube la foto del comprobante. Lo revisamos en minutos.',
  });
  // Comprobante de muestra (imagen SVG) para que la demo tenga algo que revisar
  function demoReceipt(amount, date) {
    const t = (x, y, s, txt, o = '') => `<text x="${x}" y="${y}" font-family="Arial" font-size="${s}" ${o}>${txt}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560"><rect width="360" height="560" fill="#f3f6fb"/><rect width="360" height="120" fill="#0f265c"/>`
      + t(180, 58, 20, 'Banco Pichincha', 'fill="#fff" text-anchor="middle" font-weight="bold"') + t(180, 88, 14, 'Comprobante de transferencia', 'fill="#cfe0ff" text-anchor="middle"')
      + `<circle cx="180" cy="170" r="30" fill="#0e9f6e"/><path d="M166 170l10 10 20-20" stroke="#fff" stroke-width="6" fill="none"/>`
      + t(180, 236, 18, '¡Transferencia exitosa!', 'fill="#0f1b3d" text-anchor="middle" font-weight="bold"') + t(180, 290, 34, '$' + Number(amount).toFixed(2), 'fill="#0f1b3d" text-anchor="middle" font-weight="bold"')
      + [['Para', 'María Estilo Color'], ['Cuenta', 'Ahorros ****4567'], ['Fecha', date], ['Comprobante', String(Math.round(amount * 7919) % 900000 + 100000)]]
        .map(([k, v], i) => t(30, 350 + i * 35, 14, k, 'fill="#5b6882"') + t(330, 350 + i * 35, 14, v, 'fill="#0f1b3d" text-anchor="end"')).join('')
      + t(180, 525, 11, 'Imagen de ejemplo para la demo', 'fill="#98a1b0" text-anchor="middle"') + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  // Agrega a la demo una cita y un pedido pagados por transferencia, con comprobante por revisar
  function addDemoPayments(data) {
    const today = U.today();
    const a = data.appointments.find(x => x.date > today && x.status === 'pendiente') || data.appointments.find(x => x.date >= today && x.status === 'confirmada');
    if (a) a.payment = { method: 'transferencia', status: 'en_revision', receipt: demoReceipt(a.price, U.fmtDate(today)), uploadedAt: today };
    const o = data.orders.find(x => x.status === 'pendiente');
    if (o) o.payment = { method: 'transferencia', status: 'en_revision', receipt: demoReceipt(o.total, U.fmtDate(today)), uploadedAt: today };
  }
  const newPayment = method => method === 'transferencia'
    ? { method, status: 'pendiente', receipt: null, uploadedAt: null }
    : { method: 'salon', status: 'salon', receipt: null, uploadedAt: null };

  /* ---------- Datos de ejemplo ---------- */
  function seed() {
    const today = U.today();
    const settings = {
      salonName: 'Estilo & Color', phone: '0991234567', address: 'Av. Principal y Calle 10, Manta',
      logo: null, pin: '1234', slotStep: 30, autoConfirm: false, daysAhead: 21, minNotice: 60, cancelHours: 3,
      // 0 = domingo; null = cerrado
      hours: { 0: null, 1: ['09:00', '19:00'], 2: ['09:00', '19:00'], 3: ['09:00', '19:00'], 4: ['09:00', '19:00'], 5: ['09:00', '20:00'], 6: ['08:00', '17:00'] },
    };
    const S = (id, name, category, duration, price, description = '') => ({ id, name, category, duration, price, description, active: true });
    const services = [
      S('s1', 'Corte dama', 'Cabello', 45, 12, 'Lavado, corte y secado.'),
      S('s2', 'Corte caballero', 'Barbería', 30, 6),
      S('s3', 'Arreglo de barba', 'Barbería', 30, 4, 'Perfilado con navaja y toalla caliente.'),
      S('s4', 'Cepillado', 'Cabello', 45, 10),
      S('s5', 'Tinte completo', 'Color', 120, 45, 'Incluye tratamiento post color.'),
      S('s6', 'Mechas / Balayage', 'Color', 150, 70),
      S('s7', 'Keratina', 'Tratamientos', 120, 60, 'Alisado y nutrición profunda.'),
      S('s8', 'Hidratación capilar', 'Tratamientos', 45, 15),
      S('s9', 'Manicure', 'Uñas', 45, 8),
      S('s10', 'Pedicure', 'Uñas', 60, 12),
      S('s11', 'Uñas acrílicas', 'Uñas', 90, 25),
      S('s12', 'Peinado para evento', 'Cabello', 60, 20),
    ];
    const H = (from, to, off = [0]) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, off.includes(d) ? null : [from, to]]));
    const staff = [
      { id: 'e1', name: 'Andrea Molina', role: 'Estilista', color: '#d62839', serviceIds: ['s1', 's4', 's8', 's12', 's7'], hours: H('09:00', '18:00'), active: true },
      { id: 'e2', name: 'Kevin Zambrano', role: 'Barbero', color: '#1d4ed8', serviceIds: ['s2', 's3'], hours: H('10:00', '20:00', [0, 1]), active: true },
      { id: 'e3', name: 'Sofía Cedeño', role: 'Colorista', color: '#7c3aed', serviceIds: ['s1', 's4', 's5', 's6', 's7', 's8'], hours: H('09:00', '19:00', [0, 3]), active: true },
      { id: 'e4', name: 'Valeria Pico', role: 'Manicurista', color: '#0e9f6e', serviceIds: ['s9', 's10', 's11'], hours: H('09:00', '17:00', [0, 1]), active: true },
    ];
    const names = ['María José Vera', 'Carla Intriago', 'Luis Mendoza', 'Gabriela Loor', 'Jorge Delgado', 'Daniela Macías', 'Pedro Alcívar', 'Fernanda Ponce', 'Ricardo Chávez', 'Paola Mero', 'Camila Reyes', 'Diego Bravo', 'Lucía García', 'Bryan Anchundia'];
    const clients = names.map((name, i) => ({ id: 'c' + (i + 1), name, phone: '09' + String(87654321 - i * 1234567).padStart(8, '0'), createdAt: U.addDays(today, -120 + i * 3), notes: '' }));
    const P = (id, name, category, price, stock, emoji, description) => ({ id, name, category, price, stock, emoji, photo: null, description, active: true });
    const products = [
      P('p1', 'Shampoo sin sal 400 ml', 'Cabello', 9.5, 12, '🧴', 'Limpieza suave, ideal después de keratina o tinte.'),
      P('p2', 'Acondicionador reparador', 'Cabello', 9.5, 9, '🧴', 'Desenreda y repara puntas abiertas.'),
      P('p3', 'Mascarilla de keratina', 'Tratamientos', 14, 6, '🫙', 'Nutrición intensa una vez por semana.'),
      P('p4', 'Aceite de argán', 'Tratamientos', 12, 2, '💧', 'Brillo y control del frizz.'),
      P('p5', 'Protector térmico', 'Cabello', 11, 8, '🔥', 'Protege antes de planchar o secar.'),
      P('p6', 'Cera mate para peinar', 'Barbería', 7, 15, '🪮', 'Fijación media, acabado natural.'),
      P('p7', 'Aceite para barba', 'Barbería', 8, 10, '🧔', 'Suaviza y da aroma a la barba.'),
      P('p8', 'Esmalte en gel', 'Uñas', 6, 20, '💅', 'Colores de temporada. Pregunta por los tonos.'),
    ];

    // Citas: 2 meses atrás y 7 adelante, sin cruces por estilista
    let s = 20261016;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const appointments = [];
    const now = U.nowMin();
    for (let d = -62; d <= 7; d++) {
      const date = U.addDays(today, d), wd = U.weekday(date);
      staff.forEach(st => {
        const sh = settings.hours[wd], own = st.hours[wd];
        if (!sh || !own) return;
        const a = Math.max(U.toMin(sh[0]), U.toMin(own[0])), b = Math.min(U.toMin(sh[1]), U.toMin(own[1]));
        const busyRate = d < 0 ? 0.55 : d === 0 ? 0.45 : Math.max(0.12, 0.45 - d * 0.05);
        let t = a;
        while (t < b) {
          const sid = pick(st.serviceIds), svc = services.find(x => x.id === sid);
          if (t + svc.duration > b || rnd() > busyRate) { t += 30; continue; }
          const end = t + svc.duration;
          let status = 'confirmada';
          if (d < 0 || (d === 0 && end <= now)) status = rnd() < 0.92 ? 'completada' : 'no_asistio';
          else if (rnd() < 0.3) status = 'pendiente';
          appointments.push({ id: 'a' + appointments.length, clientId: pick(clients).id, staffId: st.id, serviceIds: [svc.id], date, start: U.fromMin(t), end: U.fromMin(end), price: svc.price, status, source: rnd() < 0.6 ? 'app' : 'salon', notes: '', createdAt: U.addDays(date, -2) });
          t = Math.ceil(end / 30) * 30;
        }
      });
    }
    const orders = [
      { id: 'o1', clientId: 'c2', items: [{ productId: 'p1', qty: 1, price: 9.5 }, { productId: 'p3', qty: 1, price: 14 }], total: 23.5, status: 'pendiente', createdAt: today },
      { id: 'o2', clientId: 'c5', items: [{ productId: 'p6', qty: 2, price: 7 }], total: 14, status: 'listo', createdAt: U.addDays(today, -1) },
    ];
    return { version: VERSION, settings, services, staff, clients, appointments, products, orders };
  }

  /* ---------- Almacenamiento ---------- */
  let db;
  // Envía cada cambio a los demás aparatos (lo conecta shared/sync.js); sin él, no hace nada
  let publish = () => {};
  // Las fotos de comprobantes viajan aparte como archivo, no dentro del mensaje
  const lite = p => p && p.receipt && p.receipt.startsWith('data:') ? { ...p, receipt: null } : p;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || db.version !== VERSION) { db = seed(); save(); }
    // Pagos por transferencia (agregado después): se completa sin borrar los datos existentes
    if (!db.settings.payments) { db.settings.payments = defaultPayments(); addDemoPayments(db); save(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { window.dispatchEvent(new Event('salondb-save-error')); }
  }
  load();

  const byId = (list, id) => list.find(x => x.id === id);
  const upsert = (list, item) => {
    if (!item.id) item.id = U.uid();
    const i = list.findIndex(x => x.id === item.id);
    if (i >= 0) list[i] = { ...list[i], ...item }; else list.push(item);
    save(); return byId(list, item.id);
  };

  /* ---------- Disponibilidad ---------- */
  // Ventana de trabajo de un estilista ese día: horario del salón ∩ su horario
  function windowFor(staffId, date) {
    const wd = U.weekday(date), sh = db.settings.hours[wd], st = byId(db.staff, staffId);
    if (!sh || !st || !st.active || !st.hours[wd]) return null;
    const own = st.hours[wd];
    const a = Math.max(U.toMin(sh[0]), U.toMin(own[0])), b = Math.min(U.toMin(sh[1]), U.toMin(own[1]));
    return a < b ? [a, b] : null;
  }
  function busy(staffId, date, ignoreId) {
    return db.appointments
      .filter(a => a.staffId === staffId && a.date === date && a.status !== 'cancelada' && a.id !== ignoreId)
      .map(a => [U.toMin(a.start), U.toMin(a.end)]);
  }
  function isFree(staffId, date, startMin, dur, ignoreId) {
    const w = windowFor(staffId, date);
    if (!w || startMin < w[0] || startMin + dur > w[1]) return false;
    return !busy(staffId, date, ignoreId).some(([a, b]) => startMin < b && a < startMin + dur);
  }
  const duration = ids => ids.reduce((t, id) => t + ((byId(db.services, id) || {}).duration || 0), 0);
  const price = ids => ids.reduce((t, id) => t + ((byId(db.services, id) || {}).price || 0), 0);
  const staffFor = ids => db.staff.filter(st => st.active && ids.every(id => st.serviceIds.includes(id)));

  /* Horarios libres para unos servicios. staffId 'any' = cualquiera que los haga.
     forClient aplica la anticipación mínima y no deja reservar en el pasado. */
  function slots({ date, serviceIds, staffId = 'any', ignoreId = null, forClient = true }) {
    const dur = duration(serviceIds);
    if (!dur) return [];
    const today = U.today();
    if (forClient && date < today) return [];
    const cands = staffId === 'any' ? staffFor(serviceIds) : [byId(db.staff, staffId)].filter(Boolean);
    const step = Number(db.settings.slotStep) || 30;
    const minStart = date === today && forClient ? U.nowMin() + Number(db.settings.minNotice || 0) : 0;
    const map = new Map();
    cands.forEach(st => {
      const w = windowFor(st.id, date);
      if (!w) return;
      for (let t = Math.ceil(w[0] / step) * step; t + dur <= w[1]; t += step) {
        if (t < minStart || !isFree(st.id, date, t, dur, ignoreId)) continue;
        if (!map.has(t)) map.set(t, []);
        map.get(t).push(st.id);
      }
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, ids]) => ({ start: U.fromMin(t), staffIds: ids }));
  }

  /* ---------- API ---------- */
  window.SalonDB = {
    STATUS, ORDER_STATUS, PAY_STATUS, BANKS,
    get settings() { return db.settings; },
    saveSettings(patch) { Object.assign(db.settings, patch); save(); },
    reload: load,
    reset() { localStorage.removeItem(KEY); load(); },

    /* ---------- Sincronización en vivo (demo) ---------- */
    setPublisher(fn) { publish = fn; },
    /* Aplica un cambio que llegó de otro aparato. Se puede aplicar dos veces sin duplicar nada. */
    applyRemote(e, fileUrl) {
      // El cliente puede existir aquí con otro id: se reconoce por su celular
      const clientId = c => {
        if (!c) return null;
        let local = byId(db.clients, c.id) || db.clients.find(x => U.phone(x.phone) === U.phone(c.phone));
        if (!local) { local = { ...c }; db.clients.push(local); }
        return local.id;
      };
      const itemOf = (kind, id) => byId(kind === 'appt' ? db.appointments : db.orders, id);
      if (e.t === 'appt') {
        const a = { ...e.appt, clientId: clientId(e.client) || e.appt.clientId };
        const prev = byId(db.appointments, a.id);
        // Si ya teníamos la foto del comprobante, no se pierde
        if (prev && prev.payment && prev.payment.receipt && a.payment && !a.payment.receipt) a.payment = { ...a.payment, receipt: prev.payment.receipt };
        if (prev) Object.assign(prev, a); else db.appointments.push(a);
      } else if (e.t === 'status') {
        const a = byId(db.appointments, e.id);
        if (a) a.status = e.status;
      } else if (e.t === 'order') {
        if (!byId(db.orders, e.order.id)) {
          db.orders.push({ ...e.order, clientId: clientId(e.client) || e.order.clientId });
          e.order.items.forEach(i => { const p = byId(db.products, i.productId); if (p) p.stock = Math.max(0, p.stock - i.qty); });
        }
      } else if (e.t === 'orderStatus') {
        const o = byId(db.orders, e.id);
        if (o) {
          if (e.status === 'cancelado' && o.status !== 'cancelado') o.items.forEach(i => { const p = byId(db.products, i.productId); if (p) p.stock += i.qty; });
          o.status = e.status;
        }
      } else if (e.t === 'pay') {
        const it = itemOf(e.kind, e.id);
        if (it) it.payment = { ...e.payment, receipt: fileUrl || (it.payment && it.payment.receipt) || null };
      } else if (e.t === 'payStatus') {
        const it = itemOf(e.kind, e.id);
        if (it && it.payment) it.payment.status = e.status;
      } else return;
      save();
    },

    // Servicios
    services: (all = false) => db.services.filter(s => all || s.active),
    service: id => byId(db.services, id),
    saveService: s => upsert(db.services, s),
    deleteService(id) {
      if (db.appointments.some(a => a.serviceIds.includes(id))) { byId(db.services, id).active = false; save(); return 'oculto'; }
      db.services = db.services.filter(s => s.id !== id); db.staff.forEach(st => { st.serviceIds = st.serviceIds.filter(x => x !== id); }); save(); return 'borrado';
    },
    categories: list => [...new Set(list.map(x => x.category).filter(Boolean))],
    duration, price,

    // Equipo
    staff: (all = false) => db.staff.filter(s => all || s.active),
    staffMember: id => byId(db.staff, id),
    saveStaff: s => upsert(db.staff, s),
    staffFor,
    windowFor,

    // Clientes
    clients: () => db.clients,
    client: id => byId(db.clients, id),
    clientByPhone: phone => db.clients.find(c => U.phone(c.phone) === U.phone(phone)),
    saveClient: c => upsert(db.clients, c),
    findOrCreateClient(name, phone) {
      return this.clientByPhone(phone) || upsert(db.clients, { name: name.trim(), phone: U.phone(phone), createdAt: U.today(), notes: '' });
    },
    clientStats(id) {
      const list = db.appointments.filter(a => a.clientId === id);
      const done = list.filter(a => a.status === 'completada').sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
      return { visits: done.length, spent: done.reduce((t, a) => t + a.price, 0), last: done[0] ? done[0].date : null, noShows: list.filter(a => a.status === 'no_asistio').length };
    },

    // Citas
    appointments({ date, staffId, clientId, from, to } = {}) {
      return db.appointments.filter(a =>
        (!date || a.date === date) && (!staffId || a.staffId === staffId) && (!clientId || a.clientId === clientId) &&
        (!from || a.date >= from) && (!to || a.date <= to)
      ).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    },
    appointment: id => byId(db.appointments, id),
    slots, isFree,
    /* Crea o reprograma una cita. Lanza un error con mensaje claro si el horario ya no está libre. */
    book({ id = null, clientId, serviceIds, staffId = 'any', date, start, source = 'app', notes = '', payMethod = 'salon' }) {
      if (!serviceIds.length) throw new Error('Elige al menos un servicio');
      const dur = duration(serviceIds), t = U.toMin(start);
      let st = staffId;
      if (st === 'any') {
        const free = staffFor(serviceIds).filter(x => isFree(x.id, date, t, dur, id));
        if (!free.length) throw new Error('Ese horario acaba de ocuparse. Elige otro.');
        // Reparte el trabajo: el que tenga menos citas ese día
        const load = x => db.appointments.filter(a => a.staffId === x.id && a.date === date && a.status !== 'cancelada').length;
        st = free.sort((a, b) => load(a) - load(b))[0].id;
      } else if (!isFree(st, date, t, dur, id)) throw new Error('Ese horario ya no está libre. Elige otro.');
      const prev = id ? byId(db.appointments, id) : null;
      const status = prev && prev.status !== 'cancelada' ? prev.status : (source === 'salon' || db.settings.autoConfirm ? 'confirmada' : 'pendiente');
      const saved = upsert(db.appointments, { id, clientId, staffId: st, serviceIds, date, start, end: U.fromMin(t + dur), price: price(serviceIds), status, source: prev ? prev.source : source, notes, createdAt: prev ? prev.createdAt : U.today(), payment: prev && prev.payment ? prev.payment : newPayment(payMethod) });
      publish({ t: 'appt', isNew: !prev, appt: { ...saved, payment: lite(saved.payment) }, client: byId(db.clients, clientId) });
      return saved;
    },
    setStatus(id, status) { const a = byId(db.appointments, id); if (a) { a.status = status; save(); publish({ t: 'status', id, status }); } return a; },
    // El cliente puede cancelar solo con la anticipación que fija el salón
    canCancel(a) {
      if (!['pendiente', 'confirmada'].includes(a.status)) return false;
      const ms = U.parseISO(a.date).getTime() + U.toMin(a.start) * 60000;
      return ms - Date.now() >= Number(db.settings.cancelHours || 0) * 3600000;
    },
    bookableDates() {
      const out = [], today = U.today();
      for (let i = 0; i <= Number(db.settings.daysAhead || 14); i++) {
        const d = U.addDays(today, i);
        out.push({ date: d, open: !!db.settings.hours[U.weekday(d)] });
      }
      return out;
    },

    // Tienda
    products: (all = false) => db.products.filter(p => all || p.active),
    product: id => byId(db.products, id),
    saveProduct: p => upsert(db.products, p),
    deleteProduct(id) { db.products = db.products.filter(p => p.id !== id); save(); },
    orders: ({ clientId } = {}) => db.orders.filter(o => !clientId || o.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
    /* Pedido para retirar y pagar en el salón; separa el stock al momento */
    placeOrder(clientId, cart, payMethod = 'salon') {
      const items = [];
      for (const [pid, qty] of Object.entries(cart)) {
        const p = byId(db.products, pid);
        if (!p || !p.active) continue;
        if (p.stock < qty) throw new Error(`Solo quedan ${p.stock} de ${p.name}`);
        items.push({ productId: pid, qty, price: p.price });
      }
      if (!items.length) throw new Error('Tu bolsa está vacía');
      items.forEach(i => { byId(db.products, i.productId).stock -= i.qty; });
      const order = upsert(db.orders, { id: 'o' + U.uid(), clientId, items, total: items.reduce((t, i) => t + i.price * i.qty, 0), status: 'pendiente', createdAt: U.today(), payment: newPayment(payMethod) });
      publish({ t: 'order', order, client: byId(db.clients, clientId) });
      return order;
    },
    setOrderStatus(id, status) {
      const o = byId(db.orders, id);
      if (!o) return;
      if (status === 'cancelado' && o.status !== 'cancelado') o.items.forEach(i => { const p = byId(db.products, i.productId); if (p) p.stock += i.qty; });
      o.status = status; save(); publish({ t: 'orderStatus', id, status }); return o;
    },

    // Pagos por transferencia
    get payments() { return db.settings.payments; },
    savePayments(patch) { Object.assign(db.settings.payments, patch); save(); },
    saveAccount(acc) { return upsert(db.settings.payments.accounts, acc); },
    deleteAccount(id) { db.settings.payments.accounts = db.settings.payments.accounts.filter(a => a.id !== id); save(); },
    // Se puede pagar por transferencia solo si el salón lo activó y tiene al menos una cuenta
    transferEnabled: () => !!(db.settings.payments.transfer && db.settings.payments.accounts.length),
    payInfo: item => PAY_STATUS[(item.payment || { status: 'salon' }).status],
    paymentOf: item => item.payment || newPayment('salon'),
    // kind: 'appt' (cita) u 'order' (pedido de la tienda)
    uploadReceipt(kind, id, image) {
      const item = byId(kind === 'appt' ? db.appointments : db.orders, id);
      if (!item) return;
      item.payment = { method: 'transferencia', status: 'en_revision', receipt: image, uploadedAt: U.today() };
      save(); publish({ t: 'pay', kind, id, payment: lite(item.payment) }, image); return item;
    },
    reviewPayment(kind, id, ok) {
      const item = byId(kind === 'appt' ? db.appointments : db.orders, id);
      if (!item || !item.payment) return;
      item.payment.status = ok ? 'verificado' : 'rechazado';
      save(); publish({ t: 'payStatus', kind, id, status: item.payment.status }); return item;
    },

    // Resumen
    dashboard() {
      const today = U.today(), month = U.month(today);
      const todays = db.appointments.filter(a => a.date === today && a.status !== 'cancelada');
      const done = db.appointments.filter(a => a.status === 'completada');
      return {
        todays,
        revToday: done.filter(a => a.date === today).reduce((t, a) => t + a.price, 0),
        revMonth: done.filter(a => U.month(a.date) === month).reduce((t, a) => t + a.price, 0),
        pending: db.appointments.filter(a => a.status === 'pendiente' && a.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
        ordersOpen: db.orders.filter(o => o.status === 'pendiente' || o.status === 'listo'),
        receipts: [...db.appointments.filter(a => a.status !== 'cancelada').map(x => ({ kind: 'appt', item: x })), ...db.orders.filter(o => o.status !== 'cancelado').map(x => ({ kind: 'order', item: x }))].filter(r => r.item.payment && r.item.payment.status === 'en_revision'),
        lowStock: db.products.filter(p => p.active && p.stock <= 3),
      };
    },
    revenueByDay(n = 14) {
      const out = [], today = U.today();
      for (let i = n - 1; i >= 0; i--) {
        const d = U.addDays(today, -i);
        out.push({ label: U.fmtDate(d, { day: 'numeric' }), value: db.appointments.filter(a => a.date === d && a.status === 'completada').reduce((t, a) => t + a.price, 0) });
      }
      return out;
    },
    topServices(days = 30) {
      const from = U.addDays(U.today(), -days), count = {};
      db.appointments.filter(a => a.status === 'completada' && a.date >= from).forEach(a => a.serviceIds.forEach(id => { count[id] = (count[id] || 0) + 1; }));
      return Object.entries(count).map(([id, n]) => ({ service: byId(db.services, id), n })).filter(x => x.service).sort((a, b) => b.n - a.n);
    },
  };
  // Si otra pestaña (por ejemplo la app del cliente) cambia los datos, se recargan
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); window.dispatchEvent(new Event('salondb-change')); } });
})();
