/* Panel central de Style App: el dueño del producto controla las peluquerías y sus pagos */
(function () {
  const app = document.getElementById('app');
  const esc = U.esc;
  const C = Central;
  const SESSION = 'stylecita_central_session';
  const state = { q: '', filter: 'todos' };
  const NAV = [['resumen', 'Resumen', 'home'], ['salones', 'Peluquerías', 'scissors'], ['pagos', 'Pagos', 'cash'], ['ajustes', 'Ajustes', 'settings']];
  const route = () => (location.hash.replace(/^#\/?/, '') || 'resumen').split('?')[0];
  const closeBtn = `<button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">${UI.icon('close')}</button>`;
  const stat = (label, value, sub = '', cls = '') => `<div class="card stat"><div class="label">${label}</div><div class="value">${value}</div><div class="sub ${cls}">${sub}</div></div>`;
  const badge = s => UI.badge(C.STATUS[C.statusOf(s)]);
  const fmtD = d => d ? U.fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // Mensajes de WhatsApp al dueño del salón
  function waSalon(s, kind) {
    const day = d => d ? U.fmtDate(d, { day: 'numeric', month: 'long' }) : '—';
    const until = day(s.paidUntil), name = U.first(s.owner);
    const msgs = {
      vence: () => `Hola ${name} 👋, te escribimos de Style App. Tu suscripción de ${s.name} vence el ${until}. Puedes pagar ${U.money(C.TOTAL)} por transferencia y subir el comprobante en tu panel, sección “Mi suscripción”. ¡Gracias!`,
      vencido: () => `Hola ${name}, tu suscripción de Style App para ${s.name} venció el ${until}. Para que tu panel no se pause, reporta tu pago en “Mi suscripción”. Cualquier duda, aquí estamos 🙏`,
      prueba: () => `Hola ${name} 👋, ¿cómo te va con Style App en ${s.name}? Tu prueba gratis termina el ${day(s.trialUntil)}. El plan cuesta ${U.money(C.PRICE)} + IVA al mes. ¿Te ayudo a activarlo?`,
      aprobado: () => `Hola ${name}, recibimos tu pago de Style App ✅. ${s.name} queda activo hasta el ${until}. ¡Gracias por confiar en nosotros!`,
    };
    return U.waLink(s.phone, (msgs[kind] || msgs.vence)());
  }
  function remindKind(s) {
    const st = C.statusOf(s);
    return st === 'prueba' ? 'prueba' : st === 'por_vencer' || st === 'activo' ? 'vence' : 'vencido';
  }

  /* ---------------- Render ---------------- */
  function render() {
    if (sessionStorage.getItem(SESSION) !== '1') return renderLogin();
    let page = route();
    if (!PAGES[page]) page = 'resumen';
    const m = C.metrics();
    const counts = { pagos: m.toReview.length, salones: m.by.vencido + m.by.por_vencer };
    const scroll = window.scrollY;
    app.innerHTML = `<div class="layout">
      <aside class="sidebar">
        <div class="brand"><img src="../shared/icon.svg" alt=""><div>Style App<small>Central</small></div></div>
        <nav class="nav" aria-label="Secciones">
          ${NAV.map(([k, l, i]) => `<a href="#/${k}" class="${k === page ? 'active' : ''}" ${k === page ? 'aria-current="page"' : ''}>${UI.icon(i, 18)}<span>${l}</span>${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('')}
          <a href="#" class="logout" data-action="logout">${UI.icon('logout', 18)}<span>Salir</span></a>
        </nav>
      </aside>
      <main class="main">${PAGES[page]()}</main>
    </div>`;
    if (render.lastPage === page) window.scrollTo(0, scroll);
    render.lastPage = page;
  }
  function renderLogin() {
    app.innerHTML = `<div class="center-screen"><form class="card login-card stack" data-form="login">
      <div class="brand-lg"><img src="../shared/icon.svg" alt="" style="width:46px;height:46px;border-radius:12px"><div><h1>Style App</h1><div class="muted small">Panel central</div></div></div>
      <div class="field"><label for="pin">PIN</label><input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required autofocus></div>
      <button class="btn btn-primary btn-block btn-lg">Entrar</button>
      <p class="muted small" style="text-align:center">Demo: PIN <strong>2468</strong></p>
    </form></div>`;
  }

  /* ---------------- Páginas ---------------- */
  const PAGES = {
    resumen() {
      const m = C.metrics();
      return `<div class="page-head"><div><h1>Resumen</h1><div class="muted">${U.cap(U.fmtLong(U.today()))}</div></div>
        <button class="btn btn-primary" data-action="new-salon">${UI.icon('plus', 18)} Nueva peluquería</button></div>
      <div class="grid g4">
        ${stat('Peluquerías pagando', m.paying, `${m.total} registradas · ${m.by.prueba} en prueba`)}
        ${stat('Ingreso mensual (MRR)', U.money(m.mrr), `${m.paying} × ${U.money(C.PRICE)} sin IVA`)}
        ${stat('Cobrado este mes', U.money(m.collected), `incluye ${U.money(m.ivaCollected)} de IVA`)}
        ${stat('Pagos por revisar', m.toReview.length, m.toReview.length ? 'revisa los comprobantes' : 'todo al día', m.toReview.length ? 'warn' : 'ok')}
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="row between"><h2>Comprobantes por revisar</h2><a class="btn btn-sm" href="#/pagos">Ver pagos</a></div>
          ${m.toReview.length ? m.toReview.map(payRow).join('') : '<div class="empty">No hay comprobantes nuevos 🎉</div>'}</div>
        <div class="card"><h2>Hay que escribirles</h2>
          ${m.dueSoon.length ? m.dueSoon.map(s => `<div class="list-item clickable" data-action="salon" data-id="${s.id}"><div class="grow"><strong>${esc(s.name)}</strong>
            <div class="muted small">${C.statusOf(s) === 'prueba' ? `Prueba hasta ${fmtD(s.trialUntil)}` : `Pagado hasta ${fmtD(s.paidUntil)}`}</div></div>${badge(s)}
            <a class="btn btn-sm btn-wa" data-action="noop" target="_blank" rel="noopener" href="${waSalon(s, remindKind(s))}">${UI.icon('whatsapp', 16)} Recordar</a></div>`).join('') : '<div class="empty">Nadie por vencer</div>'}</div>
      </div>
      <div class="card mt"><h2>Estado de las peluquerías</h2><div class="row wrap mt">
        ${Object.entries(C.STATUS).map(([k, v]) => `<span class="badge ${v.cls}" style="font-size:.85rem;padding:6px 12px">${v.label}: ${m.by[k]}</span>`).join('')}</div></div>`;
    },

    salones() {
      const filters = { todos: 'Todas', activo: 'Al día', por_vencer: 'Por vencer', vencido: 'Vencidas', suspendido: 'Suspendidas', prueba: 'En prueba' };
      return `<div class="page-head"><div><h1>Peluquerías</h1><div class="muted">${C.salons().length} registradas</div></div>
        <button class="btn btn-primary" data-action="new-salon">${UI.icon('plus', 18)} Nueva peluquería</button></div>
        <div class="card"><div class="row wrap toolbar"><input id="q" type="search" placeholder="Buscar por nombre, dueño o ciudad" value="${esc(state.q)}" aria-label="Buscar">
          <div class="chips">${Object.entries(filters).map(([k, l]) => `<button class="chip ${state.filter === k ? 'active' : ''}" data-action="filter" data-f="${k}">${l}</button>`).join('')}</div></div>
          <div class="table-wrap"><table><thead><tr><th>Peluquería</th><th>Estado</th><th class="hide-sm">Pagado hasta</th><th class="hide-sm">Estilistas</th><th></th></tr></thead><tbody id="rows">${salonRows()}</tbody></table></div></div>`;
    },

    pagos() {
      const all = C.payments();
      const review = all.filter(p => p.status === 'en_revision'), done = all.filter(p => p.status !== 'en_revision');
      return `<div class="page-head"><div><h1>Pagos</h1><div class="muted">Comprobantes que reportan las peluquerías</div></div></div>
        <div class="card"><h2>Por revisar</h2>${review.length ? review.map(payRow).join('') : '<div class="empty">No hay comprobantes por revisar</div>'}</div>
        <div class="card mt"><h2>Historial</h2>${done.length ? done.map(payRow).join('') : '<div class="empty">Sin pagos</div>'}</div>`;
    },

    ajustes() {
      const s = C.settings;
      return `<div class="page-head"><div><h1>Ajustes</h1><div class="muted">Cuentas donde te pagan las peluquerías y reglas de cobro</div></div></div>
      <div class="grid g2">
        <div class="card stack"><h2>Tus cuentas para cobrar</h2>
          <p class="muted small">Las peluquerías las ven en “Mi suscripción” para transferirte.</p>
          ${s.accounts.map(a => `<div class="acc"><div class="row between"><strong>${esc(a.bank)}</strong><button class="btn btn-sm" data-action="account" data-id="${a.id}">${UI.icon('edit', 16)} Editar</button></div>
            <div class="small">${esc(a.type)} · ${esc(a.number)}</div><div class="muted small">${esc(a.holder)} · CI/RUC ${esc(a.idNumber)}</div></div>`).join('')}
          <button class="btn" data-action="account">${UI.icon('plus', 18)} Agregar cuenta</button></div>
        <form class="card stack" data-form="settings"><h2>Reglas de cobro</h2>
          <div class="list-item"><span class="grow">Precio por peluquería</span><strong>${U.money(C.PRICE)} + IVA ${Math.round(C.IVA * 100)}% = ${U.money(C.TOTAL)}/mes</strong></div>
          <div class="form-grid">
            <div class="field"><label>Días de gracia después de vencer</label><input name="graceDays" type="number" min="0" max="30" value="${s.graceDays}"></div>
            <div class="field"><label>Días de prueba gratis</label><input name="trialDays" type="number" min="0" max="60" value="${s.trialDays}"></div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Tu WhatsApp de soporte</label><input name="whatsapp" value="${esc(s.whatsapp)}" inputmode="tel"></div>
            <div class="field"><label>PIN del panel central</label><input name="pin" value="${esc(s.pin)}" inputmode="numeric"></div>
          </div>
          <button class="btn btn-primary">Guardar</button>
          <button type="button" class="btn btn-danger" data-action="reset">Reiniciar demo</button>
        </form>
      </div>`;
    },
  };

  function salonRows() {
    const q = state.q.trim().toLowerCase();
    const list = C.salons().filter(s => (state.filter === 'todos' || C.statusOf(s) === state.filter) && (!q || `${s.name} ${s.owner} ${s.city}`.toLowerCase().includes(q)));
    if (!list.length) return '<tr><td colspan="5" class="empty">Sin resultados</td></tr>';
    return list.map(s => `<tr class="clickable" data-action="salon" data-id="${s.id}">
      <td><strong>${esc(s.name)}</strong><div class="muted small">${esc(s.owner)} · ${esc(s.city)}</div></td>
      <td>${badge(s)}</td><td class="hide-sm">${C.statusOf(s) === 'prueba' ? 'Prueba: ' + fmtD(s.trialUntil) : fmtD(s.paidUntil)}</td><td class="hide-sm">${s.staff}</td>
      <td class="actions"><a class="btn btn-sm btn-wa" data-action="noop" target="_blank" rel="noopener" href="${waSalon(s, remindKind(s))}" aria-label="WhatsApp">${UI.icon('whatsapp', 16)}</a></td></tr>`).join('');
  }

  function payRow(p) {
    const s = C.salon(p.salonId) || { name: 'Peluquería', owner: '' };
    return `<div class="list-item clickable" data-action="payment" data-id="${p.id}">
      <span class="prod-thumb">${p.receipt ? `<img src="${p.receipt}" alt="">` : '🧾'}</span>
      <div class="grow"><strong>${esc(s.name)}</strong><div class="muted small">${U.money(p.amount)} · ${p.months} ${p.months > 1 ? 'meses' : 'mes'} · ${U.fmtDate(p.createdAt)}</div></div>
      ${UI.badge(C.PAY_STATUS[p.status])}${p.status === 'en_revision' ? '<span class="btn btn-sm btn-primary">Revisar</span>' : ''}</div>`;
  }

  /* ---------------- Modales ---------------- */
  function openPayment(id) {
    const p = C.payments().find(x => x.id === id), s = C.salon(p.salonId);
    const base = Math.round(p.amount / (1 + C.IVA) * 100) / 100;
    UI.modal(`<div class="modal-head"><h2>Pago de ${esc(s.name)}</h2>${closeBtn}</div>
      <div class="stack">
        <div class="row wrap">${UI.badge(C.PAY_STATUS[p.status])}${badge(s)}</div>
        <div class="note"><div class="row between"><span>${p.months} ${p.months > 1 ? 'meses' : 'mes'} de suscripción</span><strong>${U.money(p.amount)}</strong></div>
          <div class="muted small">Base ${U.money(base)} + IVA ${U.money(p.amount - base)} · reportado el ${U.fmtDate(p.createdAt)}</div>
          <div class="muted small">Pagado hasta ${fmtD(s.paidUntil)}${p.status === 'en_revision' ? ` → al aprobar queda hasta ${fmtD(nextUntil(s, p.months))}` : ''}</div></div>
        ${p.receipt ? `<img class="receipt-big" src="${p.receipt}" alt="Comprobante">` : '<div class="empty">Sin imagen</div>'}
      </div>
      <div class="modal-actions">
        ${p.status === 'en_revision' ? `<button class="btn btn-danger" data-action="review" data-ok="0" data-id="${p.id}">Rechazar</button><span class="spacer"></span><button class="btn btn-primary" data-action="review" data-ok="1" data-id="${p.id}">${UI.icon('check', 18)} Aprobar pago</button>`
          : `<a class="btn btn-wa" target="_blank" rel="noopener" href="${waSalon(s, p.status === 'aprobado' ? 'aprobado' : 'vencido')}">${UI.icon('whatsapp', 18)} Escribir a ${esc(U.first(s.owner))}</a>`}
      </div>`);
  }
  function nextUntil(s, months) {
    const base = s.paidUntil && s.paidUntil > U.today() ? s.paidUntil : U.today();
    const d = U.parseISO(base); d.setMonth(d.getMonth() + months); return U.toISO(d);
  }

  function openSalon(id) {
    const s = C.salon(id), st = C.statusOf(s), pays = C.payments({ salonId: id });
    const paid = pays.filter(p => p.status === 'aprobado').reduce((t, p) => t + p.amount, 0);
    const link = new URL('../admin/', location.href).href;
    UI.modal(`<div class="modal-head"><div><h2>${esc(s.name)}</h2><div class="muted small">${esc(s.owner)} · ${esc(s.phone)} · ${esc(s.city)}</div></div>${closeBtn}</div>
      <div class="grid g3"><div class="mini-stat"><div class="value">${s.staff}</div><div class="label">Estilistas</div></div>
        <div class="mini-stat"><div class="value">${U.money(paid)}</div><div class="label">Te ha pagado</div></div>
        <div class="mini-stat"><div class="value">${U.fmtDate(s.since, { month: 'short', year: '2-digit' })}</div><div class="label">Cliente desde</div></div></div>
      <div class="note mt"><div class="row between">${badge(s)}<span class="small">${st === 'prueba' ? 'Prueba hasta ' + fmtD(s.trialUntil) : 'Pagado hasta ' + fmtD(s.paidUntil)}</span></div>
        <div class="muted small" style="margin-top:6px">Puede usar el panel hasta el ${fmtD(C.accessUntil(s))} (incluye ${C.settings.graceDays} días de gracia).</div></div>
      ${s.pin ? `<div class="note mt small">Acceso del salón: <strong>${esc(link)}</strong> · PIN <strong>${esc(s.pin)}</strong></div>` : ''}
      <div class="row wrap mt">
        <a class="btn btn-wa" target="_blank" rel="noopener" href="${waSalon(s, remindKind(s))}">${UI.icon('whatsapp', 18)} ${st === 'prueba' ? 'Escribir sobre la prueba' : 'Recordar pago'}</a>
        ${s.suspended ? `<button class="btn btn-primary" data-action="suspend" data-v="0" data-id="${s.id}">Reactivar</button>` : `<button class="btn btn-danger" data-action="suspend" data-v="1" data-id="${s.id}">Pausar acceso</button>`}
      </div>
      <h3>Pagos</h3>${pays.length ? pays.map(payRow).join('') : '<div class="empty">Sin pagos todavía</div>'}`);
  }

  function salonForm() {
    UI.modal(`<div class="modal-head"><h2>Nueva peluquería</h2>${closeBtn}</div>
      <form class="stack" data-form="salon">
        <div class="field"><label>Nombre del salón</label><input name="name" required></div>
        <div class="form-grid">
          <div class="field"><label>Dueño o dueña</label><input name="owner" required></div>
          <div class="field"><label>WhatsApp</label><input name="phone" required inputmode="tel" placeholder="09…"></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Ciudad</label><input name="city" value="Manta"></div>
          <div class="field"><label>Estilistas</label><input name="staff" type="number" min="1" value="2"></div>
        </div>
        <p class="muted small">Empieza con ${C.settings.trialDays} días de prueba gratis. Al guardar te damos su PIN de acceso.</p>
        <div class="modal-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">Crear</button></div>
      </form>`);
  }

  function accountForm(id) {
    const a = id ? C.settings.accounts.find(x => x.id === id) : { bank: '', type: 'Ahorros', number: '', holder: '', idNumber: '' };
    UI.modal(`<div class="modal-head"><h2>${id ? 'Editar cuenta' : 'Nueva cuenta'}</h2>${closeBtn}</div>
      <form class="stack" data-form="account" data-id="${id || ''}">
        <div class="form-grid">
          <div class="field"><label>Banco</label><input name="bank" required value="${esc(a.bank)}" list="banks"><datalist id="banks">${SalonDB.BANKS.map(b => `<option value="${b}"></option>`).join('')}</datalist></div>
          <div class="field"><label>Tipo</label><select name="type">${['Ahorros', 'Corriente'].map(t => `<option ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Número de cuenta</label><input name="number" required inputmode="numeric" value="${esc(a.number)}"></div>
        <div class="field"><label>Titular</label><input name="holder" required value="${esc(a.holder)}"></div>
        <div class="field"><label>Cédula o RUC</label><input name="idNumber" required inputmode="numeric" maxlength="13" value="${esc(a.idNumber)}"></div>
        <div class="modal-actions">${id ? `<button type="button" class="btn btn-danger" data-action="del-account" data-id="${id}">${UI.icon('trash', 18)} Eliminar</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">Guardar</button></div>
      </form>`);
  }

  /* ---------------- Acciones ---------------- */
  const ACTIONS = {
    noop() {},
    close: () => UI.closeModal(),
    logout() { sessionStorage.removeItem(SESSION); render(); },
    'new-salon': salonForm,
    salon: (el, id) => openSalon(id),
    payment: (el, id) => openPayment(id),
    filter(el) { state.filter = el.dataset.f; render(); },
    review(el, id) {
      const ok = el.dataset.ok === '1';
      if (!ok && !confirm('¿Rechazar este comprobante? La peluquería podrá subir otro.')) return;
      const p = C.review(id, ok);
      render(); openPayment(id);
      UI.toast(ok ? `Pago aprobado. ${C.salon(p.salonId).name} queda al día.` : 'Comprobante rechazado', ok ? 'ok' : 'warn');
    },
    suspend(el, id) {
      const v = el.dataset.v === '1';
      if (v && !confirm('¿Pausar el acceso de esta peluquería? Sus datos se guardan y puede reactivarse al pagar.')) return;
      C.setSuspended(id, v); render(); openSalon(id);
      UI.toast(v ? 'Acceso pausado' : 'Acceso reactivado');
    },
    account: (el, id) => accountForm(id),
    'del-account'(el, id) { if (!confirm('¿Eliminar esta cuenta?')) return; C.deleteAccount(id); UI.closeModal(); render(); },
    reset() { if (!confirm('¿Reiniciar los datos de ejemplo del panel central?')) return; C.reset(); render(); UI.toast('Demo reiniciada'); },
  };
  const FORMS = {
    login(f) {
      if (f.elements.pin.value === String(C.settings.pin)) { sessionStorage.setItem(SESSION, '1'); render(); }
      else { UI.toast('PIN incorrecto', 'bad'); f.elements.pin.select(); }
    },
    salon(f) {
      const d = UI.formData(f);
      if (U.phone(d.phone).length < 9) return UI.toast('Revisa el número de WhatsApp', 'bad');
      const s = C.createSalon({ name: d.name.trim(), owner: d.owner.trim(), phone: d.phone, city: d.city.trim(), staff: d.staff });
      render(); openSalon(s.id);
      UI.toast(`${s.name} creada con ${C.settings.trialDays} días de prueba`);
    },
    account(f) {
      const d = UI.formData(f);
      if (!validId(d.idNumber)) return UI.toast('La cédula o RUC no es válido', 'bad');
      C.saveAccount({ id: f.dataset.id || null, bank: d.bank.trim(), type: d.type, number: d.number.trim(), holder: d.holder.trim(), idNumber: U.phone(d.idNumber) });
      UI.closeModal(); render(); UI.toast('Cuenta guardada');
    },
    settings(f) {
      const d = UI.formData(f);
      C.saveSettings({ graceDays: Number(d.graceDays) || 0, trialDays: Number(d.trialDays) || 0, whatsapp: d.whatsapp.trim(), pin: d.pin.trim() || C.settings.pin });
      render(); UI.toast('Ajustes guardados');
    },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || !ACTIONS[el.dataset.action]) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    ACTIONS[el.dataset.action](el, el.dataset.id);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    FORMS[f.dataset.form](f);
  });
  document.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; document.getElementById('rows').innerHTML = salonRows(); } });
  window.addEventListener('hashchange', () => { UI.closeModal(); render(); });
  // Una peluquería reportó un pago (desde su panel, en otro aparato)
  window.addEventListener('central-change', e => {
    const d = e.detail || {};
    if (!UI.isModalOpen()) render();
    if (d.remote && !d.replay && d.t === 'subpay') {
      const s = C.salon(d.payment.salonId);
      UI.toast(`🧾 ${s ? s.name : 'Una peluquería'} reportó un pago de ${U.money(d.payment.amount)}`, 'ok big', 8000);
    }
  });
  render();
})();
