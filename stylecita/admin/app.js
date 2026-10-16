/* Panel de la peluquería */
(function () {
  const app = document.getElementById('app');
  const esc = U.esc;
  const SESSION = 'salon_admin_session';
  const state = { date: U.today(), q: '' };
  const PX = 1.4; // píxeles por minuto en la agenda

  const NAV = [
    ['inicio', 'Inicio', 'home'], ['agenda', 'Agenda', 'calendar'], ['servicios', 'Servicios', 'scissors'],
    ['equipo', 'Equipo', 'users'], ['clientes', 'Clientes', 'user'], ['tienda', 'Tienda', 'bag'], ['ajustes', 'Ajustes', 'settings'],
  ];
  const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];
  const WEEK = [1, 2, 3, 4, 5, 6, 0];

  const route = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0];
  const svcNames = ids => ids.map(id => (SalonDB.service(id) || {}).name || '—').join(' + ');
  const clientName = id => (SalonDB.client(id) || {}).name || 'Cliente';
  const staffName = id => (SalonDB.staffMember(id) || {}).name || 'Sin asignar';
  const staffAv = (st, size = 34) => `<span class="staff-av" style="width:${size}px;height:${size}px;background:${st.color};font-size:${Math.round(size * 0.38)}px">${esc(U.initials(st.name))}</span>`;
  const statusBadge = s => UI.badge(SalonDB.STATUS[s]);
  const prodThumb = (p, cls = 'prod-thumb') => `<span class="${cls}">${p.photo ? `<img src="${p.photo}" alt="">` : esc(p.emoji || '🛍️')}</span>`;
  const stat = (label, value, sub = '', cls = '') => `<div class="card stat"><div class="label">${label}</div><div class="value">${value}</div><div class="sub ${cls}">${sub}</div></div>`;
  const closeBtn = `<button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">${UI.icon('close')}</button>`;

  function waAppt(a, kind) {
    const c = SalonDB.client(a.clientId), salon = SalonDB.settings.salonName;
    const when = `${U.fmtLong(a.date)} a las ${U.fmtTime(a.start)}`;
    const msg = kind === 'confirm'
      ? `Hola ${U.first(c.name)} 👋, tu cita en ${salon} está confirmada: ${svcNames(a.serviceIds)} el ${when} con ${U.first(staffName(a.staffId))}. ¡Te esperamos! 💇‍♀️`
      : `Hola ${U.first(c.name)}, te recordamos tu cita en ${salon}: ${svcNames(a.serviceIds)} el ${when}. Si no puedes asistir, avísanos por aquí 🙏`;
    return U.waLink(c.phone, msg);
  }
  function apptRow(a, { showDate = false, actions = '' } = {}) {
    const st = SalonDB.staffMember(a.staffId) || { name: '?', color: '#888' };
    return `<div class="list-item clickable" data-action="appt" data-id="${a.id}">
      <div style="min-width:66px"><strong>${U.fmtTime(a.start)}</strong>${showDate ? `<div class="muted small">${U.fmtDate(a.date, { weekday: 'short', day: 'numeric' })}</div>` : ''}</div>
      <div class="grow"><div><strong>${esc(clientName(a.clientId))}</strong></div><div class="muted small">${esc(svcNames(a.serviceIds))} · ${esc(U.first(st.name))}</div></div>
      ${actions || statusBadge(a.status)}
    </div>`;
  }

  /* ---------------- Render principal ---------------- */
  function render() {
    if (sessionStorage.getItem(SESSION) !== '1') return renderLogin();
    let page = route();
    if (!PAGES[page]) page = 'inicio';
    const d = SalonDB.dashboard();
    const counts = { inicio: d.pending.length + d.receipts.length, tienda: d.ordersOpen.filter(o => o.status === 'pendiente').length };
    const scroll = window.scrollY;
    app.innerHTML = `<div class="layout">
      <aside class="sidebar">
        <div class="brand">${UI.logo(36)}${esc(SalonDB.settings.salonName)}</div>
        <nav class="nav" aria-label="Secciones">
          ${NAV.map(([k, l, i]) => `<a href="#/${k}" class="${k === page ? 'active' : ''}" ${k === page ? 'aria-current="page"' : ''}>${UI.icon(i, 18)}<span>${l}</span>${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('')}
          <a href="#" class="logout" data-action="logout">${UI.icon('logout', 18)}<span>Salir</span></a>
          <span class="hide-sm" style="margin-top:12px">${UI.poweredBy()}</span>
        </nav>
      </aside>
      <main class="main" id="main">${PAGES[page]()}</main>
    </div>`;
    if (render.lastPage === page) window.scrollTo(0, scroll);
    render.lastPage = page;
  }

  function renderLogin() {
    app.innerHTML = `<div class="center-screen"><form class="card login-card stack" data-form="login">
      <div class="brand-lg">${UI.logo(46)}<div><h1>${esc(SalonDB.settings.salonName)}</h1><div class="muted small">Panel del salón</div></div></div>
      <div class="field"><label for="pin">PIN de administrador</label><input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required autofocus></div>
      <button class="btn btn-primary btn-block btn-lg">Entrar</button>
      <p class="muted small" style="text-align:center">Demo: PIN <strong>1234</strong></p>
      ${UI.poweredBy()}
    </form></div>`;
  }

  /* ---------------- Páginas ---------------- */
  const PAGES = {
    inicio() {
      const d = SalonDB.dashboard();
      const now = U.nowMin();
      const left = d.todays.filter(a => ['pendiente', 'confirmada'].includes(a.status) && U.toMin(a.end) > now).length;
      const top = SalonDB.topServices(30).slice(0, 6), maxTop = top.length ? top[0].n : 1;
      const newOrders = d.ordersOpen.filter(o => o.status === 'pendiente').length;
      return `
      <div class="page-head"><div><h1>Resumen</h1><div class="muted">${U.cap(U.fmtLong(U.today()))}</div></div>
        <div class="row wrap"><a class="btn" href="#/agenda">${UI.icon('calendar', 18)} Ver agenda</a><button class="btn btn-primary" data-action="new-appt">${UI.icon('plus', 18)} Nueva cita</button></div></div>
      <div class="grid g4">
        ${stat('Citas hoy', d.todays.length, `${left} por atender`)}
        ${stat('Ingresos hoy', U.money(d.revToday), 'servicios atendidos')}
        ${stat('Ingresos del mes', U.money(d.revMonth), U.cap(new Date().toLocaleDateString('es-EC', { month: 'long' })))}
        ${stat('Pedidos de la tienda', d.ordersOpen.length, newOrders ? `${newOrders} nuevos` : 'al día', newOrders ? 'warn' : 'ok')}
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="row between"><h2>Por confirmar</h2><span class="badge warn">${d.pending.length}</span></div>
          ${d.pending.length ? d.pending.slice(0, 8).map(a => apptRow(a, { showDate: true, actions: `<button class="btn btn-sm btn-primary" data-action="status" data-status="confirmada" data-id="${a.id}">Confirmar</button>` })).join('') : '<div class="empty">No hay reservas pendientes 🎉</div>'}
          ${d.pending.length ? '<p class="muted small mt">Las reservas que hacen tus clientes desde la app llegan aquí. Al confirmar puedes avisarles por WhatsApp.</p>' : ''}
        </div>
        <div class="card"><div class="row between"><h2>Citas de hoy</h2><a class="btn btn-sm" href="#/agenda" data-action="day-today">Agenda</a></div>
          ${d.todays.length ? d.todays.map(a => apptRow(a)).join('') : '<div class="empty">Hoy no hay citas</div>'}
        </div>
      </div>
      ${d.receipts.length ? `<div class="card mt"><div class="row between"><h2>Comprobantes por revisar</h2><span class="badge info">${d.receipts.length}</span></div>
        ${d.receipts.map(({ kind, item }) => `<div class="list-item clickable" data-action="${kind}" data-id="${item.id}">
          <span class="prod-thumb">${item.payment.receipt ? `<img src="${item.payment.receipt}" alt="">` : '🧾'}</span>
          <div class="grow"><strong>${esc(clientName(item.clientId))}</strong><div class="muted small">${kind === 'appt' ? `Cita · ${esc(svcNames(item.serviceIds))} · ${U.fmtDate(item.date)}` : 'Pedido de la tienda'}</div></div>
          <strong>${U.money(kind === 'appt' ? item.price : item.total)}</strong><span class="btn btn-sm btn-primary">Revisar</span></div>`).join('')}</div>` : ''}
      ${d.lowStock.length ? `<div class="alert warn mt">Poco stock: ${d.lowStock.map(p => `${esc(p.name)} (${p.stock})`).join(', ')}. <a href="#/tienda">Ver tienda</a></div>` : ''}
      <div class="grid g2 mt">
        <div class="card"><h2>Ingresos de los últimos 14 días</h2>${Charts.bars({ data: SalonDB.revenueByDay(14), fmt: v => v ? '$' + Math.round(v) : '', highlightLast: true })}</div>
        <div class="card"><h2>Servicios más pedidos</h2><div class="muted small" style="margin-bottom:8px">Últimos 30 días</div>
          ${top.map(t => `<div style="margin-top:10px"><div class="row between small"><span>${esc(t.service.name)}</span><strong>${t.n}</strong></div>${UI.progress(t.n / maxTop)}</div>`).join('') || '<div class="empty">Sin datos aún</div>'}
        </div>
      </div>`;
    },

    agenda() {
      const date = state.date, wd = U.weekday(date), sh = SalonDB.settings.hours[wd];
      const staff = SalonDB.staff();
      const list = SalonDB.appointments({ date }).filter(a => a.status !== 'cancelada');
      const head = `<div class="page-head"><div><h1>Agenda</h1><div class="muted">${U.cap(U.fmtLong(date))} · ${list.length} citas · ${U.money(list.reduce((t, a) => t + a.price, 0))}</div></div>
        <div class="day-nav">
          <button class="btn" data-action="day-prev" aria-label="Día anterior">${UI.icon('left', 18)}</button>
          <input type="date" id="agDate" value="${date}" aria-label="Fecha">
          <button class="btn" data-action="day-next" aria-label="Día siguiente">${UI.icon('right', 18)}</button>
          ${date !== U.today() ? '<button class="btn" data-action="day-today">Hoy</button>' : ''}
          <button class="btn btn-primary" data-action="new-appt">${UI.icon('plus', 18)} Nueva cita</button>
        </div></div>`;
      if (!sh) return head + '<div class="card empty">El salón está cerrado este día. Puedes cambiar el horario en <a href="#/ajustes">Ajustes</a>.</div>';
      const open = U.toMin(sh[0]), close = U.toMin(sh[1]), step = Number(SalonDB.settings.slotStep) || 30;
      const H = (close - open) * PX, y = m => (m - open) * PX;
      let times = '';
      for (let m = Math.ceil(open / 60) * 60; m < close; m += 60) times += `<span style="top:${y(m)}px">${U.fmtTime(U.fromMin(m)).replace(':00', '')}</span>`;
      const nowM = U.nowMin(), showNow = date === U.today() && nowM > open && nowM < close;
      const cols = staff.map(st => {
        const w = SalonDB.windowFor(st.id, date);
        let body = '';
        if (!w) body += `<div class="ag-off" style="top:0;height:${H}px"></div>`;
        else {
          if (w[0] > open) body += `<div class="ag-off" style="top:0;height:${y(w[0])}px"></div>`;
          if (w[1] < close) body += `<div class="ag-off" style="top:${y(w[1])}px;height:${(close - w[1]) * PX}px"></div>`;
          for (let t = open; t < close; t += step) {
            if (t < w[0] || t + step > w[1]) continue;
            body += `<button class="ag-cell ${t % 60 === 0 ? 'hour' : ''}" style="top:${y(t)}px;height:${step * PX}px" data-action="slot" data-staff="${st.id}" data-time="${U.fromMin(t)}" aria-label="Nueva cita ${U.fmtTime(U.fromMin(t))} con ${esc(st.name)}"></button>`;
          }
        }
        list.filter(a => a.staffId === st.id).forEach(a => {
          const s = U.toMin(a.start), e = U.toMin(a.end);
          body += `<button class="ag-appt ${a.status}" style="--c:${st.color};top:${y(s) + 1}px;height:${Math.max(24, (e - s) * PX - 2)}px" data-action="appt" data-id="${a.id}">
            <strong>${esc(clientName(a.clientId))}</strong>${U.fmtTime(a.start)} · ${esc(svcNames(a.serviceIds))}${a.status === 'pendiente' ? ' · <span style="color:var(--warn)">por confirmar</span>' : ''}</button>`;
        });
        if (showNow) body += `<div class="ag-now" style="top:${y(nowM)}px"></div>`;
        return { head: `<div class="ag-head">${staffAv(st, 30)}<div>${esc(U.first(st.name))}<div class="muted">${w ? `${U.fmtTime(U.fromMin(w[0]))} – ${U.fmtTime(U.fromMin(w[1]))}` : 'Libre hoy'}</div></div></div>`, body: `<div class="ag-col" style="height:${H}px">${body}</div>` };
      });
      return head + `<div class="agenda-wrap"><div class="agenda" style="--cols:${staff.length}">
        <div class="ag-head"></div>${cols.map(c => c.head).join('')}
        <div class="ag-time" style="height:${H}px">${times}</div>${cols.map(c => c.body).join('')}
      </div></div>
      <p class="muted small mt">Toca un espacio libre para agendar. Las citas con borde punteado están por confirmar.</p>`;
    },

    servicios() {
      const all = SalonDB.services(true);
      const cats = SalonDB.categories(all);
      return `<div class="page-head"><div><h1>Servicios</h1><div class="muted">Lo que tus clientes pueden reservar desde la app</div></div>
        <button class="btn btn-primary" data-action="service">${UI.icon('plus', 18)} Nuevo servicio</button></div>
        <div class="stack">${cats.map(cat => `<div class="card"><h2>${esc(cat)}</h2><div class="table-wrap"><table>
          <thead><tr><th>Servicio</th><th>Duración</th><th>Precio</th><th>Quién lo hace</th><th></th></tr></thead><tbody>
          ${all.filter(s => s.category === cat).map(s => `<tr class="clickable" data-action="service" data-id="${s.id}">
            <td><strong>${esc(s.name)}</strong> ${s.active ? '' : '<span class="badge">Oculto</span>'}${s.description ? `<div class="muted small">${esc(s.description)}</div>` : ''}</td>
            <td class="nowrap">${U.fmtDur(s.duration)}</td><td><strong>${U.money(s.price)}</strong></td>
            <td><div class="row">${SalonDB.staff().filter(st => st.serviceIds.includes(s.id)).map(st => staffAv(st, 26)).join('') || '<span class="badge warn">Nadie asignado</span>'}</div></td>
            <td class="actions"><span class="icon-btn">${UI.icon('edit', 18)}</span></td></tr>`).join('')}
          </tbody></table></div></div>`).join('')}</div>`;
    },

    equipo() {
      const today = U.today();
      return `<div class="page-head"><div><h1>Equipo</h1><div class="muted">Estilistas, servicios que hacen y sus horarios</div></div>
        <button class="btn btn-primary" data-action="staff">${UI.icon('plus', 18)} Agregar persona</button></div>
        <div class="grid g2">${SalonDB.staff(true).map(st => {
          const n = SalonDB.appointments({ date: today, staffId: st.id }).filter(a => a.status !== 'cancelada').length;
          return `<div class="card"><div class="row top">${staffAv(st, 48)}<div class="grow">
            <div class="row between"><h2 style="margin:0">${esc(st.name)}</h2><button class="btn btn-sm" data-action="staff" data-id="${st.id}">${UI.icon('edit', 16)} Editar</button></div>
            <div class="muted small">${esc(st.role)} ${st.active ? `· ${n} citas hoy` : '· <span class="badge bad">Inactivo</span>'}</div></div></div>
            <h3>Servicios</h3><div class="row wrap">${st.serviceIds.map(id => SalonDB.service(id)).filter(Boolean).map(s => `<span class="badge">${esc(s.name)}</span>`).join('') || '<span class="muted small">Ninguno</span>'}</div>
            <h3>Horario</h3><div class="row wrap small">${WEEK.map(d => `<span class="badge ${st.hours[d] ? 'info' : ''}">${U.DAYS_SHORT[d]} ${st.hours[d] ? st.hours[d].join('–') : 'libre'}</span>`).join('')}</div>
          </div>`;
        }).join('')}</div>`;
    },

    clientes() {
      return `<div class="page-head"><div><h1>Clientes</h1><div class="muted">${SalonDB.clients().length} clientes registrados</div></div></div>
        <div class="card"><div class="row toolbar"><input id="q" type="search" placeholder="Buscar por nombre o celular" value="${esc(state.q)}" aria-label="Buscar cliente"></div>
        <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Visitas</th><th class="hide-sm">Última visita</th><th class="hide-sm">Ha gastado</th><th></th></tr></thead>
        <tbody id="clientRows">${clientRows()}</tbody></table></div></div>`;
    },

    tienda() {
      const orders = SalonDB.orders();
      const open = orders.filter(o => ['pendiente', 'listo'].includes(o.status));
      const done = orders.filter(o => !['pendiente', 'listo'].includes(o.status)).slice(0, 6);
      return `<div class="page-head"><div><h1>Tienda</h1><div class="muted">Productos que tus clientes ven en la app y apartan para retirar en el salón</div></div>
        <button class="btn btn-primary" data-action="product">${UI.icon('plus', 18)} Nuevo producto</button></div>
        <div class="grid g2">
          <div class="card"><h2>Pedidos por entregar</h2>${open.length ? open.map(orderRow).join('') : '<div class="empty">No hay pedidos pendientes</div>'}
            ${done.length ? `<h3>Recientes</h3>${done.map(orderRow).join('')}` : ''}</div>
          <div class="card"><h2>Productos</h2>${SalonDB.products(true).map(p => `<div class="list-item">
            ${prodThumb(p)}<div class="grow clickable" data-action="product" data-id="${p.id}" style="cursor:pointer"><strong>${esc(p.name)}</strong> ${p.active ? '' : '<span class="badge">Oculto</span>'}<div class="muted small">${esc(p.category)} · ${U.money(p.price)}</div></div>
            <div class="row" style="gap:4px"><button class="btn btn-sm" data-action="stock" data-id="${p.id}" data-n="-1" aria-label="Restar stock">−</button>
              <span class="badge ${p.stock <= 0 ? 'bad' : p.stock <= 3 ? 'warn' : 'ok'}" style="min-width:52px;text-align:center">${p.stock} u.</span>
              <button class="btn btn-sm" data-action="stock" data-id="${p.id}" data-n="1" aria-label="Sumar stock">+</button></div>
          </div>`).join('')}</div>
        </div>`;
    },

    ajustes() {
      const s = SalonDB.settings;
      const link = new URL('../cliente/', location.href).href;
      return `<div class="page-head"><div><h1>Ajustes</h1><div class="muted">Datos del salón y reglas de reserva</div></div></div>
      <div class="grid g2">
        <form class="card stack" data-form="settings">
          <h2>Tu salón</h2>
          <div class="row">${UI.logo(56)}<div class="row wrap"><button type="button" class="btn btn-sm" data-action="logo">Subir logo</button>${s.logo ? '<button type="button" class="btn btn-sm btn-danger" data-action="logo-remove">Quitar</button>' : ''}</div></div>
          <div class="field"><label>Nombre</label><input name="salonName" value="${esc(s.salonName)}" required></div>
          <div class="form-grid">
            <div class="field"><label>WhatsApp del salón</label><input name="phone" value="${esc(s.phone)}" inputmode="tel"></div>
            <div class="field"><label>PIN del panel</label><input name="pin" value="${esc(s.pin)}" inputmode="numeric" required></div>
          </div>
          <div class="field"><label>Dirección</label><input name="address" value="${esc(s.address)}"></div>
          <h2 class="mt">Horario de atención</h2>
          ${WEEK.map(d => `<div class="hours-row"><label class="check"><input type="checkbox" name="open${d}" ${s.hours[d] ? 'checked' : ''}> ${U.DAYS[d]}</label>
            <input type="time" name="from${d}" value="${s.hours[d] ? s.hours[d][0] : '09:00'}" aria-label="Abre ${U.DAYS[d]}"><input type="time" name="to${d}" value="${s.hours[d] ? s.hours[d][1] : '18:00'}" aria-label="Cierra ${U.DAYS[d]}"></div>`).join('')}
          <h2 class="mt">Reservas desde la app</h2>
          <div class="form-grid">
            <div class="field"><label>Turnos cada</label><select name="slotStep">${[15, 20, 30, 60].map(m => `<option value="${m}" ${+s.slotStep === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></div>
            <div class="field"><label>Reservar hasta</label><select name="daysAhead">${[7, 14, 21, 30, 60].map(m => `<option value="${m}" ${+s.daysAhead === m ? 'selected' : ''}>${m} días antes</option>`).join('')}</select></div>
            <div class="field"><label>Anticipación mínima</label><select name="minNotice">${[[0, 'Ninguna'], [30, '30 min'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [1440, '1 día']].map(([v, l]) => `<option value="${v}" ${+s.minNotice === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label>Cancelar hasta</label><select name="cancelHours">${[1, 2, 3, 6, 12, 24].map(h => `<option value="${h}" ${+s.cancelHours === h ? 'selected' : ''}>${h} h antes</option>`).join('')}</select></div>
          </div>
          <label class="check"><input type="checkbox" name="autoConfirm" ${s.autoConfirm ? 'checked' : ''}> Confirmar reservas automáticamente</label>
          <button class="btn btn-primary">Guardar cambios</button>
        </form>
        <div class="stack">
          <form class="card stack" data-form="payments"><h2>Datos para pagos</h2>
            <p class="muted small">Tus clientes ven estas cuentas en la app, transfieren y suben la foto del comprobante. Tú lo apruebas aquí.</p>
            <label class="check"><input type="checkbox" name="transfer" ${SalonDB.payments.transfer ? 'checked' : ''}> Aceptar pagos por transferencia en la app</label>
            ${SalonDB.payments.accounts.map(a => `<div class="acc"><div class="row between"><strong>${esc(a.bank)}</strong><button type="button" class="btn btn-sm" data-action="account" data-id="${a.id}">${UI.icon('edit', 16)} Editar</button></div>
              <div class="small">${esc(a.type)} · ${esc(a.number)}</div><div class="muted small">${esc(a.holder)} · CI/RUC ${esc(a.idNumber)}${a.email ? ' · ' + esc(a.email) : ''}</div></div>`).join('') || '<div class="alert warn">Agrega al menos una cuenta para recibir transferencias.</div>'}
            <button type="button" class="btn" data-action="account">${UI.icon('plus', 18)} Agregar cuenta</button>
            <div class="field"><label>Indicaciones para el cliente</label><input name="note" value="${esc(SalonDB.payments.note)}"></div>
            <button class="btn btn-primary">Guardar</button>
          </form>
          <div class="card stack"><h2>App para tus clientes</h2>
            <p class="muted">Comparte este enlace. Tus clientes ven los horarios libres, reservan su cita y apartan productos.</p>
            <input value="${esc(link)}" readonly id="clientLink" aria-label="Enlace de la app de clientes">
            <div class="row wrap"><button class="btn" data-action="copy-link">Copiar enlace</button>
              <a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`¡Ya puedes reservar tu cita en ${s.salonName} desde el celular! 💇‍♀️ ${link}`)}">${UI.icon('whatsapp', 18)} Compartir</a>
              <a class="btn" target="_blank" href="../cliente/">Abrir app</a></div>
          </div>
          <div class="card stack"><h2>Datos de prueba</h2><p class="muted small">Borra los cambios y vuelve a cargar los datos de ejemplo.</p>
            <button class="btn btn-danger" data-action="reset">Reiniciar demo</button></div>
        </div>
      </div>`;
    },
  };

  function clientRows() {
    const q = state.q.trim().toLowerCase();
    const list = SalonDB.clients().filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .map(c => ({ c, s: SalonDB.clientStats(c.id) })).sort((a, b) => (b.s.last || '').localeCompare(a.s.last || '') || a.c.name.localeCompare(b.c.name));
    if (!list.length) return '<tr><td colspan="5" class="empty">Sin resultados</td></tr>';
    return list.map(({ c, s }) => `<tr class="clickable" data-action="client" data-id="${c.id}">
      <td><div class="row"><span class="initials">${esc(U.initials(c.name))}</span><div><strong>${esc(c.name)}</strong><div class="muted small">${esc(c.phone)}</div></div></div></td>
      <td>${s.visits}${s.noShows ? ` <span class="badge bad">${s.noShows} faltas</span>` : ''}</td>
      <td class="hide-sm">${s.last ? U.fmtDate(s.last) : '—'}</td><td class="hide-sm">${U.money(s.spent)}</td>
      <td class="actions"><a class="btn btn-sm btn-wa" data-action="noop" target="_blank" rel="noopener" href="${U.waLink(c.phone, `Hola ${U.first(c.name)} 👋`)}" aria-label="WhatsApp">${UI.icon('whatsapp', 16)}</a>
        <button class="btn btn-sm" data-action="new-appt" data-client="${c.id}">Agendar</button></td></tr>`).join('');
  }

  function orderRow(o) {
    const c = SalonDB.client(o.clientId) || { name: 'Cliente', phone: '' };
    const items = o.items.map(i => `${i.qty}× ${(SalonDB.product(i.productId) || {}).name || 'Producto'}`).join(', ');
    let btns = '';
    if (o.status === 'pendiente') btns = `<button class="btn btn-sm btn-primary" data-action="order-status" data-status="listo" data-id="${o.id}">Marcar listo</button>`;
    if (o.status === 'listo') btns = `<a class="btn btn-sm btn-wa" target="_blank" rel="noopener" data-action="noop" href="${U.waLink(c.phone, `Hola ${U.first(c.name)}, tu pedido de ${SalonDB.settings.salonName} está listo para retirar 🛍️ Total: ${U.money(o.total)}`)}">${UI.icon('whatsapp', 16)} Avisar</a><button class="btn btn-sm btn-primary" data-action="order-status" data-status="entregado" data-id="${o.id}">Entregado</button>`;
    if (['pendiente', 'listo'].includes(o.status)) btns += `<button class="btn btn-sm btn-danger" data-action="order-status" data-status="cancelado" data-id="${o.id}">Cancelar</button>`;
    return `<div class="list-item" style="flex-wrap:wrap"><div class="grow"><div class="row between"><strong>${esc(c.name)}</strong><strong>${U.money(o.total)}</strong></div>
      <div class="muted small">${esc(items)} · ${U.fmtDate(o.createdAt)}</div>
      <div class="row wrap mt" style="margin-top:8px">${UI.badge(SalonDB.ORDER_STATUS[o.status])}<button class="btn btn-sm" data-action="order" data-id="${o.id}">${UI.badge(SalonDB.payInfo(o))}</button><span class="grow"></span>${btns}</div></div></div>`;
  }

  /* Bloque de pago de una cita o pedido: estado, comprobante y botones para aprobarlo */
  function payBlock(kind, item) {
    const p = SalonDB.paymentOf(item), c = SalonDB.client(item.clientId) || { name: '', phone: '' };
    const amount = kind === 'appt' ? item.price : item.total;
    const ref = { 'data-kind': kind, 'data-id': item.id };
    const attrs = Object.entries(ref).map(([k, v]) => `${k}="${v}"`).join(' ');
    let btns = '';
    if (p.status === 'en_revision') btns = `<button class="btn btn-sm btn-primary" data-action="pay-review" data-ok="1" ${attrs}>${UI.icon('check', 16)} Aprobar pago</button><button class="btn btn-sm btn-danger" data-action="pay-review" data-ok="0" ${attrs}>Rechazar</button>`;
    if (p.status === 'rechazado') btns = `<a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${U.waLink(c.phone, `Hola ${U.first(c.name)}, no pudimos validar tu comprobante de ${U.money(amount)} en ${SalonDB.settings.salonName}. ¿Nos lo envías de nuevo desde la app? 🙏`)}">${UI.icon('whatsapp', 16)} Avisar al cliente</a>`;
    if (p.status !== 'verificado') btns += `<button class="btn btn-sm" data-action="pay-upload" ${attrs}>Subir comprobante</button>`;
    return `<div class="pay-box"><div class="row between wrap"><strong>Pago · ${U.money(amount)}</strong>${UI.badge(SalonDB.payInfo(item))}</div>
      <div class="muted small">${p.method === 'transferencia' ? 'Por transferencia' + (p.uploadedAt ? ` · comprobante subido el ${U.fmtDate(p.uploadedAt)}` : '') : 'En el salón (efectivo o tarjeta)'}</div>
      ${p.receipt ? `<img class="receipt-img" src="${p.receipt}" alt="Comprobante de pago">` : ''}
      ${btns ? `<div class="row wrap" style="margin-top:10px">${btns}</div>` : ''}</div>`;
  }

  function openOrder(id) {
    const o = SalonDB.orders().find(x => x.id === id);
    if (!o) return;
    const c = SalonDB.client(o.clientId) || { name: 'Cliente' };
    UI.modal(`<div class="modal-head"><h2>Pedido de ${esc(c.name)}</h2>${closeBtn}</div>
      <div class="stack">${o.items.map(i => { const p = SalonDB.product(i.productId) || {}; return `<div class="list-item">${prodThumb(p)}<div class="grow">${esc(p.name || 'Producto')}<div class="muted small">${i.qty} × ${U.money(i.price)}</div></div><strong>${U.money(i.qty * i.price)}</strong></div>`; }).join('')}
        ${UI.badge(SalonDB.ORDER_STATUS[o.status])}
        ${payBlock('order', o)}</div>`);
  }

  function accountForm(id) {
    const a = id ? SalonDB.payments.accounts.find(x => x.id === id) : { bank: '', type: 'Ahorros', number: '', holder: '', idNumber: '', email: '' };
    UI.modal(`<div class="modal-head"><h2>${id ? 'Editar cuenta' : 'Nueva cuenta'}</h2>${closeBtn}</div>
      <form class="stack" data-form="account" data-id="${id || ''}">
        <datalist id="banks">${SalonDB.BANKS.map(b => `<option value="${b}"></option>`).join('')}</datalist>
        <div class="form-grid">
          <div class="field"><label>Banco o cooperativa</label><input name="bank" list="banks" required value="${esc(a.bank)}"></div>
          <div class="field"><label>Tipo de cuenta</label><select name="type">${['Ahorros', 'Corriente'].map(t => `<option ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Número de cuenta</label><input name="number" required inputmode="numeric" value="${esc(a.number)}"></div>
        <div class="field"><label>Titular de la cuenta</label><input name="holder" required value="${esc(a.holder)}"></div>
        <div class="form-grid">
          <div class="field"><label>Cédula o RUC del titular</label><input name="idNumber" required inputmode="numeric" maxlength="13" value="${esc(a.idNumber)}"></div>
          <div class="field"><label>Correo (opcional)</label><input name="email" type="email" value="${esc(a.email)}"></div>
        </div>
        <div class="modal-actions">${id ? `<button type="button" class="btn btn-danger" data-action="del-account" data-id="${id}">${UI.icon('trash', 18)} Eliminar</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">Guardar</button></div>
      </form>`);
  }

  /* ---------------- Modales ---------------- */
  function openAppt(id) {
    const a = SalonDB.appointment(id);
    if (!a) return;
    const c = SalonDB.client(a.clientId), st = SalonDB.staffMember(a.staffId);
    const active = ['pendiente', 'confirmada'].includes(a.status);
    UI.modal(`<div class="modal-head"><h2>${esc(c.name)}</h2>${closeBtn}</div>
      <div class="stack">
        <div class="row wrap">${statusBadge(a.status)}<span class="badge">${a.source === 'app' ? 'Reservó por la app' : 'Registrada en el salón'}</span></div>
        <div class="note"><div><strong>${esc(svcNames(a.serviceIds))}</strong></div>
          <div class="muted small">${U.cap(U.fmtLong(a.date))} · ${U.fmtTime(a.start)} – ${U.fmtTime(a.end)}</div>
          <div class="muted small">Con ${esc(st ? st.name : '—')} · ${U.money(a.price)}</div>
          ${a.notes ? `<div class="small" style="margin-top:6px">📝 ${esc(a.notes)}</div>` : ''}</div>
        ${payBlock('appt', a)}
        <div class="row wrap"><a class="btn btn-wa" target="_blank" rel="noopener" href="${waAppt(a, 'confirm')}">${UI.icon('whatsapp', 18)} Enviar confirmación</a>
          <a class="btn btn-wa" target="_blank" rel="noopener" href="${waAppt(a, 'remind')}">${UI.icon('whatsapp', 18)} Recordatorio</a></div>
        ${active ? `<div class="row wrap">
          ${a.status === 'pendiente' ? `<button class="btn btn-primary" data-action="status" data-status="confirmada" data-id="${a.id}">Confirmar</button>` : ''}
          <button class="btn" data-action="status" data-status="completada" data-id="${a.id}">${UI.icon('check', 18)} Atendida</button>
          <button class="btn" data-action="status" data-status="no_asistio" data-id="${a.id}">No asistió</button>
          <button class="btn btn-danger" data-action="status" data-status="cancelada" data-id="${a.id}">Cancelar cita</button></div>`
        : `<div><button class="btn btn-sm" data-action="status" data-status="confirmada" data-id="${a.id}">Volver a activar</button></div>`}
      </div>
      <div class="modal-actions"><button class="btn" data-action="client" data-id="${c.id}">Ver cliente</button><span class="spacer"></span>${active ? `<button class="btn" data-action="edit-appt" data-id="${a.id}">${UI.icon('edit', 18)} Reprogramar</button>` : ''}</div>`);
  }

  function apptForm({ id = null, staffId = 'any', date = state.date, start = '', clientId = null } = {}) {
    const a = id ? SalonDB.appointment(id) : null;
    const c = a ? SalonDB.client(a.clientId) : clientId ? SalonDB.client(clientId) : null;
    if (a) { staffId = a.staffId; date = a.date; start = a.start; }
    if (date < U.today()) date = U.today();
    const sel = a ? a.serviceIds : [];
    UI.modal(`<div class="modal-head"><h2>${a ? 'Reprogramar cita' : 'Nueva cita'}</h2>${closeBtn}</div>
      <form class="stack" data-form="appt" data-id="${id || ''}">
        <datalist id="cl">${SalonDB.clients().map(x => `<option value="${esc(x.name)} · ${esc(x.phone)}"></option>`).join('')}</datalist>
        <div class="form-grid">
          <div class="field"><label for="fc">Cliente</label><input id="fc" name="client" list="cl" required autocomplete="off" placeholder="Busca o escribe un nombre" value="${c ? esc(c.name) : ''}"></div>
          <div class="field"><label for="fp">Celular</label><input id="fp" name="phone" required inputmode="tel" placeholder="09…" value="${c ? esc(c.phone) : ''}"></div>
        </div>
        <div class="field"><span class="lbl">Servicios</span><div class="svc-checks">${SalonDB.services().map(s => `<label class="check"><input type="checkbox" name="svc" value="${s.id}" ${sel.includes(s.id) ? 'checked' : ''}> <span class="grow">${esc(s.name)}</span><span class="muted small">${U.money(s.price)}</span></label>`).join('')}</div></div>
        <div class="form-grid">
          <div class="field"><label for="fs">Estilista</label><select id="fs" name="staffId"><option value="any">Cualquiera disponible</option>${SalonDB.staff().map(st => `<option value="${st.id}" ${st.id === staffId ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="fd">Fecha</label><input id="fd" type="date" name="date" value="${date}" min="${U.today()}" required></div>
          <div class="field"><label for="fh">Hora</label><select id="fh" name="start" required></select></div>
        </div>
        <div class="note small" id="apptSum">Elige uno o más servicios para ver los horarios libres.</div>
        <div class="field"><label for="fn">Nota (opcional)</label><input id="fn" name="notes" value="${a ? esc(a.notes) : ''}" placeholder="Ej.: tono del tinte, alergias…"></div>
        <div class="modal-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">${a ? 'Guardar cambios' : 'Agendar'}</button></div>
      </form>`, m => {
      const f = m.querySelector('form'), el = f.elements;
      const refresh = () => {
        const ids = [...f.querySelectorAll('[name=svc]:checked')].map(x => x.value);
        const want = el.start.value || start;
        if (!ids.length) { el.start.innerHTML = '<option value="">—</option>'; m.querySelector('#apptSum').textContent = 'Elige uno o más servicios para ver los horarios libres.'; return; }
        const list = SalonDB.slots({ date: el.date.value, serviceIds: ids, staffId: el.staffId.value, ignoreId: id, forClient: false });
        el.start.innerHTML = list.length ? list.map(s => `<option value="${s.start}" ${s.start === want ? 'selected' : ''}>${U.fmtTime(s.start)}</option>`).join('') : '<option value="">Sin horarios libres</option>';
        const who = SalonDB.staffFor(ids);
        m.querySelector('#apptSum').innerHTML = `<strong>${U.fmtDur(SalonDB.duration(ids))} · ${U.money(SalonDB.price(ids))}</strong>${who.length ? '' : ' · <span style="color:var(--bad)">Nadie del equipo hace todos estos servicios juntos</span>'}`;
      };
      el.client.addEventListener('input', () => {
        const parts = el.client.value.split(' · ');
        if (parts.length === 2) { el.client.value = parts[0]; el.phone.value = parts[1]; }
      });
      f.addEventListener('change', e => { if (e.target.name !== 'start') refresh(); });
      refresh();
    });
  }

  function serviceForm(id) {
    const s = id ? SalonDB.service(id) : { name: '', category: '', duration: 30, price: '', description: '', active: true };
    UI.modal(`<div class="modal-head"><h2>${id ? 'Editar servicio' : 'Nuevo servicio'}</h2>${closeBtn}</div>
      <form class="stack" data-form="service" data-id="${id || ''}">
        <datalist id="cats">${SalonDB.categories(SalonDB.services(true)).map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>
        <div class="field"><label>Nombre</label><input name="name" required value="${esc(s.name)}" placeholder="Ej.: Corte dama"></div>
        <div class="form-grid">
          <div class="field"><label>Categoría</label><input name="category" list="cats" required value="${esc(s.category)}"></div>
          <div class="field"><label>Duración</label><select name="duration">${DURATIONS.map(d => `<option value="${d}" ${+s.duration === d ? 'selected' : ''}>${U.fmtDur(d)}</option>`).join('')}</select></div>
          <div class="field"><label>Precio ($)</label><input name="price" type="number" min="0" step="0.01" required value="${s.price}"></div>
        </div>
        <div class="field"><label>Descripción (la ven tus clientes)</label><input name="description" value="${esc(s.description)}"></div>
        <label class="check"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}> Visible en la app</label>
        <div class="modal-actions">${id ? `<button type="button" class="btn btn-danger" data-action="del-service" data-id="${id}">${UI.icon('trash', 18)} Eliminar</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">Guardar</button></div>
      </form>`);
  }

  function staffForm(id) {
    const st = id ? SalonDB.staffMember(id) : { name: '', role: 'Estilista', color: '#1d4ed8', serviceIds: [], hours: { 0: null, 1: ['09:00', '18:00'], 2: ['09:00', '18:00'], 3: ['09:00', '18:00'], 4: ['09:00', '18:00'], 5: ['09:00', '18:00'], 6: ['09:00', '18:00'] }, active: true };
    UI.modal(`<div class="modal-head"><h2>${id ? 'Editar' : 'Agregar persona'}</h2>${closeBtn}</div>
      <form class="stack" data-form="staff" data-id="${id || ''}">
        <div class="form-grid">
          <div class="field"><label>Nombre</label><input name="name" required value="${esc(st.name)}"></div>
          <div class="field"><label>Cargo</label><input name="role" value="${esc(st.role)}" list="roles"><datalist id="roles">${['Estilista', 'Barbero', 'Colorista', 'Manicurista', 'Maquilladora', 'Cosmetóloga'].map(r => `<option value="${r}"></option>`).join('')}</datalist></div>
          <div class="field"><label>Color en la agenda</label><input type="color" name="color" value="${st.color}"></div>
        </div>
        <div class="field"><span class="lbl">Servicios que hace</span><div class="svc-checks">${SalonDB.services(true).map(s => `<label class="check"><input type="checkbox" name="svc" value="${s.id}" ${st.serviceIds.includes(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}</div></div>
        <div><span class="lbl">Días y horas de trabajo</span>
          ${WEEK.map(d => `<div class="hours-row"><label class="check"><input type="checkbox" name="open${d}" ${st.hours[d] ? 'checked' : ''}> ${U.DAYS[d]}</label>
            <input type="time" name="from${d}" value="${st.hours[d] ? st.hours[d][0] : '09:00'}" aria-label="Entra ${U.DAYS[d]}"><input type="time" name="to${d}" value="${st.hours[d] ? st.hours[d][1] : '18:00'}" aria-label="Sale ${U.DAYS[d]}"></div>`).join('')}</div>
        <label class="check"><input type="checkbox" name="active" ${st.active ? 'checked' : ''}> Activo (recibe citas)</label>
        <div class="modal-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">Guardar</button></div>
      </form>`);
  }

  function openClient(id) {
    const c = SalonDB.client(id), s = SalonDB.clientStats(id);
    const appts = SalonDB.appointments({ clientId: id }).reverse();
    const orders = SalonDB.orders({ clientId: id });
    UI.modal(`<div class="modal-head"><div class="row"><span class="initials">${esc(U.initials(c.name))}</span><div><h2>${esc(c.name)}</h2><div class="muted small">${esc(c.phone)}</div></div></div>${closeBtn}</div>
      <div class="grid g3"><div class="mini-stat"><div class="value">${s.visits}</div><div class="label">Visitas</div></div><div class="mini-stat"><div class="value">${U.money(s.spent)}</div><div class="label">Gastado</div></div><div class="mini-stat"><div class="value">${s.noShows}</div><div class="label">Faltas</div></div></div>
      <div class="row wrap mt"><a class="btn btn-wa" target="_blank" rel="noopener" href="${U.waLink(c.phone, `Hola ${U.first(c.name)} 👋`)}">${UI.icon('whatsapp', 18)} WhatsApp</a><button class="btn btn-primary" data-action="new-appt" data-client="${c.id}">${UI.icon('plus', 18)} Agendar</button></div>
      <form class="field mt" data-form="client-notes" data-id="${c.id}"><label>Notas (fórmula del tinte, preferencias…)</label><div class="row"><input name="notes" value="${esc(c.notes)}"><button class="btn">Guardar</button></div></form>
      <h3>Historial de citas</h3>${appts.length ? appts.slice(0, 15).map(a => apptRow(a, { showDate: true })).join('') : '<div class="empty">Sin citas</div>'}
      ${orders.length ? `<h3>Compras en la tienda</h3>${orders.map(o => `<div class="list-item"><div class="grow small">${o.items.map(i => `${i.qty}× ${esc((SalonDB.product(i.productId) || {}).name || '')}`).join(', ')}<div class="muted">${U.fmtDate(o.createdAt)}</div></div>${UI.badge(SalonDB.ORDER_STATUS[o.status])}<strong>${U.money(o.total)}</strong></div>`).join('')}` : ''}`);
  }

  function productForm(id) {
    const p = id ? SalonDB.product(id) : { name: '', category: '', price: '', stock: 0, emoji: '🧴', photo: null, description: '', active: true };
    UI.modal(`<div class="modal-head"><h2>${id ? 'Editar producto' : 'Nuevo producto'}</h2>${closeBtn}</div>
      <form class="stack" data-form="product" data-id="${id || ''}">
        <div class="row"><span id="pthumb">${prodThumb(p)}</span><button type="button" class="btn btn-sm" id="pphoto">Subir foto</button><input type="hidden" name="photo" value="${p.photo || ''}">
          <div class="field" style="width:90px"><label>o emoji</label><input name="emoji" value="${esc(p.emoji || '')}" maxlength="4"></div></div>
        <div class="field"><label>Nombre</label><input name="name" required value="${esc(p.name)}"></div>
        <datalist id="pcats">${SalonDB.categories(SalonDB.products(true)).map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>
        <div class="form-grid">
          <div class="field"><label>Categoría</label><input name="category" list="pcats" required value="${esc(p.category)}"></div>
          <div class="field"><label>Precio ($)</label><input name="price" type="number" min="0" step="0.01" required value="${p.price}"></div>
          <div class="field"><label>Stock</label><input name="stock" type="number" min="0" step="1" required value="${p.stock}"></div>
        </div>
        <div class="field"><label>Descripción</label><input name="description" value="${esc(p.description)}"></div>
        <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Visible en la app</label>
        <div class="modal-actions">${id ? `<button type="button" class="btn btn-danger" data-action="del-product" data-id="${id}">${UI.icon('trash', 18)} Eliminar</button>` : ''}<span class="spacer"></span><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn btn-primary">Guardar</button></div>
      </form>`, m => {
      m.querySelector('#pphoto').addEventListener('click', async () => {
        try {
          const img = await UI.pickImage({ max: 480, square: true });
          if (!img) return;
          m.querySelector('[name=photo]').value = img;
          m.querySelector('#pthumb').innerHTML = `<span class="prod-thumb"><img src="${img}" alt=""></span>`;
        } catch (e) { UI.toast(e.message, 'bad'); }
      });
    });
  }

  // Lee las filas "abre/cierra" de un formulario de horario
  const readHours = f => Object.fromEntries(WEEK.map(d => [d, f.elements['open' + d].checked ? [f.elements['from' + d].value, f.elements['to' + d].value] : null]));

  /* ---------------- Acciones ---------------- */
  const ACTIONS = {
    noop() {},
    close: () => UI.closeModal(),
    logout() { sessionStorage.removeItem(SESSION); render(); },
    'new-appt': el => apptForm({ clientId: el.dataset.client || null }),
    slot: el => apptForm({ staffId: el.dataset.staff, start: el.dataset.time, date: state.date }),
    appt: (el, id) => openAppt(id),
    'edit-appt': (el, id) => apptForm({ id }),
    status(el, id) {
      const st = el.dataset.status;
      if (st === 'cancelada' && !confirm('¿Cancelar esta cita? El horario quedará libre.')) return;
      const a = SalonDB.setStatus(id, st);
      render();
      if (st === 'confirmada') {
        // Ofrece avisar al cliente por WhatsApp
        openAppt(id);
        UI.toast('Cita confirmada. Envíale la confirmación por WhatsApp.');
      } else { UI.closeModal(); UI.toast(`Cita marcada: ${SalonDB.STATUS[a.status].label.toLowerCase()}`); }
    },
    'day-prev'() { state.date = U.addDays(state.date, -1); render(); },
    'day-next'() { state.date = U.addDays(state.date, 1); render(); },
    'day-today'() { state.date = U.today(); if (route() === 'agenda') render(); },
    service: (el, id) => serviceForm(id),
    'del-service'(el, id) {
      if (!confirm('¿Eliminar este servicio?')) return;
      const r = SalonDB.deleteService(id);
      UI.closeModal(); render();
      UI.toast(r === 'oculto' ? 'Tiene citas registradas, así que se ocultó de la app' : 'Servicio eliminado');
    },
    staff: (el, id) => staffForm(id),
    client: (el, id) => openClient(id),
    product: (el, id) => productForm(id),
    'del-product'(el, id) { if (!confirm('¿Eliminar este producto?')) return; SalonDB.deleteProduct(id); UI.closeModal(); render(); UI.toast('Producto eliminado'); },
    stock(el, id) { const p = SalonDB.product(id); SalonDB.saveProduct({ id, stock: Math.max(0, p.stock + Number(el.dataset.n)) }); render(); },
    'order-status'(el, id) {
      const st = el.dataset.status;
      if (st === 'cancelado' && !confirm('¿Cancelar el pedido? El stock se devuelve.')) return;
      SalonDB.setOrderStatus(id, st); render(); UI.toast(`Pedido: ${SalonDB.ORDER_STATUS[st].label.toLowerCase()}`);
    },
    async logo() {
      try { const img = await UI.pickImage({ max: 256, square: true, type: 'image/png' }); if (img) { SalonDB.saveSettings({ logo: img }); render(); } }
      catch (e) { UI.toast(e.message, 'bad'); }
    },
    'logo-remove'() { SalonDB.saveSettings({ logo: null }); render(); },
    'copy-link'() {
      const v = document.getElementById('clientLink').value;
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => UI.toast('Enlace copiado'), () => { document.getElementById('clientLink').select(); UI.toast('Selecciona y copia el enlace', 'warn'); });
    },
    order: (el, id) => openOrder(id),
    account: (el, id) => accountForm(id),
    'del-account'(el, id) { if (!confirm('¿Eliminar esta cuenta?')) return; SalonDB.deleteAccount(id); UI.closeModal(); render(); UI.toast('Cuenta eliminada'); },
    'pay-review'(el) {
      const { kind, id } = el.dataset, ok = el.dataset.ok === '1';
      if (!ok && !confirm('¿Rechazar este comprobante? El cliente podrá subir otro.')) return;
      SalonDB.reviewPayment(kind, id, ok);
      render();
      kind === 'appt' ? openAppt(id) : openOrder(id);
      UI.toast(ok ? 'Pago verificado ✓' : 'Comprobante rechazado', ok ? 'ok' : 'warn');
    },
    // Si el cliente manda el comprobante por WhatsApp, el salón lo sube aquí
    async 'pay-upload'(el) {
      const { kind, id } = el.dataset;
      try {
        const img = await UI.pickImage({ max: 1000, quality: 0.72 });
        if (!img) return;
        SalonDB.uploadReceipt(kind, id, img);
        render(); kind === 'appt' ? openAppt(id) : openOrder(id);
        UI.toast('Comprobante agregado');
      } catch (e) { UI.toast(e.message, 'bad'); }
    },
    reset() { if (!confirm('¿Borrar todo y cargar los datos de ejemplo?')) return; SalonDB.reset(); render(); UI.toast('Demo reiniciada'); },
  };

  const FORMS = {
    login(f) {
      if (f.elements.pin.value === String(SalonDB.settings.pin)) { sessionStorage.setItem(SESSION, '1'); render(); }
      else { UI.toast('PIN incorrecto', 'bad'); f.elements.pin.select(); }
    },
    appt(f) {
      const el = f.elements, ids = new FormData(f).getAll('svc');
      const name = el.client.value.split(' · ')[0].trim(), phone = U.phone(el.phone.value);
      if (!ids.length) return UI.toast('Elige al menos un servicio', 'bad');
      if (phone.length < 9) return UI.toast('Revisa el número de celular', 'bad');
      if (!el.start.value) return UI.toast('No hay un horario libre seleccionado', 'bad');
      const c = SalonDB.findOrCreateClient(name, phone);
      try {
        SalonDB.book({ id: f.dataset.id || null, clientId: c.id, serviceIds: ids, staffId: el.staffId.value, date: el.date.value, start: el.start.value, source: 'salon', notes: el.notes.value.trim() });
      } catch (e) { return UI.toast(e.message, 'bad'); }
      state.date = el.date.value;
      UI.closeModal();
      if (route() !== 'agenda') location.hash = '#/agenda'; else render();
      UI.toast(f.dataset.id ? 'Cita reprogramada' : 'Cita agendada');
    },
    service(f) {
      const d = UI.formData(f);
      SalonDB.saveService({ id: f.dataset.id || null, name: d.name.trim(), category: d.category.trim(), duration: Number(d.duration), price: Number(d.price), description: d.description.trim(), active: !!d.active });
      UI.closeModal(); render(); UI.toast('Servicio guardado');
    },
    staff(f) {
      const d = UI.formData(f);
      SalonDB.saveStaff({ id: f.dataset.id || null, name: d.name.trim(), role: d.role.trim(), color: d.color, serviceIds: new FormData(f).getAll('svc'), hours: readHours(f), active: !!d.active });
      UI.closeModal(); render(); UI.toast('Equipo actualizado');
    },
    'client-notes'(f) { SalonDB.saveClient({ id: f.dataset.id, notes: f.elements.notes.value.trim() }); UI.toast('Nota guardada'); },
    product(f) {
      const d = UI.formData(f);
      SalonDB.saveProduct({ id: f.dataset.id || null, name: d.name.trim(), category: d.category.trim(), price: Number(d.price), stock: Math.max(0, parseInt(d.stock, 10) || 0), emoji: d.emoji.trim(), photo: d.photo || null, description: d.description.trim(), active: !!d.active });
      UI.closeModal(); render(); UI.toast('Producto guardado');
    },
    account(f) {
      const d = UI.formData(f);
      const idNumber = U.phone(d.idNumber);
      if (!validId(idNumber)) return UI.toast('La cédula o RUC no es válido. Revisa los números.', 'bad');
      SalonDB.saveAccount({ id: f.dataset.id || null, bank: d.bank.trim(), type: d.type, number: d.number.trim(), holder: d.holder.trim(), idNumber, email: d.email.trim() });
      UI.closeModal(); render(); UI.toast('Cuenta guardada');
    },
    payments(f) {
      SalonDB.savePayments({ transfer: f.elements.transfer.checked, note: f.elements.note.value.trim() });
      render(); UI.toast('Datos de pago guardados');
    },
    settings(f) {
      const d = UI.formData(f);
      SalonDB.saveSettings({ salonName: d.salonName.trim(), phone: d.phone.trim(), address: d.address.trim(), pin: d.pin.trim(), hours: readHours(f), slotStep: Number(d.slotStep), daysAhead: Number(d.daysAhead), minNotice: Number(d.minNotice), cancelHours: Number(d.cancelHours), autoConfirm: !!d.autoConfirm });
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
  document.addEventListener('change', e => { if (e.target.id === 'agDate' && e.target.value) { state.date = e.target.value; render(); } });
  document.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; document.getElementById('clientRows').innerHTML = clientRows(); } });
  window.addEventListener('hashchange', () => { UI.closeModal(); render(); });

  // Reservas nuevas desde la app del cliente (otra pestaña o dispositivo)
  let lastPending = SalonDB.dashboard().pending.length;
  window.addEventListener('salondb-change', () => {
    const n = SalonDB.dashboard().pending.length;
    if (!UI.isModalOpen()) render();
    if (n > lastPending) UI.toast('📅 Nueva reserva desde la app');
    lastPending = n;
  });

  render();
})();
