/* Panel principal del dueño: controla los gimnasios (KadaMeta) y las peluquerías (Style App),
   quién pagó, quién no, cobros con tarjeta y cobros automáticos. Datos en shared/billing.js */
(function () {
  const app = document.getElementById('app');
  const esc = U.esc;
  const B = Billing;
  const SESSION = 'kowner_session';
  const state = { product: 'todo', q: '', filter: 'todos' };
  const NAV = [['resumen', 'Resumen', 'home'], ['clientes', 'Clientes', 'users'], ['pagos', 'Pagos', 'cash'], ['automaticos', 'Cobros automáticos', 'clock'], ['ajustes', 'Ajustes', 'settings']];
  const route = () => (location.hash.replace(/^#\/?/, '') || 'resumen').split('?')[0];
  const closeBtn = `<button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">${UI.icon('close')}</button>`;
  const stat = (label, value, sub = '', cls = '') => `<div class="card stat"><div class="label">${label}</div><div class="value">${value}</div><div class="sub ${cls}">${sub}</div></div>`;
  const badge = c => UI.badge(B.STATUS[B.statusOf(c)]);
  const fmtD = d => d ? B.fmt(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const prodTag = key => { const p = B.PRODUCTS[key]; return `<span class="prod-tag" style="--c:${p.color}">${esc(p.name)}</span>`; };
  const remindKind = c => { const s = B.statusOf(c); return s === 'prueba' ? 'prueba' : s === 'vencido' || s === 'suspendido' ? 'vencido' : 'vence'; };
  const scopeName = () => state.product === 'todo' ? 'todos tus clientes' : B.PRODUCTS[state.product].units;

  /* ---------------- Render ---------------- */
  function render() {
    if (sessionStorage.getItem(SESSION) !== '1') return renderLogin();
    let page = route();
    if (!PAGES[page]) page = 'resumen';
    const m = B.metrics(state.product);
    const counts = { pagos: m.toReview.length, clientes: m.by.vencido + m.by.por_vencer };
    const scroll = window.scrollY;
    app.innerHTML = `<div class="layout">
      <aside class="sidebar">
        <div class="brand"><img src="../shared/icon.svg" alt=""><div>Panel del dueño<small>KadaMeta · Style App</small></div></div>
        <div class="seg" role="tablist" aria-label="Producto">${[['todo', 'Todo'], ['gym', 'KadaMeta'], ['salon', 'Style App']].map(([k, l]) => `<button class="${state.product === k ? 'on' : ''}" data-action="product" data-p="${k}" role="tab" aria-selected="${state.product === k}">${l}</button>`).join('')}</div>
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
      <div class="brand-lg"><img src="../shared/icon.svg" alt="" style="width:46px;height:46px;border-radius:12px"><div><h1>Panel del dueño</h1><div class="muted small">KadaMeta · Style App</div></div></div>
      <div class="field"><label for="pin">PIN</label><input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required autofocus></div>
      <button class="btn btn-primary btn-block btn-lg">Entrar</button>
      <p class="muted small" style="text-align:center">Demo: PIN <strong>2468</strong></p>
    </form></div>`;
  }

  /* ---------------- Páginas ---------------- */
  const PAGES = {
    resumen() {
      const m = B.metrics(state.product), up = B.upcomingCharges(7).filter(c => state.product === 'todo' || c.product === state.product);
      const byProd = Object.keys(B.PRODUCTS).map(k => ({ k, m: B.metrics(k) }));
      const maxMrr = Math.max(1, ...byProd.map(x => x.m.mrr));
      return `<div class="page-head"><div><h1>Resumen</h1><div class="muted">${U.cap(U.fmtLong(U.today()))} · ${scopeName()}</div></div>
        <button class="btn btn-primary" data-action="new-client">${UI.icon('plus', 18)} Nuevo cliente</button></div>
      <div class="grid g4">
        ${stat('Clientes pagando', m.paying, `${m.total} registrados · ${m.by.prueba} en prueba`)}
        ${stat('Ingreso mensual (MRR)', U.money(m.mrr), 'sin IVA')}
        ${stat('Cobrado este mes', U.money(m.collected), `incluye ${U.money(m.iva)} de IVA`)}
        ${stat('Con cobro automático', m.autopay, `${m.toReview.length} comprobantes por revisar`, m.toReview.length ? 'warn' : 'ok')}
      </div>
      ${state.product === 'todo' ? `<div class="card mt"><h2>Por producto</h2>${byProd.map(({ k, m: x }) => `<div style="margin-top:12px">
          <div class="row between">${prodTag(k)}<span class="small"><strong>${U.money(x.mrr)}</strong>/mes · ${x.paying} de ${x.total} ${B.PRODUCTS[k].units} pagando</span></div>
          <div class="progress" style="margin-top:6px"><span style="width:${Math.max(2, x.mrr / maxMrr * 100)}%;background:${B.PRODUCTS[k].color}"></span></div></div>`).join('')}</div>` : ''}
      <div class="grid g2 mt">
        <div class="card"><div class="row between"><h2>Comprobantes por revisar</h2><a class="btn btn-sm" href="#/pagos">Ver pagos</a></div>
          ${m.toReview.length ? m.toReview.map(payRow).join('') : '<div class="empty">No hay comprobantes nuevos 🎉</div>'}</div>
        <div class="card"><h2>Hay que escribirles</h2>
          ${m.dueSoon.length ? m.dueSoon.map(c => `<div class="list-item clickable" data-action="client" data-id="${c.id}"><div class="grow"><strong>${esc(c.name)}</strong> ${prodTag(c.product)}
            <div class="muted small">${B.statusOf(c) === 'prueba' ? `Prueba hasta ${fmtD(c.trialUntil)}` : `Pagado hasta ${fmtD(c.paidUntil)}`}</div></div>${badge(c)}
            <a class="btn btn-sm btn-wa" data-action="noop" target="_blank" rel="noopener" href="${B.waClient(c, remindKind(c))}">${UI.icon('whatsapp', 16)}</a></div>`).join('') : '<div class="empty">Nadie por vencer</div>'}</div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="row between"><h2>Próximos cobros automáticos</h2><a class="btn btn-sm" href="#/automaticos">Ver todos</a></div>
          ${up.length ? up.map(autoRow).join('') : '<div class="empty">No hay cobros en los próximos 7 días</div>'}</div>
        <div class="card"><h2>Cobrado este mes por método</h2>
          ${m.byMethod.map(x => `<div class="list-item"><span class="grow">${B.METHOD[x.m]}</span><strong>${U.money(x.total)}</strong></div>`).join('')}
          <div class="row wrap mt">${Object.entries(B.STATUS).map(([k, v]) => `<span class="badge ${v.cls}">${v.label}: ${m.by[k]}</span>`).join('')}</div></div>
      </div>`;
    },

    clientes() {
      const filters = { todos: 'Todos', activo: 'Al día', por_vencer: 'Por vencer', vencido: 'Vencidos', suspendido: 'Suspendidos', prueba: 'En prueba' };
      return `<div class="page-head"><div><h1>Clientes</h1><div class="muted">${B.clients({ product: state.product }).length} ${scopeName()}</div></div>
        <button class="btn btn-primary" data-action="new-client">${UI.icon('plus', 18)} Nuevo cliente</button></div>
        <div class="card"><div class="row wrap toolbar"><input id="q" type="search" placeholder="Buscar por nombre, dueño o ciudad" value="${esc(state.q)}" aria-label="Buscar">
          <div class="chips">${Object.entries(filters).map(([k, l]) => `<button class="chip ${state.filter === k ? 'active' : ''}" data-action="filter" data-f="${k}">${l}</button>`).join('')}</div></div>
          <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Plan</th><th>Estado</th><th class="hide-sm">Pagado hasta</th><th class="hide-sm">Cobro</th><th></th></tr></thead><tbody id="rows">${clientRows()}</tbody></table></div></div>`;
    },

    pagos() {
      const all = B.payments({ product: state.product });
      const review = all.filter(p => p.status === 'en_revision'), done = all.filter(p => p.status !== 'en_revision');
      return `<div class="page-head"><div><h1>Pagos</h1><div class="muted">Tarjeta, cobros automáticos y transferencias de ${scopeName()}</div></div></div>
        <div class="card"><h2>Transferencias por revisar</h2>${review.length ? review.map(payRow).join('') : '<div class="empty">No hay comprobantes por revisar</div>'}</div>
        <div class="card mt"><h2>Historial</h2>${done.length ? done.slice(0, 60).map(payRow).join('') : '<div class="empty">Sin pagos</div>'}</div>`;
    },

    automaticos() {
      const list = B.clients({ product: state.product }).filter(c => c.autopay);
      const on = list.filter(c => c.autopay.enabled).sort((a, b) => (a.autopay.nextCharge || '').localeCompare(b.autopay.nextCharge || '')), off = list.filter(c => !c.autopay.enabled);
      const due = on.filter(c => c.autopay.nextCharge <= U.today());
      return `<div class="page-head"><div><h1>Cobros automáticos</h1><div class="muted">Clientes que autorizaron cobrar su tarjeta cada mes</div></div>
        <button class="btn btn-primary" data-action="run-auto">🔁 Ejecutar cobros de hoy${due.length ? ` (${due.length})` : ''}</button></div>
        <div class="alert warn" style="margin-bottom:14px">En la demo los cobros se ejecutan con este botón. En la versión real los hace el servidor cada mañana con la pasarela (${esc(B.settings.gateway)}) y avisa ${B.settings.remindDays} días antes por WhatsApp.</div>
        <div class="card"><h2>Activos (${on.length})</h2>${on.length ? on.map(autoRow).join('') : '<div class="empty">Nadie tiene cobro automático todavía</div>'}</div>
        ${off.length ? `<div class="card mt"><h2>Desactivados por el cliente</h2>${off.map(c => `<div class="list-item clickable" data-action="client" data-id="${c.id}"><div class="grow"><strong>${esc(c.name)}</strong> ${prodTag(c.product)}<div class="muted small">${esc(c.autopay.brand)} •••• ${esc(c.autopay.last4)} · desactivado el ${new Date(c.autopay.canceledAt).toLocaleDateString('es-EC')}</div></div>${badge(c)}</div>`).join('')}</div>` : ''}`;
    },

    ajustes() {
      const s = B.settings;
      return `<div class="page-head"><div><h1>Ajustes</h1><div class="muted">Precios, cuentas para cobrar y reglas</div></div></div>
      <div class="grid g2">
        <div class="stack">
          <div class="card"><h2>Precios</h2>
            ${Object.entries(B.PRODUCTS).map(([k, p]) => `<h3>${prodTag(k)}</h3>${Object.values(p.plans).map(pl => `<div class="list-item"><span class="grow">${esc(pl.name)} <span class="muted small">· ${esc(pl.note)}</span></span><span>${U.money(pl.price)} + IVA = <strong>${U.money(pl.price * 1.15)}</strong></span></div>`).join('')}
              ${p.founderDiscount ? `<div class="muted small">Fundador: ${Math.round(p.founderDiscount * 100)}% de descuento por 12 meses.</div>` : ''}`).join('')}
          </div>
          <div class="card stack"><h2>Tus cuentas para transferencias</h2>
            ${s.accounts.map(a => `<div class="acc"><div class="row between"><strong>${esc(a.bank)}</strong><button class="btn btn-sm" data-action="account" data-id="${a.id}">${UI.icon('edit', 16)} Editar</button></div>
              <div class="small">${esc(a.type)} · ${esc(a.number)}</div><div class="muted small">${esc(a.holder)} · CI/RUC ${esc(a.idNumber)}</div></div>`).join('')}
            <button class="btn" data-action="account">${UI.icon('plus', 18)} Agregar cuenta</button></div>
        </div>
        <form class="card stack" data-form="settings"><h2>Reglas de cobro</h2>
          <div class="form-grid">
            <div class="field"><label>Días de gracia</label><input name="graceDays" type="number" min="0" max="30" value="${s.graceDays}"></div>
            <div class="field"><label>Días de prueba gratis</label><input name="trialDays" type="number" min="0" max="60" value="${s.trialDays}"></div>
            <div class="field"><label>Avisar antes del cobro (días)</label><input name="remindDays" type="number" min="1" max="10" value="${s.remindDays}"></div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Pasarela de pagos</label><select name="gateway">${['Kushki', 'PlacetoPay', 'PayPhone'].map(g => `<option ${s.gateway === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
            <div class="field"><label>Tu WhatsApp de soporte</label><input name="whatsapp" value="${esc(s.whatsapp)}" inputmode="tel"></div>
            <div class="field"><label>PIN de este panel</label><input name="pin" value="${esc(s.pin)}" inputmode="numeric"></div>
          </div>
          <p class="muted small">La pasarela todavía no está conectada: los pagos con tarjeta son de prueba hasta que firmes con ella y se active el servidor.</p>
          <button class="btn btn-primary">Guardar</button>
          <button type="button" class="btn btn-danger" data-action="reset">Reiniciar demo</button>
        </form>
      </div>`;
    },
  };

  function clientRows() {
    const q = state.q.trim().toLowerCase();
    const list = B.clients({ product: state.product }).filter(c => (state.filter === 'todos' || B.statusOf(c) === state.filter) && (!q || `${c.name} ${c.owner} ${c.city}`.toLowerCase().includes(q)));
    if (!list.length) return '<tr><td colspan="6" class="empty">Sin resultados</td></tr>';
    return list.map(c => { const pr = B.priceOf(c); return `<tr class="clickable" data-action="client" data-id="${c.id}">
      <td><strong>${esc(c.name)}</strong> ${state.product === 'todo' ? prodTag(c.product) : ''}<div class="muted small">${esc(c.owner)} · ${esc(c.city)}</div></td>
      <td>${esc(pr.plan.name)}${pr.founder ? ' <span class="badge info">Fundador</span>' : ''}<div class="muted small">${U.money(pr.total)}/mes</div></td>
      <td>${badge(c)}</td><td class="hide-sm">${B.statusOf(c) === 'prueba' ? 'Prueba: ' + fmtD(c.trialUntil) : fmtD(c.paidUntil)}</td>
      <td class="hide-sm">${c.autopay && c.autopay.enabled ? `🔁 ${esc(c.autopay.brand)} •••• ${esc(c.autopay.last4)}` : '<span class="muted">Manual</span>'}</td>
      <td class="actions"><a class="btn btn-sm btn-wa" data-action="noop" target="_blank" rel="noopener" href="${B.waClient(c, remindKind(c))}" aria-label="WhatsApp">${UI.icon('whatsapp', 16)}</a></td></tr>`; }).join('');
  }
  function payRow(p) {
    const c = B.client(p.clientId) || { name: 'Cliente', product: p.product };
    return `<div class="list-item clickable" data-action="payment" data-id="${p.id}">
      <span class="prod-thumb">${p.receipt ? `<img src="${p.receipt}" alt="">` : p.method === 'transferencia' ? '🧾' : '💳'}</span>
      <div class="grow"><strong>${esc(c.name)}</strong> ${state.product === 'todo' ? prodTag(c.product) : ''}<div class="muted small">${U.money(p.amount)} · ${B.METHOD[p.method]}${p.last4 ? ' •••• ' + esc(p.last4) : ''} · ${U.fmtDate(p.createdAt)}</div></div>
      ${UI.badge(B.PAY_STATUS[p.status])}${p.status === 'en_revision' ? '<span class="btn btn-sm btn-primary">Revisar</span>' : ''}</div>`;
  }
  function autoRow(c) {
    const a = c.autopay, late = a.nextCharge <= U.today();
    return `<div class="list-item clickable" data-action="client" data-id="${c.id}">
      <div class="grow"><strong>${esc(c.name)}</strong> ${state.product === 'todo' ? prodTag(c.product) : ''}
        <div class="muted small">${esc(a.brand)} •••• ${esc(a.last4)} · ${U.money(B.priceOf(c).total)} · ${late ? '<span style="color:var(--warn)">se cobra hoy</span>' : 'el ' + fmtD(a.nextCharge)}</div></div>
      <a class="btn btn-sm btn-wa" data-action="noop" target="_blank" rel="noopener" href="${B.waClient(c, 'cobro')}">${UI.icon('whatsapp', 16)} Avisar</a></div>`;
  }

  /* ---------------- Modales ---------------- */
  function openPayment(id) {
    const p = B.payments().find(x => x.id === id), c = B.client(p.clientId);
    const base = Math.round(p.amount / (1 + B.IVA) * 100) / 100;
    UI.modal(`<div class="modal-head"><h2>Pago de ${esc(c.name)}</h2>${closeBtn}</div>
      <div class="stack">
        <div class="row wrap">${prodTag(c.product)}${UI.badge(B.PAY_STATUS[p.status])}${badge(c)}</div>
        <div class="note"><div class="row between"><span>${p.months} ${p.months > 1 ? 'meses' : 'mes'} · ${B.METHOD[p.method]}${p.last4 ? ' •••• ' + esc(p.last4) : ''}</span><strong>${U.money(p.amount)}</strong></div>
          <div class="muted small">Base ${U.money(base)} + IVA ${U.money(p.amount - base)} · ${U.fmtDate(p.createdAt)}</div>
          <div class="muted small">Pagado hasta ${fmtD(c.paidUntil)}</div></div>
        ${p.receipt ? `<img class="receipt-big" src="${p.receipt}" alt="Comprobante">` : p.method !== 'transferencia' ? `<div class="note small">Pago con tarjeta procesado por la pasarela${p.method === 'auto' ? ' (cobro automático autorizado por el cliente)' : ''}. No requiere revisión.</div>` : ''}
      </div>
      <div class="modal-actions">
        ${p.status === 'en_revision' ? `<button class="btn btn-danger" data-action="review" data-ok="0" data-id="${p.id}">Rechazar</button><span class="spacer"></span><button class="btn btn-primary" data-action="review" data-ok="1" data-id="${p.id}">${UI.icon('check', 18)} Aprobar pago</button>`
          : `<a class="btn btn-wa" target="_blank" rel="noopener" href="${B.waClient(c, p.status === 'aprobado' ? 'aprobado' : p.method === 'auto' ? 'fallo' : 'vencido')}">${UI.icon('whatsapp', 18)} Escribir a ${esc(U.first(c.owner))}</a>`}
      </div>`);
  }

  function openClient(id) {
    const c = B.client(id), st = B.statusOf(c), pr = B.priceOf(c), pays = B.payments({ clientId: id });
    const paid = pays.filter(p => p.status === 'aprobado').reduce((t, p) => t + p.amount, 0);
    const prod = B.PRODUCTS[c.product];
    UI.modal(`<div class="modal-head"><div><h2>${esc(c.name)}</h2><div class="muted small">${esc(c.owner)} · ${esc(c.phone)} · ${esc(c.city)}</div></div>${closeBtn}</div>
      <div class="row wrap">${prodTag(c.product)}${badge(c)}${pr.founder ? '<span class="badge info">Fundador</span>' : ''}</div>
      <div class="grid g3 mt"><div class="mini-stat"><div class="value">${U.money(pr.total)}</div><div class="label">Al mes con IVA</div></div>
        <div class="mini-stat"><div class="value">${U.money(paid)}</div><div class="label">Te ha pagado</div></div>
        <div class="mini-stat"><div class="value">${c.size}</div><div class="label">${c.product === 'gym' ? 'Socios' : 'Estilistas'}</div></div></div>
      <div class="note mt small">${st === 'prueba' ? 'Prueba hasta ' + fmtD(c.trialUntil) : 'Pagado hasta ' + fmtD(c.paidUntil)} · acceso hasta ${fmtD(B.accessUntil(c))} (con ${B.settings.graceDays} días de gracia)
        ${c.autopay && c.autopay.enabled ? `<br>🔁 Cobro automático: ${esc(c.autopay.brand)} •••• ${esc(c.autopay.last4)}, próximo el ${fmtD(c.autopay.nextCharge)}. Autorizado el ${new Date(c.autopay.consentAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}.` : c.autopay ? '<br>Cobro automático desactivado por el cliente.' : '<br>Paga manualmente (tarjeta o transferencia).'}</div>
      ${Object.keys(prod.plans).length > 1 ? `<div class="form-grid mt"><div class="field"><label>Plan</label><select id="cPlan">${Object.entries(prod.plans).map(([k, pl]) => `<option value="${k}" ${c.plan === k ? 'selected' : ''}>${esc(pl.name)} · ${U.money(pl.price)}</option>`).join('')}</select></div>
        <label class="check" style="align-self:end"><input type="checkbox" id="cFounder" ${c.founderUntil && c.founderUntil >= U.today() ? 'checked' : ''}> Precio Fundador (12 meses)</label></div>` : ''}
      ${c.pin ? `<div class="note mt small">Acceso del cliente: PIN <strong>${esc(c.pin)}</strong></div>` : ''}
      <div class="row wrap mt">
        <a class="btn btn-wa" target="_blank" rel="noopener" href="${B.waClient(c, remindKind(c))}">${UI.icon('whatsapp', 18)} ${st === 'prueba' ? 'Escribir sobre la prueba' : 'Recordar pago'}</a>
        ${c.suspended ? `<button class="btn btn-primary" data-action="suspend" data-v="0" data-id="${c.id}">Reactivar</button>` : `<button class="btn btn-danger" data-action="suspend" data-v="1" data-id="${c.id}">Pausar acceso</button>`}
      </div>
      <h3>Pagos</h3>${pays.length ? pays.map(payRow).join('') : '<div class="empty">Sin pagos todavía</div>'}`, m => {
      const plan = m.querySelector('#cPlan'), founder = m.querySelector('#cFounder');
      const upd = () => {
        const d = new Date(); d.setMonth(d.getMonth() + 12);
        B.updateClient(id, { plan: plan.value, founderUntil: founder.checked ? (c.founderUntil && c.founderUntil >= U.today() ? c.founderUntil : U.toISO(d)) : null });
        render(); openClient(id); UI.toast('Plan actualizado');
      };
      if (plan) { plan.addEventListener('change', upd); founder.addEventListener('change', upd); }
    });
  }

  function clientForm() {
    UI.modal(`<div class="modal-head"><h2>Nuevo cliente</h2>${closeBtn}</div>
      <form class="stack" data-form="client">
        <div class="form-grid">
          <div class="field"><label>Producto</label><select name="product">${Object.entries(B.PRODUCTS).map(([k, p]) => `<option value="${k}" ${state.product === k ? 'selected' : ''}>${esc(p.name)} (${p.unit})</option>`).join('')}</select></div>
          <div class="field"><label>Plan</label><select name="plan"></select></div>
        </div>
        <div class="field"><label>Nombre del negocio</label><input name="name" required></div>
        <div class="form-grid">
          <div class="field"><label>Dueño o dueña</label><input name="owner" required></div>
          <div class="field"><label>WhatsApp</label><input name="phone" required inputmode="tel" placeholder="09…"></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Ciudad</label><input name="city" value="Manta"></div>
          <div class="field"><label id="sizeLbl">Socios</label><input name="size" type="number" min="1" value="50"></div>
        </div>
        <label class="check" id="founderRow"><input type="checkbox" name="founder"> Precio Fundador (50% por 12 meses)</label>
        <p class="muted small">Empieza con ${B.settings.trialDays} días de prueba gratis. Al guardar te damos su PIN de acceso.</p>
        <div class="modal-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">Crear</button></div>
      </form>`, m => {
      const f = m.querySelector('form'), el = f.elements;
      const sync = () => {
        const p = B.PRODUCTS[el.product.value];
        el.plan.innerHTML = Object.entries(p.plans).map(([k, pl]) => `<option value="${k}">${esc(pl.name)} · ${U.money(pl.price)} + IVA</option>`).join('');
        m.querySelector('#founderRow').style.display = p.founderDiscount ? '' : 'none';
        m.querySelector('#sizeLbl').textContent = el.product.value === 'gym' ? 'Socios' : 'Estilistas';
        el.size.value = el.product.value === 'gym' ? 50 : 2;
      };
      el.product.addEventListener('change', sync); sync();
    });
  }

  function accountForm(id) {
    const a = id ? B.settings.accounts.find(x => x.id === id) : { bank: '', type: 'Ahorros', number: '', holder: '', idNumber: '' };
    UI.modal(`<div class="modal-head"><h2>${id ? 'Editar cuenta' : 'Nueva cuenta'}</h2>${closeBtn}</div>
      <form class="stack" data-form="account" data-id="${id || ''}">
        <div class="form-grid">
          <div class="field"><label>Banco</label><input name="bank" required value="${esc(a.bank)}"></div>
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
    product(el) { state.product = el.dataset.p; state.filter = 'todos'; render(); },
    'new-client': clientForm,
    client: (el, id) => openClient(id),
    payment: (el, id) => openPayment(id),
    filter(el) { state.filter = el.dataset.f; render(); },
    review(el, id) {
      const ok = el.dataset.ok === '1';
      if (!ok && !confirm('¿Rechazar este comprobante? El cliente podrá subir otro.')) return;
      const p = B.review(id, ok);
      render(); openPayment(id);
      UI.toast(ok ? `Pago aprobado. ${B.client(p.clientId).name} queda al día.` : 'Comprobante rechazado', ok ? 'ok' : 'warn');
    },
    'run-auto'() {
      const res = B.runAutopay();
      render();
      if (!res.length) return UI.toast('Hoy no hay cobros automáticos pendientes');
      const ok = res.filter(r => r.ok).length;
      UI.toast(`🔁 ${ok} cobro${ok === 1 ? '' : 's'} aprobado${ok === 1 ? '' : 's'}${res.length - ok ? `, ${res.length - ok} rechazado${res.length - ok === 1 ? '' : 's'}` : ''} · ${U.money(res.filter(r => r.ok).reduce((t, r) => t + r.payment.amount, 0))}`, 'ok', 6000);
    },
    suspend(el, id) {
      const v = el.dataset.v === '1';
      if (v && !confirm('¿Pausar el acceso de este cliente? Sus datos se guardan y se reactiva al pagar.')) return;
      B.setSuspended(id, v); render(); openClient(id);
      UI.toast(v ? 'Acceso pausado' : 'Acceso reactivado');
    },
    account: (el, id) => accountForm(id),
    'del-account'(el, id) { if (!confirm('¿Eliminar esta cuenta?')) return; B.deleteAccount(id); UI.closeModal(); render(); },
    reset() { if (!confirm('¿Reiniciar los datos de ejemplo de cobros (gimnasios y peluquerías)?')) return; B.reset(); render(); UI.toast('Demo reiniciada'); },
  };
  const FORMS = {
    login(f) {
      if (f.elements.pin.value === String(B.settings.pin)) { sessionStorage.setItem(SESSION, '1'); render(); }
      else { UI.toast('PIN incorrecto', 'bad'); f.elements.pin.select(); }
    },
    client(f) {
      const d = UI.formData(f);
      if (String(d.phone).replace(/\D/g, '').length < 9) return UI.toast('Revisa el número de WhatsApp', 'bad');
      const c = B.createClient({ product: d.product, plan: d.plan, name: d.name.trim(), owner: d.owner.trim(), phone: d.phone, city: d.city.trim(), size: d.size, founder: !!d.founder });
      render(); openClient(c.id);
      UI.toast(`${c.name} creado con ${B.settings.trialDays} días de prueba`);
    },
    account(f) {
      const d = UI.formData(f);
      if (!validId(d.idNumber)) return UI.toast('La cédula o RUC no es válido', 'bad');
      B.saveAccount({ id: f.dataset.id || null, bank: d.bank.trim(), type: d.type, number: d.number.trim(), holder: d.holder.trim(), idNumber: d.idNumber.replace(/\D/g, '') });
      UI.closeModal(); render(); UI.toast('Cuenta guardada');
    },
    settings(f) {
      const d = UI.formData(f);
      B.saveSettings({ graceDays: Number(d.graceDays) || 0, trialDays: Number(d.trialDays) || 0, remindDays: Number(d.remindDays) || 3, gateway: d.gateway, whatsapp: d.whatsapp.trim(), pin: d.pin.trim() || B.settings.pin });
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
  document.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; document.getElementById('rows').innerHTML = clientRows(); } });
  window.addEventListener('hashchange', () => { UI.closeModal(); render(); });
  // Pagos que hacen los clientes desde sus apps (en otro aparato)
  window.addEventListener('billing-change', e => {
    const d = e.detail || {};
    if (sessionStorage.getItem(SESSION) === '1' && !UI.isModalOpen()) render();
    if (!d.remote || d.replay || !d.payment || !d.client) return;
    const p = d.payment;
    if (p.method === 'transferencia' && p.status === 'en_revision') UI.toast(`🧾 ${d.client.name} subió un comprobante de ${U.money(p.amount)}`, 'ok big', 8000);
    if (p.method === 'tarjeta' && p.status === 'aprobado') UI.toast(`💳 ${d.client.name} pagó ${U.money(p.amount)} con tarjeta${d.client.autopay && d.client.autopay.enabled ? ' y activó el cobro automático' : ''}`, 'ok big', 8000);
  });
  render();
})();
