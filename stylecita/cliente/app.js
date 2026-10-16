/* App del cliente: reservar citas, ver sus citas y comprar en la tienda del salón */
(function () {
  const app = document.getElementById('app');
  const esc = U.esc;
  const SESSION = 'salon_client_id';
  const CART = 'salon_cart';
  const TABS = [['inicio', 'Inicio', 'home'], ['reservar', 'Reservar', 'calendar'], ['citas', 'Mis citas', 'clock'], ['tienda', 'Tienda', 'bag'], ['perfil', 'Perfil', 'user']];
  const newBooking = (serviceIds = []) => ({ step: 1, serviceIds, staffId: null, date: null, start: null, notes: '', done: null });
  const state = { booking: newBooking(), shopCat: 'Todo' };

  const route = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0];
  const me = () => SalonDB.client(localStorage.getItem(SESSION));
  const svcNames = ids => ids.map(id => (SalonDB.service(id) || {}).name || '—').join(' + ');
  const staffName = id => (SalonDB.staffMember(id) || {}).name || '';
  const staffAv = (st, size = 40) => `<span class="staff-av" style="width:${size}px;height:${size}px;background:${st.color};font-size:${Math.round(size * 0.38)}px">${esc(U.initials(st.name))}</span>`;
  const prodImg = (p, cls = 'prod-img') => `<span class="${cls}">${p.photo ? `<img src="${p.photo}" alt="">` : esc(p.emoji || '🛍️')}</span>`;
  const salonWa = msg => U.waLink(SalonDB.settings.phone, msg);
  const cart = () => { try { return JSON.parse(sessionStorage.getItem(CART)) || {}; } catch (e) { return {}; } };
  const setCart = c => { try { sessionStorage.setItem(CART, JSON.stringify(c)); } catch (e) { /* sin almacenamiento */ } };
  const cartCount = () => Object.values(cart()).reduce((t, n) => t + n, 0);
  const upcoming = c => SalonDB.appointments({ clientId: c.id, from: U.today() })
    .filter(a => ['pendiente', 'confirmada'].includes(a.status) && !(a.date === U.today() && U.toMin(a.end) <= U.nowMin()));
  function hoursText(d) {
    const h = SalonDB.settings.hours[d];
    return h ? `${U.fmtTime(h[0])} – ${U.fmtTime(h[1])}` : 'Cerrado';
  }
  function dateBox(date) {
    const d = U.parseISO(date);
    return `<div class="date-box"><div class="m">${d.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '')}</div><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleDateString('es-EC', { month: 'short' }).replace('.', '')}</div></div>`;
  }

  /* ---------------- Render principal ---------------- */
  function render() {
    const c = me();
    if (!c) return renderLogin();
    let page = route();
    if (!PAGES[page]) page = 'inicio';
    const dots = { citas: upcoming(c).length, tienda: cartCount() };
    app.innerHTML = `<div class="m-app">
      <header class="m-header"><div class="row">${UI.logo(32)}<strong>${esc(SalonDB.settings.salonName)}</strong></div>
        <a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${salonWa(`Hola ${SalonDB.settings.salonName}, les escribo desde la app 👋`)}" aria-label="Escribir al salón por WhatsApp">${UI.icon('whatsapp', 18)}</a></header>
      <main class="m-main">${PAGES[page](c)}</main>
      <nav class="tabbar" aria-label="Secciones"><div class="tabbar-inner">
        ${TABS.map(([k, l, i]) => `<a href="#/${k}" class="${k === page ? 'active' : ''}" ${k === page ? 'aria-current="page"' : ''}>${UI.icon(i, 22)}${l}${dots[k] ? `<span class="tab-dot">${dots[k]}</span>` : ''}</a>`).join('')}
      </div></nav>
    </div>`;
  }

  function renderLogin() {
    const s = SalonDB.settings;
    app.innerHTML = `<div class="center-screen"><form class="card login-card stack" data-form="login">
      <div class="brand-lg">${UI.logo(52)}<div><h1>${esc(s.salonName)}</h1><div class="muted small">${esc(s.address)}</div></div></div>
      <p>Reserva tu cita en segundos, mira los horarios libres y aparta tus productos favoritos.</p>
      <div class="field"><label for="ln">Tu nombre</label><input id="ln" name="name" required autocomplete="name" placeholder="Nombre y apellido"></div>
      <div class="field"><label for="lp">Tu celular</label><input id="lp" name="phone" required inputmode="tel" autocomplete="tel" placeholder="09…"></div>
      <button class="btn btn-primary btn-block btn-lg">Entrar</button>
      <p class="muted small" style="text-align:center">Si ya eres cliente, usa el mismo número y verás tu historial.<br>Demo: <strong>0987654321</strong></p>
      ${UI.poweredBy()}
    </form></div>`;
  }

  /* ---------------- Páginas ---------------- */
  const PAGES = {
    inicio(c) {
      const next = upcoming(c)[0];
      const popular = SalonDB.topServices(60).map(t => t.service).filter(s => s.active).slice(0, 4);
      const prods = SalonDB.products().filter(p => p.stock > 0).slice(0, 4);
      const today = U.weekday(U.today());
      return `
      <section class="card hero"><h1>Hola, ${esc(U.first(c.name))} 👋</h1><p class="muted">¿Lista o listo para tu próximo cambio de look?</p>
        <a class="btn btn-primary btn-lg btn-block" href="#/reservar" data-action="book-new">${UI.icon('calendar', 20)} Reservar cita</a></section>
      ${next ? `<section class="card"><div class="row between"><h2>Tu próxima cita</h2>${UI.badge(SalonDB.STATUS[next.status])}</div>
        <div class="next-appt mt">${dateBox(next.date)}<div class="grow"><strong>${esc(svcNames(next.serviceIds))}</strong>
          <div class="muted small">${U.fmtTime(next.start)} · con ${esc(U.first(staffName(next.staffId)))}</div>
          ${next.status === 'pendiente' ? '<div class="small" style="color:var(--warn)">El salón la confirmará pronto</div>' : ''}</div></div>
        <a class="btn btn-block mt" href="#/citas">Ver mis citas</a></section>` : ''}
      ${popular.length ? `<section><h2>Lo más pedido</h2>${popular.map(s => `<button class="svc-pick" data-action="quick-book" data-id="${s.id}">
        <div class="grow"><strong>${esc(s.name)}</strong><div class="muted small">${U.fmtDur(s.duration)}</div></div><span class="price">${U.money(s.price)}</span>${UI.icon('right', 18)}</button>`).join('')}</section>` : ''}
      ${prods.length ? `<section><div class="row between"><h2>En nuestra tienda</h2><a href="#/tienda" class="small">Ver todo</a></div>
        <div class="prod-grid">${prods.map(prodCard).join('')}</div></section>` : ''}
      <section class="card"><h2>${esc(SalonDB.settings.salonName)}</h2>
        <div class="list-item">${UI.icon('pin', 20)}<span class="grow">${esc(SalonDB.settings.address)}</span></div>
        <div class="list-item">${UI.icon('clock', 20)}<span class="grow">Hoy: ${hoursText(today)}</span></div>
        <details class="small"><summary class="muted" style="cursor:pointer;padding:6px 0">Horario de la semana</summary>
          ${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="row between" style="padding:3px 0"><span>${U.DAYS[d]}</span><span class="muted">${hoursText(d)}</span></div>`).join('')}</details>
      </section>
      <div style="padding-top:6px">${UI.poweredBy()}</div>`;
    },

    reservar(c) {
      const b = state.booking;
      if (b.done) return bookingDone(b.done);
      const bar = `<div class="steps" aria-label="Paso ${b.step} de 4">${[1, 2, 3, 4].map(i => `<span class="${i <= b.step ? 'on' : ''}"></span>`).join('')}</div>`;
      const back = b.step > 1 ? `<button class="back" data-action="step" data-n="${b.step - 1}">${UI.icon('left', 18)} Atrás</button>` : '';
      const ids = b.serviceIds;

      if (b.step === 1) {
        const all = SalonDB.services();
        return `${bar}<h1>¿Qué te vas a hacer?</h1><p class="muted">Puedes elegir varios servicios.</p>
          ${SalonDB.categories(all).map(cat => `<section><h3>${esc(cat)}</h3>${all.filter(s => s.category === cat).map(s => `
            <button class="svc-pick ${ids.includes(s.id) ? 'active' : ''}" data-action="toggle-svc" data-id="${s.id}" aria-pressed="${ids.includes(s.id)}">
              <span class="tick">${ids.includes(s.id) ? UI.icon('check', 14) : ''}</span>
              <div class="grow"><strong>${esc(s.name)}</strong><div class="muted small">${U.fmtDur(s.duration)}${s.description ? ' · ' + esc(s.description) : ''}</div></div>
              <span class="price">${U.money(s.price)}</span></button>`).join('')}</section>`).join('')}
          ${ids.length ? `<div class="sumbar"><div class="grow"><strong>${U.money(SalonDB.price(ids))}</strong><div class="muted small">${ids.length} servicio${ids.length > 1 ? 's' : ''} · ${U.fmtDur(SalonDB.duration(ids))}</div></div>
            <button class="btn btn-primary" data-action="step" data-n="2">Continuar ${UI.icon('right', 18)}</button></div>` : ''}`;
      }

      if (b.step === 2) {
        const staff = SalonDB.staffFor(ids);
        return `${bar}${back}<h1>¿Con quién?</h1><p class="muted">${esc(svcNames(ids))}</p>
          ${staff.length ? `<button class="staff-pick" data-action="pick-staff" data-id="any"><span class="staff-av" style="width:44px;height:44px;background:var(--surface-2)">${UI.icon('users', 22)}</span>
              <div class="grow"><strong>Cualquiera disponible</strong><div class="muted small">Te mostramos más horarios</div></div>${UI.icon('right', 18)}</button>
            ${staff.map(st => `<button class="staff-pick" data-action="pick-staff" data-id="${st.id}">${staffAv(st, 44)}<div class="grow"><strong>${esc(st.name)}</strong><div class="muted small">${esc(st.role)}</div></div>${UI.icon('right', 18)}</button>`).join('')}`
          : `<div class="alert warn">Nadie del equipo hace todos estos servicios en la misma cita. Reserva cada servicio por separado o escríbenos.</div>
             <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${salonWa(`Hola, quisiera reservar: ${svcNames(ids)}`)}">${UI.icon('whatsapp', 18)} Escribir al salón</a>`}`;
      }

      if (b.step === 3) {
        // Solo se activan los días en que el salón abre y trabaja alguien que hace estos servicios
        const team = b.staffId === 'any' ? SalonDB.staffFor(ids) : [SalonDB.staffMember(b.staffId)].filter(Boolean);
        const dates = SalonDB.bookableDates().map(d => ({ ...d, open: d.open && team.some(st => SalonDB.windowFor(st.id, d.date)) }));
        if (!b.date) b.date = (dates.find(d => d.open && SalonDB.slots({ date: d.date, serviceIds: ids, staffId: b.staffId }).length) || dates[0]).date;
        const slots = SalonDB.slots({ date: b.date, serviceIds: ids, staffId: b.staffId });
        const groups = [['Mañana', 0, 720], ['Tarde', 720, 1020], ['Noche', 1020, 1440]]
          .map(([l, a, z]) => [l, slots.filter(s => U.toMin(s.start) >= a && U.toMin(s.start) < z)]).filter(g => g[1].length);
        return `${bar}${back}<h1>Elige día y hora</h1>
          <p class="muted">${esc(svcNames(ids))} · ${b.staffId === 'any' ? 'cualquier estilista' : 'con ' + esc(U.first(staffName(b.staffId)))}</p>
          <div class="chips" style="padding-bottom:4px">${dates.map(d => { const x = U.parseISO(d.date); return `<button class="date-chip ${d.date === b.date ? 'active' : ''}" data-action="pick-date" data-date="${d.date}" ${d.open ? '' : 'disabled'}>
            <div class="w">${d.date === U.today() ? 'Hoy' : U.DAYS_SHORT[x.getDay()]}</div><div class="d">${x.getDate()}</div><div class="w">${x.toLocaleDateString('es-EC', { month: 'short' }).replace('.', '')}</div></button>`; }).join('')}</div>
          <h2>${U.cap(U.fmtLong(b.date))}</h2>
          ${groups.length ? groups.map(([l, list]) => `<h3>${l}</h3><div class="slots">${list.map(s => `<button class="slot" data-action="pick-time" data-time="${s.start}">${U.fmtTime(s.start)}</button>`).join('')}</div>`).join('')
            : '<div class="card empty">No quedan horarios libres este día. Prueba otro día 🙂</div>'}`;
      }

      // Paso 4: confirmar
      const staffTxt = b.staffId === 'any' ? 'El primer estilista disponible' : staffName(b.staffId);
      return `${bar}${back}<h1>Confirma tu cita</h1>
        <div class="card"><div class="next-appt">${dateBox(b.date)}<div class="grow"><strong>${U.fmtTime(b.start)}</strong><div class="muted small">${U.cap(U.fmtLong(b.date))}</div></div></div>
          <div class="list-item mt">${UI.icon('scissors', 20)}<div class="grow">${ids.map(id => SalonDB.service(id)).map(s => `<div class="row between"><span>${esc(s.name)}</span><span>${U.money(s.price)}</span></div>`).join('')}</div></div>
          <div class="list-item">${UI.icon('user', 20)}<span class="grow">${esc(staffTxt)}</span></div>
          <div class="list-item">${UI.icon('clock', 20)}<span class="grow">Dura aprox. ${U.fmtDur(SalonDB.duration(ids))}</span></div>
          <div class="row between mt"><strong>Total</strong><strong style="font-size:1.25rem">${U.money(SalonDB.price(ids))}</strong></div>
          <div class="muted small">Pagas en el salón.</div></div>
        <div class="field"><label for="bn">¿Algo que debamos saber? (opcional)</label><input id="bn" value="${esc(b.notes)}" placeholder="Ej.: quiero un tono más claro"></div>
        <button class="btn btn-primary btn-lg btn-block" data-action="confirm-booking">Confirmar reserva</button>
        <p class="muted small" style="text-align:center">Puedes cancelar hasta ${SalonDB.settings.cancelHours} h antes desde “Mis citas”.</p>`;
    },

    citas(c) {
      const up = upcoming(c);
      const past = SalonDB.appointments({ clientId: c.id }).filter(a => !up.includes(a)).reverse().slice(0, 12);
      return `<h1>Mis citas</h1>
        ${up.length ? up.map(a => `<div class="card"><div class="next-appt">${dateBox(a.date)}<div class="grow">
            <div class="row between"><strong>${U.fmtTime(a.start)}</strong>${UI.badge(SalonDB.STATUS[a.status])}</div>
            <div>${esc(svcNames(a.serviceIds))}</div><div class="muted small">Con ${esc(staffName(a.staffId))} · ${U.money(a.price)}</div></div></div>
          <div class="row wrap mt">${SalonDB.canCancel(a) ? `<button class="btn btn-sm btn-danger" data-action="cancel-appt" data-id="${a.id}">Cancelar cita</button>` : '<span class="muted small">Para cambios de último momento, escríbenos.</span>'}
            <span class="grow"></span><a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${salonWa(`Hola, tengo una cita el ${U.fmtLong(a.date)} a las ${U.fmtTime(a.start)} (${svcNames(a.serviceIds)}).`)}">${UI.icon('whatsapp', 16)} Escribir</a></div></div>`).join('')
          : `<div class="card empty">No tienes citas próximas.<div class="mt"><a class="btn btn-primary" href="#/reservar" data-action="book-new">Reservar ahora</a></div></div>`}
        ${past.length ? `<h2 class="mt">Historial</h2><div class="card">${past.map(a => `<div class="list-item"><div class="grow"><strong>${esc(svcNames(a.serviceIds))}</strong>
          <div class="muted small">${U.fmtDate(a.date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${esc(U.first(staffName(a.staffId)))}</div></div>
          ${a.status === 'completada' ? `<button class="btn btn-sm" data-action="rebook" data-id="${a.id}">Repetir</button>` : UI.badge(SalonDB.STATUS[a.status])}</div>`).join('')}</div>` : ''}`;
    },

    tienda(c) {
      const all = SalonDB.products();
      const cats = ['Todo', ...SalonDB.categories(all)];
      const list = all.filter(p => state.shopCat === 'Todo' || p.category === state.shopCat);
      const n = cartCount(), cr = cart();
      const total = Object.entries(cr).reduce((t, [id, q]) => t + ((SalonDB.product(id) || {}).price || 0) * q, 0);
      const orders = SalonDB.orders({ clientId: c.id }).slice(0, 5);
      return `<h1>Tienda</h1><p class="muted">Aparta tus productos y retíralos en tu próxima visita. Pagas en el salón.</p>
        <div class="chips">${cats.map(k => `<button class="chip ${k === state.shopCat ? 'active' : ''}" data-action="shop-cat" data-cat="${esc(k)}">${esc(k)}</button>`).join('')}</div>
        <div class="prod-grid">${list.map(prodCard).join('') || '<div class="empty">Sin productos</div>'}</div>
        ${n ? `<div class="sumbar"><div class="grow"><strong>${U.money(total)}</strong><div class="muted small">${n} producto${n > 1 ? 's' : ''} en tu bolsa</div></div>
          <button class="btn btn-primary" data-action="open-bag">${UI.icon('bag', 18)} Ver bolsa</button></div>` : ''}
        ${orders.length ? `<h2 class="mt">Mis pedidos</h2><div class="card">${orders.map(o => `<div class="list-item"><div class="grow small">${o.items.map(i => `${i.qty}× ${esc((SalonDB.product(i.productId) || {}).name || '')}`).join(', ')}<div class="muted">${U.fmtDate(o.createdAt)} · ${U.money(o.total)}</div></div>${UI.badge(SalonDB.ORDER_STATUS[o.status])}</div>`).join('')}</div>` : ''}`;
    },

    perfil(c) {
      const s = SalonDB.clientStats(c.id);
      return `<h1>Mi perfil</h1>
        <div class="card"><div class="row"><span class="initials" style="width:52px;height:52px;font-size:1.1rem">${esc(U.initials(c.name))}</span><div><h2 style="margin:0">${esc(c.name)}</h2><div class="muted">${esc(c.phone)}</div></div></div>
          <div class="grid g3 mt"><div class="mini-stat"><div class="value">${s.visits}</div><div class="label">Visitas</div></div>
            <div class="mini-stat"><div class="value">${upcoming(c).length}</div><div class="label">Próximas</div></div>
            <div class="mini-stat"><div class="value">${s.last ? U.fmtDate(s.last) : '—'}</div><div class="label">Última</div></div></div></div>
        <form class="card stack" data-form="profile"><h2>Mis datos</h2>
          <div class="field"><label for="pn">Nombre</label><input id="pn" name="name" value="${esc(c.name)}" required></div>
          <button class="btn">Guardar</button></form>
        <div class="card stack"><h2>${esc(SalonDB.settings.salonName)}</h2><div class="muted">${esc(SalonDB.settings.address)}</div>
          <a class="btn btn-wa" target="_blank" rel="noopener" href="${salonWa('Hola 👋')}">${UI.icon('whatsapp', 18)} Escribir por WhatsApp</a></div>
        <button class="btn btn-block" data-action="logout">${UI.icon('logout', 18)} Salir</button>`;
    },
  };

  function prodCard(p) {
    const q = cart()[p.id] || 0;
    return `<div class="prod-card">${prodImg(p)}<div class="name">${esc(p.name)}</div>
      <div class="row between"><strong>${U.money(p.price)}</strong>${p.stock <= 0 ? '<span class="badge bad">Agotado</span>' : p.stock <= 3 ? `<span class="badge warn">Quedan ${p.stock}</span>` : ''}</div>
      ${p.stock <= 0 ? '<button class="btn btn-sm" disabled>Agotado</button>'
        : q ? `<div class="qty"><button class="btn btn-sm" data-action="cart" data-id="${p.id}" data-n="-1" aria-label="Quitar uno">−</button><strong class="grow" style="text-align:center">${q}</strong><button class="btn btn-sm" data-action="cart" data-id="${p.id}" data-n="1" aria-label="Agregar uno" ${q >= p.stock ? 'disabled' : ''}>+</button></div>`
        : `<button class="btn btn-sm" data-action="cart" data-id="${p.id}" data-n="1">${UI.icon('plus', 16)} Agregar</button>`}
    </div>`;
  }

  function bookingDone(a) {
    const ok = a.status === 'confirmada';
    return `<div class="card hero" style="text-align:center"><div style="font-size:3rem">${ok ? '🎉' : '📅'}</div>
      <h1>${ok ? '¡Cita confirmada!' : '¡Reserva enviada!'}</h1>
      <p class="muted">${ok ? 'Te esperamos.' : 'El salón la confirmará pronto. Te avisaremos por WhatsApp.'}</p>
      <div class="card" style="text-align:left"><div class="next-appt">${dateBox(a.date)}<div class="grow"><strong>${U.fmtTime(a.start)}</strong>
        <div>${esc(svcNames(a.serviceIds))}</div><div class="muted small">Con ${esc(staffName(a.staffId))} · ${U.money(a.price)}</div></div></div></div>
      <div class="stack mt"><a class="btn btn-primary btn-block" href="#/citas">Ver mis citas</a>
        <a class="btn btn-block" href="#/tienda">Mirar la tienda</a></div></div>`;
  }

  function openBag() {
    const cr = cart();
    const items = Object.entries(cr).map(([id, q]) => ({ p: SalonDB.product(id), q })).filter(x => x.p);
    const total = items.reduce((t, x) => t + x.p.price * x.q, 0);
    UI.modal(`<div class="modal-head"><h2>Tu bolsa</h2><button class="icon-btn" data-action="close" aria-label="Cerrar">${UI.icon('close')}</button></div>
      ${items.map(({ p, q }) => `<div class="list-item">${prodImg(p, 'prod-thumb')}<div class="grow"><strong>${esc(p.name)}</strong><div class="muted small">${q} × ${U.money(p.price)}</div></div><strong>${U.money(p.price * q)}</strong></div>`).join('')}
      <div class="row between mt"><strong>Total</strong><strong style="font-size:1.3rem">${U.money(total)}</strong></div>
      <div class="note mt">Apartamos tus productos y los retiras en el salón. Pagas al retirar.</div>
      <div class="modal-actions"><button class="btn" data-action="clear-bag">Vaciar</button><button class="btn btn-primary" data-action="place-order">Apartar pedido</button></div>`);
  }

  /* ---------------- Acciones ---------------- */
  const ACTIONS = {
    close: () => UI.closeModal(),
    logout() { if (!confirm('¿Salir de tu cuenta?')) return; localStorage.removeItem(SESSION); location.hash = '#/inicio'; render(); },
    'book-new'() { state.booking = newBooking(); if (route() === 'reservar') render(); },
    'quick-book'(el, id) { state.booking = newBooking([id]); state.booking.step = 2; location.hash = '#/reservar'; },
    rebook(el, id) { const a = SalonDB.appointment(id); state.booking = newBooking(a.serviceIds.filter(x => (SalonDB.service(x) || {}).active)); state.booking.step = 2; location.hash = '#/reservar'; },
    'toggle-svc'(el, id) {
      const ids = state.booking.serviceIds;
      state.booking.serviceIds = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
      render();
    },
    step(el) { state.booking.step = Number(el.dataset.n); if (state.booking.step < 3) state.booking.date = null; render(); window.scrollTo(0, 0); },
    'pick-staff'(el, id) { Object.assign(state.booking, { staffId: id, step: 3, date: null }); render(); window.scrollTo(0, 0); },
    'pick-date'(el) { state.booking.date = el.dataset.date; render(); },
    'pick-time'(el) { Object.assign(state.booking, { start: el.dataset.time, step: 4 }); render(); window.scrollTo(0, 0); },
    'confirm-booking'() {
      const b = state.booking;
      b.notes = (document.getElementById('bn') || {}).value || '';
      try {
        b.done = SalonDB.book({ clientId: me().id, serviceIds: b.serviceIds, staffId: b.staffId, date: b.date, start: b.start, source: 'app', notes: b.notes.trim() });
      } catch (e) { UI.toast(e.message, 'bad'); b.step = 3; render(); return; }
      render(); window.scrollTo(0, 0);
    },
    'cancel-appt'(el, id) {
      if (!confirm('¿Seguro que quieres cancelar esta cita?')) return;
      SalonDB.setStatus(id, 'cancelada'); render(); UI.toast('Cita cancelada');
    },
    'shop-cat'(el) { state.shopCat = el.dataset.cat; render(); },
    cart(el, id) {
      const c = cart(), p = SalonDB.product(id);
      c[id] = Math.max(0, Math.min(p.stock, (c[id] || 0) + Number(el.dataset.n)));
      if (!c[id]) delete c[id];
      setCart(c); render();
    },
    'open-bag': openBag,
    'clear-bag'() { setCart({}); UI.closeModal(); render(); },
    'place-order'() {
      try { SalonDB.placeOrder(me().id, cart()); } catch (e) { UI.toast(e.message, 'bad'); return; }
      setCart({}); UI.closeModal(); render(); UI.toast('¡Pedido apartado! Te avisamos cuando esté listo 🛍️');
    },
  };

  const FORMS = {
    login(f) {
      const name = f.elements.name.value.trim(), phone = U.phone(f.elements.phone.value);
      if (phone.length < 9) return UI.toast('Revisa tu número de celular', 'bad');
      const c = SalonDB.findOrCreateClient(name, phone);
      localStorage.setItem(SESSION, c.id);
      render();
      UI.toast(`¡Bienvenida/o, ${U.first(c.name)}!`);
    },
    profile(f) { SalonDB.saveClient({ id: me().id, name: f.elements.name.value.trim() }); render(); UI.toast('Datos guardados'); },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || !ACTIONS[el.dataset.action]) return;
    ACTIONS[el.dataset.action](el, el.dataset.id);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    FORMS[f.dataset.form](f);
  });
  window.addEventListener('hashchange', () => {
    UI.closeModal();
    // Al salir de una reserva terminada, la siguiente empieza de cero
    if (state.booking.done && route() !== 'reservar') state.booking = newBooking();
    render(); window.scrollTo(0, 0);
  });
  // Si el salón confirma o cambia algo (otra pestaña), se actualiza la vista
  window.addEventListener('salondb-change', () => { if (!UI.isModalOpen()) render(); });

  render();
})();
