/* Suscripciones de StyleCita: los salones que pagan, sus pagos reportados y su estado.
   Lo usan el panel central (dueño de StyleCita) y la sección "Mi suscripción" de cada salón.
   Demo: guarda en localStorage y comparte los cambios en vivo por ntfy.sh (tema público, solo datos
   de prueba). En producción va en Supabase, con cada salón viendo solo lo suyo. */
(function () {
  const KEY = 'stylecita_central_v1';
  const VERSION = 1;
  const PRICE = 35, IVA = 0.15;
  const TOTAL = Math.round(PRICE * (1 + IVA) * 100) / 100; // 40.25
  const DEMO_SALON = 'sal-demo'; // el salón de la demo ("Estilo & Color")
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

  const addMonths = (iso, n) => { const d = U.parseISO(iso); d.setMonth(d.getMonth() + n); return U.toISO(d); };

  function seed() {
    const t = U.today();
    const S = (id, name, owner, phone, city, staff, since, paidUntil, extra = {}) => ({ id, name, owner, phone, city, staff, since, paidUntil, suspended: false, trialUntil: null, notes: '', ...extra });
    const salons = [
      S(DEMO_SALON, 'Estilo & Color', 'María Estilo Color', '0991234567', 'Manta', 4, U.addDays(t, -95), U.addDays(t, 3)),
      S('sal-2', 'Barbería El Patrón', 'Jorge Delgado', '0987001122', 'Manta', 3, U.addDays(t, -150), U.addDays(t, 18)),
      S('sal-3', 'Glamour Studio', 'Daniela Macías', '0998112233', 'Portoviejo', 5, U.addDays(t, -60), U.addDays(t, 25)),
      S('sal-4', 'Nails & Beauty Ana', 'Ana Zambrano', '0979223344', 'Manta', 2, U.addDays(t, -40), U.addDays(t, -2)),
      S('sal-5', 'Corte Fino', 'Luis Mendoza', '0968334455', 'Montecristi', 2, U.addDays(t, -120), U.addDays(t, -12), { suspended: true }),
      S('sal-6', 'Bella Vida Spa', 'Fernanda Ponce', '0995445566', 'Portoviejo', 6, U.addDays(t, -20), U.addDays(t, 10)),
      S('sal-7', 'Studio K', 'Kevin Anchundia', '0984556677', 'Manta', 1, U.addDays(t, -5), null, { trialUntil: U.addDays(t, 9) }),
    ];
    const receipt = (amount, who) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420"><rect width="320" height="420" fill="#f3f6fb"/><rect width="320" height="90" fill="#1f3a8a"/><text x="160" y="52" font-family="Arial" font-size="18" fill="#fff" text-anchor="middle" font-weight="bold">Banco Guayaquil</text><text x="160" y="150" font-family="Arial" font-size="16" fill="#0f1b3d" text-anchor="middle" font-weight="bold">Transferencia exitosa</text><text x="160" y="200" font-family="Arial" font-size="32" fill="#0f1b3d" text-anchor="middle" font-weight="bold">$${amount.toFixed(2)}</text><text x="30" y="260" font-family="Arial" font-size="13" fill="#5b6882">De</text><text x="290" y="260" font-family="Arial" font-size="13" fill="#0f1b3d" text-anchor="end">${who}</text><text x="30" y="290" font-family="Arial" font-size="13" fill="#5b6882">Para</text><text x="290" y="290" font-family="Arial" font-size="13" fill="#0f1b3d" text-anchor="end">StyleCita</text><text x="30" y="320" font-family="Arial" font-size="13" fill="#5b6882">Concepto</text><text x="290" y="320" font-family="Arial" font-size="13" fill="#0f1b3d" text-anchor="end">Suscripción</text><text x="160" y="395" font-family="Arial" font-size="10" fill="#98a1b0" text-anchor="middle">Imagen de ejemplo para la demo</text></svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };
    const P = (id, salonId, months, status, daysAgo, who) => ({ id, salonId, months, amount: TOTAL * months, status, receipt: receipt(TOTAL * months, who), createdAt: U.addDays(t, -daysAgo), reviewedAt: status === 'en_revision' ? null : U.addDays(t, -daysAgo) });
    const payments = [
      P('pay-1', 'sal-4', 1, 'en_revision', 0, 'Ana Zambrano'),
      P('pay-2', 'sal-2', 1, 'aprobado', 12, 'Jorge Delgado'),
      P('pay-3', 'sal-3', 1, 'aprobado', 5, 'Daniela Macías'),
      P('pay-4', 'sal-6', 1, 'aprobado', 20, 'Fernanda Ponce'),
      P('pay-5', DEMO_SALON, 1, 'aprobado', 27, 'María Estilo Color'),
      P('pay-6', 'sal-2', 1, 'aprobado', 42, 'Jorge Delgado'),
      P('pay-7', 'sal-5', 1, 'rechazado', 15, 'Luis Mendoza'),
    ];
    return {
      version: VERSION,
      settings: {
        pin: '2468', graceDays: 5, trialDays: 14, whatsapp: '0980781862',
        accounts: [{ id: 'acc1', bank: 'Banco Pichincha', type: 'Ahorros', number: '2200000000', holder: 'Datos de ejemplo — cámbialos en Ajustes', idNumber: '1312345679', email: '' }],
      },
      salons, payments,
    };
  }

  let db;
  const load = () => {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || db.version !== VERSION) { db = seed(); save(); }
  };
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { window.dispatchEvent(new Event('salondb-save-error')); }
  }
  load();
  const byId = (list, id) => list.find(x => x.id === id);
  const changed = detail => window.dispatchEvent(new CustomEvent('central-change', { detail: detail || {} }));

  /* ---------- Estado de un salón ---------- */
  function statusOf(s) {
    const t = U.today();
    if (s.suspended) return 'suspendido';
    if (!s.paidUntil && s.trialUntil) return s.trialUntil >= t ? 'prueba' : 'suspendido';
    if (!s.paidUntil) return 'suspendido';
    if (s.paidUntil >= U.addDays(t, 5)) return 'activo';
    if (s.paidUntil >= t) return 'por_vencer';
    return s.paidUntil >= U.addDays(t, -db.settings.graceDays) ? 'vencido' : 'suspendido';
  }
  // Hasta cuándo puede usar la app (pagado + gracia, o fin de la prueba)
  const accessUntil = s => s.paidUntil ? U.addDays(s.paidUntil, db.settings.graceDays) : s.trialUntil;

  /* ---------- Cambios (se comparten en vivo con los demás aparatos) ---------- */
  function apply(e) {
    if (e.t === 'subpay') {
      if (!byId(db.payments, e.payment.id)) db.payments.push(e.payment);
    } else if (e.t === 'subreview') {
      const p = byId(db.payments, e.id);
      if (p) { p.status = e.status; p.reviewedAt = e.reviewedAt; }
      const s = byId(db.salons, e.salonId);
      if (s && e.salon) Object.assign(s, e.salon);
    } else if (e.t === 'salon') {
      const s = byId(db.salons, e.salon.id);
      if (s) Object.assign(s, e.salon); else db.salons.push(e.salon);
    } else return;
    save();
  }
  let publish = () => {};

  const API = {
    PRICE, IVA, TOTAL, STATUS, PAY_STATUS, DEMO_SALON,
    get settings() { return db.settings; },
    saveSettings(patch) { Object.assign(db.settings, patch); save(); },
    reset() { localStorage.removeItem(KEY); load(); },
    salons: () => db.salons,
    salon: id => byId(db.salons, id),
    statusOf, accessUntil,
    payments: ({ salonId } = {}) => db.payments.filter(p => !salonId || p.salonId === salonId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),

    // El salón reporta su pago con la foto del comprobante
    reportPayment(salonId, months, receipt) {
      const p = { id: 'pay-' + U.uid(), salonId, months, amount: Math.round(TOTAL * months * 100) / 100, status: 'en_revision', receipt, createdAt: U.today(), reviewedAt: null };
      db.payments.push(p); save(); changed({ t: 'subpay' });
      publish({ t: 'subpay', payment: { ...p, receipt: null } }, receipt);
      return p;
    },
    // Al aprobar, el salón queda pagado por los meses que reportó (desde su vencimiento o desde hoy)
    review(id, ok) {
      const p = byId(db.payments, id);
      if (!p) return;
      p.status = ok ? 'aprobado' : 'rechazado';
      p.reviewedAt = U.today();
      const s = byId(db.salons, p.salonId);
      if (ok && s) {
        const base = s.paidUntil && s.paidUntil > U.today() ? s.paidUntil : U.today();
        s.paidUntil = addMonths(base, p.months);
        s.suspended = false;
      }
      save(); changed({ t: 'subreview' });
      publish({ t: 'subreview', id, status: p.status, reviewedAt: p.reviewedAt, salonId: p.salonId, salon: s ? { paidUntil: s.paidUntil, suspended: s.suspended } : null });
      return p;
    },
    setSuspended(salonId, value) {
      const s = byId(db.salons, salonId);
      if (!s) return;
      s.suspended = value; save(); changed({ t: 'salon' });
      publish({ t: 'salon', salon: { id: s.id, suspended: s.suspended } });
    },
    // Alta de un salón nuevo con días de prueba gratis
    createSalon({ name, owner, phone, city, staff }) {
      const s = { id: 'sal-' + U.uid(), name, owner, phone: U.phone(phone), city, staff: Number(staff) || 1, since: U.today(), paidUntil: null, suspended: false, trialUntil: U.addDays(U.today(), db.settings.trialDays), notes: '', pin: String(Math.floor(1000 + Math.random() * 9000)) };
      db.salons.push(s); save(); changed({ t: 'salon' });
      publish({ t: 'salon', salon: s });
      return s;
    },
    saveAccount(acc) {
      if (!acc.id) acc.id = 'acc' + U.uid();
      const i = db.settings.accounts.findIndex(a => a.id === acc.id);
      if (i >= 0) db.settings.accounts[i] = { ...db.settings.accounts[i], ...acc }; else db.settings.accounts.push(acc);
      save(); return acc;
    },
    deleteAccount(id) { db.settings.accounts = db.settings.accounts.filter(a => a.id !== id); save(); },

    /* Números del negocio StyleCita */
    metrics() {
      const t = U.today(), month = U.month(t);
      const by = {}; Object.keys(STATUS).forEach(k => { by[k] = 0; });
      db.salons.forEach(s => { by[statusOf(s)]++; });
      const paying = by.activo + by.por_vencer + by.vencido;
      const approvedMonth = db.payments.filter(p => p.status === 'aprobado' && U.month(p.reviewedAt || p.createdAt) === month);
      const collected = approvedMonth.reduce((s, p) => s + p.amount, 0);
      return {
        by, paying, total: db.salons.length,
        mrr: paying * PRICE, // ingreso mensual recurrente, sin IVA
        collected, ivaCollected: Math.round(collected / (1 + IVA) * IVA * 100) / 100,
        toReview: db.payments.filter(p => p.status === 'en_revision'),
        dueSoon: db.salons.filter(s => ['por_vencer', 'vencido', 'prueba'].includes(statusOf(s))).sort((a, b) => (accessUntil(a) || '').localeCompare(accessUntil(b) || '')),
      };
    },
  };
  window.Central = API;

  /* ---------- En vivo entre aparatos (demo, ntfy.sh) ---------- */
  const BASE = 'https://ntfy.sh/stylecita-central-q7k2m9x4';
  const DEVICE = U.uid();
  const startedAt = Date.now() / 1000;
  const seen = new Set();
  publish = async (evt, image) => {
    const msg = JSON.stringify({ ...evt, from: DEVICE });
    try {
      if (image) {
        const blob = await (await fetch(image)).blob();
        await fetch(BASE, { method: 'PUT', body: blob, headers: { 'X-Filename': 'comprobante.jpg', 'X-Message': msg } });
      } else await fetch(BASE, { method: 'POST', body: msg });
    } catch (e) { /* sin internet: queda guardado en este aparato */ }
  };
  if ('EventSource' in window) {
    const es = new EventSource(BASE + '/sse?since=12h');
    es.onmessage = ev => {
      let m, e;
      try { m = JSON.parse(ev.data); e = JSON.parse(m.message); } catch (err) { return; }
      if (m.event !== 'message' || seen.has(m.id) || !e || e.from === DEVICE) return;
      seen.add(m.id);
      if (e.t === 'subpay' && m.attachment) e.payment.receipt = m.attachment.url;
      apply(e);
      changed({ ...e, remote: true, replay: m.time < startedAt - 5 });
    };
  }
  // Otra pestaña del mismo navegador
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); changed({ remote: true }); } });
})();
