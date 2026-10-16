/* Cobros de las suscripciones de KadaMeta (gimnasios) y Style App (peluquerías).
   El mismo archivo va en las dos apps y en el panel del dueño; todos leen los mismos datos.
   DEMO: guarda en localStorage (las dos apps están en el mismo dominio) y comparte los cambios
   en vivo por ntfy.sh (tema público, solo datos de prueba). El pago con tarjeta es SIMULADO:
   nunca se guarda el número completo, solo marca y últimos 4 dígitos. En producción la tarjeta
   la captura la pasarela (Kushki / PlacetoPay) y los cobros automáticos corren en el servidor. */
(function () {
  if (window.Billing) return;
  const KEY = 'kbilling_v1';
  const VERSION = 1;
  const IVA = 0.15;
  const TOPIC = 'https://ntfy.sh/kbilling-demo-v2-h8r3n6w1';
  // Las pruebas locales (localhost) no publican en el canal en vivo de la demo publicada
  const LIVE = !/^(localhost|127.0.0.1)$/.test(location.hostname);

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => { const d = parse(s); d.setMonth(d.getMonth() + n); return iso(d); };
  const fmt = (s, o = { day: 'numeric', month: 'long' }) => s ? parse(s).toLocaleDateString('es-EC', o) : '—';
  const money = n => '$' + Number(n || 0).toFixed(2);
  const r2 = n => Math.round(n * 100) / 100;
  const uid = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
  const digits = s => String(s || '').replace(/\D/g, '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = n => String(n || '').split(' ')[0];
  const wa = (phone, msg) => `https://wa.me/593${digits(phone).replace(/^593/, '').replace(/^0/, '')}?text=${encodeURIComponent(msg)}`;

  const PRODUCTS = {
    gym: {
      name: 'KadaMeta', unit: 'gimnasio', units: 'gimnasios', color: '#ff6b35', founderDiscount: 0.5,
      plans: { basico: { name: 'Básico', price: 80, note: 'hasta 80 socios' }, pro: { name: 'Pro', price: 120, note: 'hasta 200 socios' }, premium: { name: 'Premium', price: 180, note: 'más de 200 socios o varias sedes' } },
    },
    salon: {
      name: 'Style App', unit: 'peluquería', units: 'peluquerías', color: '#c9a24a', founderDiscount: 0,
      plans: { salon: { name: 'Mensual', price: 35, note: 'todo incluido' } },
    },
  };
  const DEMO = { gym: 'gym-demo', salon: 'sal-demo' };
  const STATUS = {
    activo: { label: 'Al día', cls: 'ok' },
    por_vencer: { label: 'Por vencer', cls: 'warn' },
    vencido: { label: 'Vencido (en gracia)', cls: 'bad' },
    suspendido: { label: 'Suspendido', cls: 'bad' },
    prueba: { label: 'En prueba', cls: 'info' },
  };
  const PAY_STATUS = {
    en_revision: { label: 'Por revisar', cls: 'info' },
    aprobado: { label: 'Aprobado', cls: 'ok' },
    rechazado: { label: 'Rechazado', cls: 'bad' },
  };
  const METHOD = { transferencia: '🏦 Transferencia', tarjeta: '💳 Tarjeta', auto: '🔁 Cobro automático' };
  const TEST_OK = '4242424242424242', TEST_FAIL = '4000000000000002';

  /* ---------- Datos de ejemplo ---------- */
  function receiptSvg(amount, who, to) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420"><rect width="320" height="420" fill="#f3f6fb"/><rect width="320" height="90" fill="#1f3a8a"/><text x="160" y="52" font-family="Arial" font-size="18" fill="#fff" text-anchor="middle" font-weight="bold">Banco Guayaquil</text><text x="160" y="150" font-family="Arial" font-size="16" fill="#111" text-anchor="middle" font-weight="bold">Transferencia exitosa</text><text x="160" y="200" font-family="Arial" font-size="32" fill="#111" text-anchor="middle" font-weight="bold">$${amount.toFixed(2)}</text><text x="30" y="260" font-family="Arial" font-size="13" fill="#555">De: ${who}</text><text x="30" y="290" font-family="Arial" font-size="13" fill="#555">Para: ${to}</text><text x="160" y="395" font-family="Arial" font-size="10" fill="#999" text-anchor="middle">Imagen de ejemplo para la demo</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function seed() {
    const t = today();
    const C = (id, product, plan, name, owner, phone, city, size, since, paidUntil, x = {}) => ({ id, product, plan, name, owner, phone, city, size, since, paidUntil, suspended: false, trialUntil: null, founderUntil: null, autopay: null, notes: '', ...x });
    const card = (brand, last4, exp, next) => ({ enabled: true, brand, last4, exp, consentAt: addDays(t, -40) + 'T10:15:00', consentAmount: 0, nextCharge: next });
    const clients = [
      // Gimnasios (KadaMeta)
      C(DEMO.gym, 'gym', 'pro', 'Iron Gym', 'Carlos Vera', '0991112233', 'Manta', 140, addDays(t, -70), addDays(t, 4), { founderUntil: addDays(t, 295) }),
      C('gym-2', 'gym', 'basico', 'PowerFit Manta', 'Andrés Loor', '0982223344', 'Manta', 60, addDays(t, -120), t, { autopay: card('Visa', '4242', '08/28', t) }),
      C('gym-3', 'gym', 'premium', 'CrossBox 593', 'Paola Intriago', '0973334455', 'Portoviejo', 260, addDays(t, -200), addDays(t, 21), { autopay: card('Mastercard', '5100', '11/27', addDays(t, 21)) }),
      C('gym-4', 'gym', 'pro', 'Zona Fitness', 'Javier Bravo', '0964445566', 'Manta', 150, addDays(t, -90), addDays(t, -3)),
      C('gym-5', 'gym', 'basico', 'Atlas Training', 'Mónica Pico', '0955556677', 'Jaramijó', 45, addDays(t, -6), null, { trialUntil: addDays(t, 8) }),
      C('gym-6', 'gym', 'pro', 'Fénix Gym', 'Ricardo Chávez', '0946667788', 'Montecristi', 120, addDays(t, -150), addDays(t, -20), { suspended: true }),
      // Peluquerías (Style App)
      C(DEMO.salon, 'salon', 'salon', 'Estilo & Color', 'María Estilo Color', '0991234567', 'Manta', 4, addDays(t, -95), addDays(t, 3)),
      C('sal-2', 'salon', 'salon', 'Barbería El Patrón', 'Jorge Delgado', '0987001122', 'Manta', 3, addDays(t, -150), addDays(t, 18), { autopay: card('Mastercard', '5555', '02/29', addDays(t, 18)) }),
      C('sal-3', 'salon', 'salon', 'Glamour Studio', 'Daniela Macías', '0998112233', 'Portoviejo', 5, addDays(t, -60), addDays(t, 25)),
      C('sal-4', 'salon', 'salon', 'Nails & Beauty Ana', 'Ana Zambrano', '0979223344', 'Manta', 2, addDays(t, -40), addDays(t, -2)),
      C('sal-5', 'salon', 'salon', 'Corte Fino', 'Luis Mendoza', '0968334455', 'Montecristi', 2, addDays(t, -120), addDays(t, -12), { suspended: true }),
      C('sal-6', 'salon', 'salon', 'Bella Vida Spa', 'Fernanda Ponce', '0995445566', 'Portoviejo', 6, addDays(t, -20), addDays(t, 10)),
      C('sal-7', 'salon', 'salon', 'Studio K', 'Kevin Anchundia', '0984556677', 'Manta', 1, addDays(t, -5), null, { trialUntil: addDays(t, 9) }),
    ];
    const db = { version: VERSION, clients, payments: [], settings: {
      pin: '2468', graceDays: 5, trialDays: 14, remindDays: 3, whatsapp: '0980781862', gateway: 'Kushki',
      accounts: [{ id: 'acc1', bank: 'Banco Pichincha', type: 'Ahorros', number: '2200000000', holder: 'Datos de ejemplo — cámbialos en Ajustes', idNumber: '1312345679' }],
    } };
    clients.forEach(c => { if (c.autopay) c.autopay.consentAmount = priceOf(c, db).total; });
    const P = (clientId, months, method, status, daysAgo, x = {}) => {
      const c = clients.find(k => k.id === clientId), amount = r2(priceOf(c, db).total * months);
      db.payments.push({ id: 'pay-' + db.payments.length, clientId, product: c.product, months, amount, method, status, receipt: method === 'transferencia' ? receiptSvg(amount, c.owner, PRODUCTS[c.product].name) : null, createdAt: addDays(t, -daysAgo), reviewedAt: status === 'en_revision' ? null : addDays(t, -daysAgo), ...x });
    };
    P('sal-4', 1, 'transferencia', 'en_revision', 0);
    P('gym-4', 1, 'transferencia', 'en_revision', 0);
    P('sal-2', 1, 'auto', 'aprobado', 12, { cardBrand: 'Mastercard', last4: '5555' });
    P('sal-3', 1, 'tarjeta', 'aprobado', 5, { cardBrand: 'Visa', last4: '1881' });
    P('sal-6', 1, 'transferencia', 'aprobado', 20);
    P(DEMO.salon, 1, 'transferencia', 'aprobado', 27);
    P('sal-5', 1, 'transferencia', 'rechazado', 15);
    P(DEMO.gym, 1, 'transferencia', 'aprobado', 26);
    P('gym-2', 1, 'auto', 'aprobado', 30, { cardBrand: 'Visa', last4: '4242' });
    P('gym-3', 1, 'auto', 'aprobado', 9, { cardBrand: 'Mastercard', last4: '5100' });
    P('gym-3', 1, 'auto', 'aprobado', 39, { cardBrand: 'Mastercard', last4: '5100' });
    return db;
  }

  /* ---------- Almacenamiento ---------- */
  let db;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || db.version !== VERSION) { db = seed(); save(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { window.dispatchEvent(new Event('salondb-save-error')); } }
  const byId = (list, id) => list.find(x => x.id === id);
  const changed = detail => window.dispatchEvent(new CustomEvent('billing-change', { detail: detail || {} }));

  /* ---------- Precios y estados ---------- */
  function priceOf(c, data = db) {
    const p = PRODUCTS[c.product], plan = p.plans[c.plan] || Object.values(p.plans)[0];
    const founder = !!(c.founderUntil && c.founderUntil >= today() && p.founderDiscount);
    const base = r2(plan.price * (founder ? 1 - p.founderDiscount : 1));
    const iva = r2(base * IVA);
    return { plan, list: plan.price, founder, base, iva, total: r2(base + iva) };
  }
  function statusOf(c) {
    const t = today();
    if (c.suspended) return 'suspendido';
    if (!c.paidUntil) return c.trialUntil && c.trialUntil >= t ? 'prueba' : 'suspendido';
    if (c.paidUntil >= addDays(t, 5)) return 'activo';
    if (c.paidUntil >= t) return 'por_vencer';
    return c.paidUntil >= addDays(t, -db.settings.graceDays) ? 'vencido' : 'suspendido';
  }
  const accessUntil = c => c.paidUntil ? addDays(c.paidUntil, db.settings.graceDays) : c.trialUntil;
  function extend(c, months) {
    const base = c.paidUntil && c.paidUntil > today() ? c.paidUntil : today();
    c.paidUntil = addMonths(base, months);
    c.suspended = false;
    if (c.autopay && c.autopay.enabled) c.autopay.nextCharge = c.paidUntil;
  }

  /* ---------- Tarjeta (simulada) ---------- */
  const luhn = n => { let s = 0; [...n].reverse().forEach((d, i) => { let x = +d; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; }); return s % 10 === 0; };
  const brandOf = n => /^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'American Express' : /^3(0|6|8)/.test(n) ? 'Diners Club' : 'Tarjeta';
  function checkCard({ number, exp, cvc, name }) {
    const n = digits(number);
    if (n.length < 14 || n.length > 16 || !luhn(n)) return 'Revisa el número de la tarjeta';
    const m = String(exp || '').match(/^(\d{2})\s*\/\s*(\d{2})$/);
    if (!m || +m[1] < 1 || +m[1] > 12) return 'La fecha debe ser MM/AA';
    const end = new Date(2000 + +m[2], +m[1], 0);
    if (end < new Date()) return 'La tarjeta está vencida';
    if (!/^\d{3,4}$/.test(String(cvc || ''))) return 'Revisa el código de seguridad (CVC)';
    if (String(name || '').trim().length < 3) return 'Escribe el nombre como aparece en la tarjeta';
    return null;
  }

  /* ---------- Sincronización en vivo (demo) ---------- */
  const DEVICE = uid(), startedAt = Date.now() / 1000, seen = new Set();
  async function publish(evt, image) {
    if (!LIVE) return;
    const msg = JSON.stringify({ ...evt, from: DEVICE });
    try {
      if (image) {
        const blob = await (await fetch(image)).blob();
        await fetch(TOPIC, { method: 'PUT', body: blob, headers: { 'X-Filename': 'comprobante.jpg', 'X-Message': msg } });
      } else await fetch(TOPIC, { method: 'POST', body: msg });
    } catch (e) { /* sin internet: queda en este aparato */ }
  }
  // Publica el estado actual de un cliente y, si hay, de un pago (sin la foto, que va como adjunto)
  function share(c, p, image) {
    publish({ t: 'sync', client: c, payment: p ? { ...p, receipt: p.receipt && p.receipt.startsWith('data:') ? null : p.receipt } : null }, image);
  }
  function applyRemote(e, fileUrl) {
    if (e.t !== 'sync') return;
    if (e.client) { const c = byId(db.clients, e.client.id); if (c) Object.assign(c, e.client); else db.clients.push(e.client); }
    if (e.payment) {
      const p = byId(db.payments, e.payment.id), incoming = { ...e.payment, receipt: fileUrl || e.payment.receipt };
      if (p) Object.assign(p, incoming, { receipt: incoming.receipt || p.receipt }); else db.payments.push(incoming);
    }
    save();
  }

  load();

  /* ---------- API ---------- */
  const API = {
    PRODUCTS, DEMO, STATUS, PAY_STATUS, METHOD, IVA, TEST_OK, TEST_FAIL,
    get settings() { return db.settings; },
    saveSettings(patch) { Object.assign(db.settings, patch); save(); },
    reset() { localStorage.removeItem(KEY); load(); changed(); },
    clients: ({ product } = {}) => db.clients.filter(c => !product || product === 'todo' || c.product === product),
    client: id => byId(db.clients, id),
    payments: ({ clientId, product } = {}) => db.payments.filter(p => (!clientId || p.clientId === clientId) && (!product || product === 'todo' || p.product === product)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
    priceOf, statusOf, accessUntil, fmt, money, today, addDays,

    // Transferencia: el cliente sube la foto y el dueño la revisa
    reportTransfer(clientId, months, receipt) {
      const c = byId(db.clients, clientId);
      const p = { id: 'pay-' + uid(), clientId, product: c.product, months, amount: r2(priceOf(c).total * months), method: 'transferencia', status: 'en_revision', receipt, createdAt: today(), reviewedAt: null };
      db.payments.push(p); save(); changed({ t: 'pay' }); share(c, p, receipt);
      return p;
    },
    review(id, ok) {
      const p = byId(db.payments, id), c = p && byId(db.clients, p.clientId);
      if (!p) return;
      p.status = ok ? 'aprobado' : 'rechazado'; p.reviewedAt = today();
      if (ok && c) extend(c, p.months);
      save(); changed({ t: 'review' }); share(c, p);
      return p;
    },
    // Tarjeta: aprueba al instante (simulado). autopay = el cliente autoriza cobros mensuales
    payCard(clientId, months, card, autopay) {
      const err = checkCard(card);
      if (err) return { error: err };
      const n = digits(card.number), c = byId(db.clients, clientId);
      if (n === TEST_FAIL) return { error: 'El banco rechazó la tarjeta (tarjeta de prueba de rechazo). Prueba con otra.' };
      const last4 = n.slice(-4), brand = brandOf(n);
      const p = { id: 'pay-' + uid(), clientId, product: c.product, months, amount: r2(priceOf(c).total * months), method: 'tarjeta', status: 'aprobado', receipt: null, cardBrand: brand, last4, createdAt: today(), reviewedAt: today() };
      db.payments.push(p);
      extend(c, months);
      if (autopay) c.autopay = { enabled: true, brand, last4, exp: card.exp, consentAt: new Date().toISOString(), consentAmount: priceOf(c).total, nextCharge: c.paidUntil, device: (navigator.userAgent.match(/\(([^)]+)\)/) || [, 'navegador'])[1].slice(0, 60) };
      save(); changed({ t: 'card' }); share(c, p);
      return { payment: p };
    },
    cancelAutopay(clientId) {
      const c = byId(db.clients, clientId);
      if (!c || !c.autopay) return;
      c.autopay.enabled = false; c.autopay.canceledAt = new Date().toISOString();
      save(); changed({ t: 'autopay' }); share(c);
    },
    // Lo que en producción hace el servidor cada mañana: cobra a quienes tienen cobro automático y les toca
    runAutopay(date = today()) {
      const out = [];
      db.clients.filter(c => c.autopay && c.autopay.enabled && !c.suspended && c.autopay.nextCharge && c.autopay.nextCharge <= date).forEach(c => {
        const ok = c.autopay.last4 !== '0002';
        const p = { id: 'pay-' + uid(), clientId: c.id, product: c.product, months: 1, amount: priceOf(c).total, method: 'auto', status: ok ? 'aprobado' : 'rechazado', receipt: null, cardBrand: c.autopay.brand, last4: c.autopay.last4, createdAt: date, reviewedAt: date };
        db.payments.push(p);
        if (ok) extend(c, 1);
        out.push({ client: c, payment: p, ok });
        share(c, p);
      });
      save(); if (out.length) changed({ t: 'auto' });
      return out;
    },
    upcomingCharges(days = 7) {
      const lim = addDays(today(), days);
      return db.clients.filter(c => c.autopay && c.autopay.enabled && !c.suspended && c.autopay.nextCharge && c.autopay.nextCharge <= lim).sort((a, b) => a.autopay.nextCharge.localeCompare(b.autopay.nextCharge));
    },
    createClient({ product, plan, name, owner, phone, city, size, founder }) {
      const c = { id: product.slice(0, 3) + '-' + uid(), product, plan, name, owner, phone: digits(phone), city, size: Number(size) || 1, since: today(), paidUntil: null, suspended: false, trialUntil: addDays(today(), db.settings.trialDays), founderUntil: founder ? addMonths(today(), 12) : null, autopay: null, notes: '', pin: String(Math.floor(1000 + Math.random() * 9000)) };
      db.clients.push(c); save(); changed({ t: 'client' }); share(c);
      return c;
    },
    updateClient(id, patch) { const c = byId(db.clients, id); if (!c) return; Object.assign(c, patch); save(); changed({ t: 'client' }); share(c); return c; },
    setSuspended(id, v) { return API.updateClient(id, { suspended: v }); },
    saveAccount(acc) {
      if (!acc.id) acc.id = 'acc' + uid();
      const i = db.settings.accounts.findIndex(a => a.id === acc.id);
      if (i >= 0) db.settings.accounts[i] = { ...db.settings.accounts[i], ...acc }; else db.settings.accounts.push(acc);
      save();
    },
    deleteAccount(id) { db.settings.accounts = db.settings.accounts.filter(a => a.id !== id); save(); },

    metrics(product = 'todo') {
      const list = API.clients({ product }), month = today().slice(0, 7);
      const by = {}; Object.keys(STATUS).forEach(k => { by[k] = 0; });
      list.forEach(c => { by[statusOf(c)]++; });
      const paying = list.filter(c => ['activo', 'por_vencer', 'vencido'].includes(statusOf(c)));
      const pays = API.payments({ product });
      const approvedMonth = pays.filter(p => p.status === 'aprobado' && (p.reviewedAt || p.createdAt).slice(0, 7) === month);
      const collected = r2(approvedMonth.reduce((s, p) => s + p.amount, 0));
      return {
        by, total: list.length, paying: paying.length,
        mrr: r2(paying.reduce((s, c) => s + priceOf(c).base, 0)), // sin IVA
        collected, iva: r2(collected / (1 + IVA) * IVA),
        byMethod: Object.keys(METHOD).map(m => ({ m, total: r2(approvedMonth.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0)) })),
        toReview: pays.filter(p => p.status === 'en_revision'),
        dueSoon: list.filter(c => ['por_vencer', 'vencido', 'prueba'].includes(statusOf(c)) && !(c.autopay && c.autopay.enabled)).sort((a, b) => (accessUntil(a) || '').localeCompare(accessUntil(b) || '')),
        autopay: list.filter(c => c.autopay && c.autopay.enabled).length,
      };
    },
    // Mensajes de WhatsApp del dueño al cliente
    waClient(c, kind) {
      const p = PRODUCTS[c.product], n = first(c.owner), until = fmt(c.paidUntil), price = priceOf(c);
      const msgs = {
        vence: () => `Hola ${n} 👋, te escribimos de ${p.name}. La suscripción de ${c.name} vence el ${until}. Puedes pagar ${money(price.total)} con tarjeta o transferencia en tu panel, sección “Mi suscripción”. ¡Gracias!`,
        vencido: () => `Hola ${n}, la suscripción de ${p.name} para ${c.name} venció el ${until}. Para que tu panel no se pause, paga en “Mi suscripción”. Cualquier duda, aquí estamos 🙏`,
        prueba: () => `Hola ${n} 👋, ¿cómo te va con ${p.name} en ${c.name}? Tu prueba gratis termina el ${fmt(c.trialUntil)}. El plan cuesta ${money(price.base)} + IVA al mes. ¿Te ayudo a activarlo?`,
        cobro: () => `Hola ${n} 👋, te recordamos que el ${fmt(c.autopay && c.autopay.nextCharge)} se cobrará automáticamente ${money(price.total)} de ${p.name} a tu ${c.autopay ? c.autopay.brand + ' •••• ' + c.autopay.last4 : 'tarjeta'}. Si quieres cambiar algo, escríbenos.`,
        aprobado: () => `Hola ${n}, recibimos tu pago de ${p.name} ✅. ${c.name} queda activo hasta el ${until}. ¡Gracias!`,
        fallo: () => `Hola ${n}, no pudimos cobrar ${money(price.total)} de ${p.name} a tu tarjeta. ¿Puedes revisarla o pagar en “Mi suscripción”? 🙏`,
      };
      return wa(c.phone, (msgs[kind] || msgs.vence)());
    },
  };
  window.Billing = API;

  /* ---------- Pantalla "Mi suscripción" (la usan las dos apps) ---------- */
  const css = `.bill-card{background:linear-gradient(135deg,#1e1e22,#121214);border:1px solid var(--border);border-radius:18px;padding:18px;color:#f3efe7;position:relative;overflow:hidden}
  .bill-card .chip-ic{width:38px;height:28px;border-radius:6px;background:linear-gradient(135deg,#e6c77a,#a8822f);margin-bottom:14px}
  .bill-card .num{font-size:1.15rem;letter-spacing:.14em;font-weight:700}.bill-card .row2{display:flex;justify-content:space-between;margin-top:10px;font-size:.8rem;opacity:.8}
  .acc{background:var(--surface-2);border-radius:12px;padding:12px 14px}.acc+.acc{margin-top:10px}
  .acc-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0}.acc-row .k{color:var(--muted);font-size:.8rem;font-weight:600}.acc-row .v{font-weight:700;word-break:break-all}
  .copy{border:0;background:none;color:var(--accent);font:inherit;font-weight:700;font-size:.8rem;cursor:pointer;padding:4px 6px;border-radius:8px}
  .consent{background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:.88rem;line-height:1.45}
  .test-note{border:1px dashed var(--warn);border-radius:12px;padding:10px 12px;font-size:.84rem;color:var(--warn)}
  .pay-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pay-tabs .btn{min-height:54px}`;
  if (!document.getElementById('billing-css')) { const s = document.createElement('style'); s.id = 'billing-css'; s.textContent = css; document.head.appendChild(s); }

  const badge = s => `<span class="badge ${s.cls}">${esc(s.label)}</span>`;
  const copyBtn = v => `<button type="button" class="copy" data-bill="copy" data-v="${esc(v)}">Copiar</button>`;

  API.banner = function (clientId) {
    const c = byId(db.clients, clientId);
    if (!c) return '';
    const st = statusOf(c), auto = c.autopay && c.autopay.enabled;
    if (auto && ['activo', 'por_vencer'].includes(st)) return st === 'por_vencer' ? `<div class="alert ok" style="margin-bottom:16px">🔁 El ${fmt(c.autopay.nextCharge)} se cobrará automáticamente ${money(priceOf(c).total)} a tu ${esc(c.autopay.brand)} •••• ${esc(c.autopay.last4)}.</div>` : '';
    const txt = {
      por_vencer: `Tu suscripción vence el ${fmt(c.paidUntil)}.`,
      vencido: `Tu suscripción venció el ${fmt(c.paidUntil)}. Tienes hasta el ${fmt(accessUntil(c))} para pagar antes de que se pause.`,
      prueba: `Estás en la prueba gratis hasta el ${fmt(c.trialUntil)}.`,
    }[st];
    return txt ? `<div class="alert ${st === 'vencido' ? 'bad' : 'warn'}" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>${txt}</span><a class="btn btn-sm btn-primary" href="#/suscripcion">Pagar ahora</a></div>` : '';
  };
  API.blockedPage = () => `<div class="card stack" style="max-width:560px;margin:40px auto;text-align:center">
      <div style="font-size:2.6rem">⏸️</div><h1>Tu suscripción está pausada</h1>
      <p class="muted">Tus datos están guardados. Paga con tarjeta o transferencia y el panel vuelve a funcionar al instante.</p>
      <a class="btn btn-primary btn-lg" href="#/suscripcion">Ir a Mi suscripción</a></div>`;

  API.subPage = function (clientId, { support = db.settings.whatsapp } = {}) {
    const c = byId(db.clients, clientId);
    if (!c) return '<div class="card empty">Sin datos de suscripción</div>';
    const p = PRODUCTS[c.product], pr = priceOf(c), st = statusOf(c), pays = API.payments({ clientId });
    const waiting = pays.find(x => x.status === 'en_revision');
    const auto = c.autopay && c.autopay.enabled ? c.autopay : null;
    const until = c.paidUntil ? `Pagado hasta el ${fmt(c.paidUntil, { day: 'numeric', month: 'long', year: 'numeric' })}` : `Prueba gratis hasta el ${fmt(c.trialUntil)}`;
    return `<div class="page-head"><div><h1>Mi suscripción</h1><div class="muted">${esc(p.name)} para ${esc(c.name)}</div></div></div>
      <div class="grid g2">
        <div class="stack">
          <div class="card"><div class="row between"><h2>${esc(p.name)} · ${esc(pr.plan.name)}</h2>${badge(STATUS[st])}</div>
            <div class="muted">${until} · ${esc(pr.plan.note)}</div>
            <div class="list-item mt"><span class="grow">Plan ${esc(pr.plan.name)}</span><span>${money(pr.list)}</span></div>
            ${pr.founder ? `<div class="list-item"><span class="grow">Descuento Fundador (hasta ${fmt(c.founderUntil)})</span><span style="color:var(--ok)">−${money(pr.list - pr.base)}</span></div>` : ''}
            <div class="list-item"><span class="grow">IVA ${Math.round(IVA * 100)}%</span><span>${money(pr.iva)}</span></div>
            <div class="list-item"><strong class="grow">Total al mes</strong><strong style="font-size:1.2rem">${money(pr.total)}</strong></div>
          </div>
          <div class="card stack"><h2>Cobro automático</h2>
            ${auto ? `<div class="bill-card"><div class="chip-ic"></div><div class="num">•••• •••• •••• ${esc(auto.last4)}</div><div class="row2"><span>${esc(auto.brand)}</span><span>Vence ${esc(auto.exp)}</span></div></div>
              <div class="alert ok">🔁 Activo. Próximo cobro: <strong>${fmt(auto.nextCharge)}</strong> por <strong>${money(pr.total)}</strong>. Te avisamos ${db.settings.remindDays} días antes.</div>
              <div class="muted small">Autorizaste este cobro el ${new Date(auto.consentAt).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' })}</div>
              <button class="btn btn-danger" data-bill="autopay-off" data-id="${c.id}">Desactivar cobro automático</button>`
            : `<p class="muted">Paga con tarjeta y activa el cobro automático: cada mes se cobra solo y nunca se pausa tu panel. Puedes desactivarlo cuando quieras.</p>
              <button class="btn btn-primary btn-lg btn-block" data-bill="card" data-id="${c.id}">💳 Pagar con tarjeta</button>`}
          </div>
          <div class="card"><h2>Historial de pagos</h2>
            ${pays.length ? pays.map(x => `<div class="list-item"><div class="grow"><strong>${money(x.amount)}</strong> · ${x.months} ${x.months > 1 ? 'meses' : 'mes'}<div class="muted small">${METHOD[x.method]}${x.last4 ? ' •••• ' + esc(x.last4) : ''} · ${fmt(x.createdAt, { day: 'numeric', month: 'short' })}</div></div>${badge(PAY_STATUS[x.status])}</div>`).join('') : '<div class="empty">Aún no hay pagos</div>'}
          </div>
        </div>
        <div class="stack">
          <div class="card stack"><h2>Pagar</h2>
            ${waiting ? `<div class="alert ok">Recibimos tu comprobante de ${money(waiting.amount)}. Lo revisamos pronto.</div>` : ''}
            <div class="field"><label for="billMonths">¿Cuántos meses pagas?</label>
              <select id="billMonths">${[1, 3, 6, 12].map(n => `<option value="${n}">${n} ${n > 1 ? 'meses' : 'mes'} · ${money(pr.total * n)}</option>`).join('')}</select></div>
            <div class="pay-tabs"><button class="btn btn-primary" data-bill="card" data-id="${c.id}">💳 Tarjeta</button><button class="btn" data-bill="show-transfer">🏦 Transferencia</button></div>
            <div id="billTransfer" style="display:none" class="stack">
              ${db.settings.accounts.map(a => `<div class="acc"><strong>${esc(a.bank)}</strong>
                <div class="acc-row"><div><div class="k">Cuenta de ${esc(a.type.toLowerCase())}</div><div class="v">${esc(a.number)}</div></div>${copyBtn(a.number)}</div>
                <div class="acc-row"><div><div class="k">Titular</div><div class="v">${esc(a.holder)}</div></div>${copyBtn(a.holder)}</div>
                <div class="acc-row"><div><div class="k">Cédula / RUC</div><div class="v">${esc(a.idNumber)}</div></div>${copyBtn(a.idNumber)}</div></div>`).join('')}
              <button class="btn btn-block" data-bill="transfer" data-id="${c.id}">📎 Ya transferí, subir comprobante</button>
            </div>
            <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${wa(support, `Hola ${p.name} 👋, soy de ${c.name}. Tengo una consulta sobre mi suscripción.`)}">Soporte por WhatsApp</a>
          </div>
        </div>
      </div>`;
  };

  // Formulario de tarjeta. Modo prueba: no cobra nada y no guarda el número.
  API.openCardForm = function (clientId, months = 1) {
    const c = byId(db.clients, clientId), pr = priceOf(c), p = PRODUCTS[c.product];
    UI.modal(`<div class="modal-head"><h2>Pagar con tarjeta</h2><button type="button" class="icon-btn" data-bill="close" aria-label="Cerrar">✕</button></div>
      <form class="stack" id="billCard" autocomplete="off">
        <div class="test-note">Modo de prueba: no se cobra nada. Usa <strong>4242 4242 4242 4242</strong>, cualquier fecha futura y CVC. No ingreses una tarjeta real. <button type="button" class="copy" data-bill="fill-test">Usar tarjeta de prueba</button></div>
        <div class="field"><label>Nombre en la tarjeta</label><input name="name" required autocomplete="off"></div>
        <div class="field"><label>Número de tarjeta</label><input name="number" required inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000" autocomplete="off"></div>
        <div class="form-grid">
          <div class="field"><label>Vence (MM/AA)</label><input name="exp" required inputmode="numeric" maxlength="5" placeholder="08/28" autocomplete="off"></div>
          <div class="field"><label>CVC</label><input name="cvc" required inputmode="numeric" maxlength="4" placeholder="123" autocomplete="off"></div>
        </div>
        <div class="field"><label>Meses a pagar ahora</label><select name="months">${[1, 3, 6, 12].map(n => `<option value="${n}" ${n === months ? 'selected' : ''}>${n} ${n > 1 ? 'meses' : 'mes'} · ${money(pr.total * n)}</option>`).join('')}</select></div>
        <label class="consent check" style="align-items:flex-start"><input type="checkbox" name="autopay" style="margin-top:3px">
          <span>Autorizo a <strong>${esc(p.name)}</strong> a cobrar automáticamente <strong>${money(pr.total)}</strong> (IVA incluido) cada mes en esta tarjeta para mantener activo ${esc(c.name)}. Me avisarán ${db.settings.remindDays} días antes de cada cobro y puedo desactivarlo cuando quiera desde “Mi suscripción”.</span></label>
        <div class="muted small" id="billErr" style="color:var(--bad)"></div>
        <button class="btn btn-primary btn-lg btn-block" id="billPay">Pagar ${money(pr.total * months)}</button>
        <p class="muted small" style="text-align:center">🔒 En la versión real, los datos de la tarjeta los procesa la pasarela de pagos (${esc(db.settings.gateway)}); ${esc(p.name)} nunca ve ni guarda el número completo.</p>
      </form>`, m => {
      const f = m.querySelector('#billCard'), el = f.elements, btn = m.querySelector('#billPay');
      el.number.addEventListener('input', () => { el.number.value = digits(el.number.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '); });
      el.exp.addEventListener('input', () => { const d = digits(el.exp.value).slice(0, 4); el.exp.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; });
      el.months.addEventListener('change', () => { btn.textContent = `Pagar ${money(pr.total * Number(el.months.value))}`; });
      f.addEventListener('submit', e => {
        e.preventDefault();
        btn.disabled = true; btn.textContent = 'Procesando…'; m.querySelector('#billErr').textContent = '';
        setTimeout(() => {
          const r = API.payCard(clientId, Number(el.months.value), { number: el.number.value, exp: el.exp.value, cvc: el.cvc.value, name: el.name.value }, el.autopay.checked);
          if (r.error) { m.querySelector('#billErr').textContent = r.error; btn.disabled = false; btn.textContent = `Pagar ${money(pr.total * Number(el.months.value))}`; return; }
          el.number.value = ''; el.cvc.value = '';
          UI.closeModal();
          changed({ t: 'card' }); // la pantalla se actualiza al cerrar la ventana de pago
          UI.toast(`✅ Pago aprobado: ${money(r.payment.amount)} con ${r.payment.cardBrand} •••• ${r.payment.last4}${el.autopay.checked ? '. Cobro automático activado.' : ''}`, 'ok', 6000);
        }, 1200);
      });
    });
  };

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-bill]');
    if (!b) return;
    const act = b.dataset.bill, id = b.dataset.id;
    if (act === 'close') UI.closeModal();
    else if (act === 'card') API.openCardForm(id, Number((document.getElementById('billMonths') || {}).value || 1));
    else if (act === 'fill-test') { const f = document.getElementById('billCard'); f.elements.name.value = 'Prueba Demo'; f.elements.number.value = '4242 4242 4242 4242'; f.elements.exp.value = '12/' + String((new Date().getFullYear() + 2) % 100).padStart(2, '0'); f.elements.cvc.value = '123'; }
    else if (act === 'show-transfer') { const t = document.getElementById('billTransfer'); if (t) t.style.display = t.style.display === 'none' ? '' : 'none'; }
    else if (act === 'transfer') {
      try {
        const img = await UI.pickImage({ max: 1000, quality: 0.72 });
        if (!img) return;
        API.reportTransfer(id, Number((document.getElementById('billMonths') || {}).value || 1), img);
        UI.toast('Comprobante enviado. Te avisamos al aprobarlo.');
      } catch (err) { UI.toast(err.message, 'bad'); }
    } else if (act === 'autopay-off') {
      if (!confirm('¿Desactivar el cobro automático? Tendrás que pagar manualmente cada mes.')) return;
      API.cancelAutopay(id); UI.toast('Cobro automático desactivado');
    } else if (act === 'copy') {
      const v = b.dataset.v;
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(() => { const t = b.textContent; b.textContent = '¡Copiado!'; setTimeout(() => { b.textContent = t; }, 1400); }, () => UI.toast(v, 'warn'));
      else UI.toast(v, 'warn');
    }
  });

  // Cambios desde otros aparatos (ntfy) o pestañas
  if (LIVE && 'EventSource' in window) {
    const es = new EventSource(TOPIC + '/sse?since=12h');
    es.onmessage = ev => {
      let m, e;
      try { m = JSON.parse(ev.data); e = JSON.parse(m.message); } catch (err) { return; }
      if (m.event !== 'message' || seen.has(m.id) || !e || e.from === DEVICE) return;
      seen.add(m.id);
      applyRemote(e, m.attachment && m.attachment.url);
      changed({ ...e, remote: true, replay: m.time < startedAt - 5 });
    };
  }
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); changed({ remote: true }); } });
})();
