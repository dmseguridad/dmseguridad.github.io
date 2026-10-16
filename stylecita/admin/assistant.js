/* Asistente del panel, por voz o por texto (demo).
   Entiende las preguntas más comunes del dueño y responde con los datos del salón; también
   prepara citas dichas en voz alta ("agenda a María mañana a las 3 para corte").
   El micrófono usa el reconocimiento de voz del navegador y la respuesta se lee en voz alta.
   Funciona por reglas: la versión con IA real (Claude) necesita un servidor propio. */
(function () {
  const esc = U.esc;
  const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const NUMS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  const STOP = new Set(['para', 'con', 'manana', 'hoy', 'el', 'la', 'las', 'a', 'de', 'del', 'un', 'una', 'cita', 'pasado', ...DAYS]);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/p\.\s?m\./g, 'pm').replace(/a\.\s?m\./g, 'am').replace(/[¿?¡!.,;]/g, ' ').replace(/\s+/g, ' ').trim();
  const has = (t, ...words) => words.some(w => new RegExp('\\b' + w).test(t));
  const first = n => U.first(n);
  const dayLabel = d => d === U.today() ? 'hoy' : d === U.addDays(U.today(), 1) ? 'mañana' : d === U.addDays(U.today(), -1) ? 'ayer' : U.fmtLong(d);
  const pctTxt = p => p == null ? 'sin comparación' : Math.abs(p) < 0.005 ? 'prácticamente igual' : `${p >= 0 ? 'arriba' : 'abajo'} un ${Math.abs(Math.round(p * 100))}%`;

  /* ---------- Fechas, horas y nombres dichos en voz alta ---------- */
  // future=true: "el lunes" es el próximo lunes; false: el lunes pasado (para preguntas de dinero)
  function parseDate(t, future = true) {
    const today = U.today(), s = t.replace(/de la manana/g, '');
    if (has(s, 'pasado manana')) return U.addDays(today, 2);
    if (has(s, 'manana')) return U.addDays(today, 1);
    if (has(s, 'anteayer', 'antier')) return U.addDays(today, -2);
    if (has(s, 'ayer')) return U.addDays(today, -1);
    if (has(s, 'hoy')) return today;
    for (let i = 0; i < 7; i++) {
      if (!new RegExp('\\b' + DAYS[i] + '\\b').test(s)) continue;
      for (let k = future ? 0 : 1; k < 8; k++) {
        const d = U.addDays(today, future ? k : -k);
        if (U.weekday(d) === i) return d;
      }
    }
    const m = s.match(/\bel (\d{1,2})\b/);
    if (m) {
      const d = today.slice(0, 8) + String(m[1]).padStart(2, '0');
      return future && d < today ? (() => { const x = U.parseISO(d); x.setMonth(x.getMonth() + 1); return U.toISO(x); })() : d;
    }
    return null;
  }
  function parseTime(t) {
    const s = t.replace(/\b(a las|a la|las) (una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g, (x, p, w) => `${p} ${NUMS[w]}`);
    const m = s.match(/\b(?:a las|a la|las|tipo)\s+(\d{1,2})(?:[: ](\d{2})| y media| y cuarto)?\s*(de la manana|de la tarde|de la noche|am|pm)?/);
    if (!m) return null;
    let h = +m[1];
    const min = m[2] ? +m[2] : / y media/.test(m[0]) ? 30 : / y cuarto/.test(m[0]) ? 15 : 0;
    const per = m[3] || '';
    if (/tarde|noche|pm/.test(per) && h < 12) h += 12;
    else if (!per && h >= 1 && h <= 7) h += 12; // en un salón, "a las 3" es de la tarde
    return h < 24 ? U.fromMin(h * 60 + min) : null;
  }
  // withCon: al agendar, la estilista se nombra con "con" ("con Sofía") para no confundirla con una clienta del mismo nombre
  const findStaff = (t, withCon = false) => SalonDB.staff().find(st => new RegExp((withCon ? '\\bcon ' : '\\b') + norm(first(st.name)) + '\\b').test(t));
  function findServices(t) {
    const words = t.split(' ');
    const hit = w => words.some(x => x.length > 3 && x.startsWith(w.slice(0, 5)));
    const st = findStaff(t, true);
    // Servicios agrupados por su primera palabra ("corte dama" y "corte caballero" compiten entre sí)
    const groups = {};
    SalonDB.services().forEach(s => {
      const toks = norm(s.name).split(/[ /]+/).filter(w => w.length > 3 && !STOP.has(w));
      const score = toks.filter(hit).length;
      if (score) (groups[toks[0]] = groups[toks[0]] || []).push({ s, score });
    });
    const male = has(t, 'caballero', 'hombre', 'nino', 'barba', 'barber') || (st && /barber/i.test(st.role));
    return Object.values(groups).map(g => {
      let opts = g;
      if (st) { const own = g.filter(x => st.serviceIds.includes(x.s.id)); if (own.length) opts = own; }
      const best = Math.max(...opts.map(x => x.score));
      opts = opts.filter(x => x.score === best);
      return (opts.find(x => /caballero/.test(norm(x.s.name)) === !!male) || opts[0]).s.id;
    }).slice(0, 3);
  }
  function findClient(t) {
    const cands = SalonDB.clients().map(c => {
      const parts = norm(c.name).split(' ');
      const score = parts.filter(p => p.length > 2 && new RegExp('\\b' + p + '\\b').test(t)).length;
      return { c, score, firstHit: new RegExp('\\b' + parts[0] + '\\b').test(t) };
    }).filter(x => x.score && x.firstHit).sort((a, b) => b.score - a.score);
    return cands.length ? cands[0].c : null;
  }
  // Nombre nuevo después de "agenda a ..." cuando no es cliente todavía
  function nameAfterVerb(raw) {
    const m = norm(raw).match(/\b(?:agenda|agendar|agendame|agendale|reserva|reservale|anota|apunta)(?:le)?\s+(?:una cita\s+)?(?:a|para)\s+([a-z]+)(?:\s+([a-z]+))?/);
    if (!m) return '';
    const w = [m[1], m[2]].filter(x => x && !STOP.has(x) && !findServices(x).length);
    // Devuelve las palabras como se dijeron (con tildes)
    const rawWords = String(raw).replace(/[¿?¡!.,;]/g, ' ').split(/\s+/);
    return w.map(x => U.cap(rawWords.find(r => norm(r) === x) || x)).join(' ');
  }

  /* ---------- Respuestas ---------- */
  function answer(raw) {
    const t = norm(raw);
    if (!t) return { text: 'No te escuché bien. ¿Me lo repites?' };

    // Agendar una cita
    if (/\b(agenda|agendar|agendame|agendale|reserva|reservar|reservale|anota|anotale|apunta|apuntale|separa)\s+(a|para|una|le)\b/.test(t)) {
      const c = findClient(t), name = c ? c.name : nameAfterVerb(raw);
      const ids = findServices(t), date = parseDate(t, true) || U.today(), start = parseTime(t) || '', st = findStaff(t, true);
      const missing = [!name && 'el nombre del cliente', !ids.length && 'el servicio', !start && 'la hora'].filter(Boolean);
      return {
        text: `Te preparé la cita${name ? ' de ' + name : ''}${ids.length ? ' para ' + ids.map(id => SalonDB.service(id).name.toLowerCase()).join(' y ') : ''} ${dayLabel(date)}${start ? ' a las ' + U.fmtTime(start) : ''}${st ? ' con ' + first(st.name) : ''}. ${missing.length ? 'Completa ' + missing.join(', ') + ' y' : 'Revisa y'} toca Agendar.`,
        then: () => window.AdminUI.apptForm({ clientId: c ? c.id : null, clientName: c ? '' : name, serviceIds: ids, date, start, staffId: st ? st.id : 'any' }),
      };
    }

    // Cómo voy / comparación con la semana pasada
    if (has(t, 'como voy', 'como vamos', 'como va', 'comparad', 'semana pasada', 'vs ')) {
      const d = Finance.today(), lw = DAYS[U.weekday(d.lwDate)];
      return { text: `Hoy llevas ${U.money(d.sofar)}. El ${lw} pasado a esta hora llevabas ${U.money(d.lwSameTime)}, así que vas ${pctTxt(d.diff) || 'igual'}. Si se atienden las citas que quedan, cierras en unos ${U.money(d.projection)}; el ${lw} pasado cerró en ${U.money(d.lwTotal)}.` };
    }

    // Proyección
    if (has(t, 'proyecc', 'cerrar', 'cierre', 'voy a ganar', 'vamos a ganar', 'estimad')) {
      if (has(t, 'mes')) { const p = Finance.period('mes'); return { text: `Este mes llevas ${U.money(p.cur.total)} y la proyección de cierre es ${U.money(p.projection)}, ${pctTxt(p.projDiff)} contra el mes pasado (${U.money(p.prevFull.total)}).` }; }
      if (has(t, 'semana')) { const p = Finance.period('semana'); return { text: `Esta semana llevas ${U.money(p.cur.total)} y cerrarías en unos ${U.money(p.projection)}, ${pctTxt(p.projDiff)} contra la semana pasada (${U.money(p.prevFull.total)}).` }; }
      const d = Finance.today();
      return { text: `Hoy cerrarías en unos ${U.money(d.projection)}: ya llevas ${U.money(d.sofar)} y faltan citas por ${U.money(d.remaining)}.` };
    }

    // Dinero
    if (has(t, 'cuanto', 'ingreso', 'factur', 'gananc', 'plata', 'dinero', 'vendi', 'vendimos')) {
      const st = findStaff(t);
      if (st) {
        const p = Finance.period(has(t, 'semana') ? 'semana' : 'mes'), s = Finance.byStaff(p.from, p.end).find(x => x.staff.id === st.id);
        return { text: `${first(st.name)} lleva ${U.money(s.revenue)} ${p.kind === 'mes' ? 'este mes' : 'esta semana'} en ${s.count} servicios, con un ticket promedio de ${U.money(s.ticket)} y ${Math.round(s.occupancy * 100)}% de ocupación.` };
      }
      if (has(t, 'mes')) { const p = Finance.period('mes'); return { text: `Este mes llevas ${U.money(p.cur.total)}: ${U.money(p.cur.services)} en servicios y ${U.money(p.cur.shop)} en la tienda. Vas ${pctTxt(p.diff)} contra el mismo tramo del mes pasado.` }; }
      if (has(t, 'semana')) { const p = Finance.period('semana'); return { text: `Esta semana llevas ${U.money(p.cur.total)} en ${p.cur.count} servicios. Vas ${pctTxt(p.diff)} contra la semana pasada a esta altura.` }; }
      const d = parseDate(t, false) || U.today();
      if (d === U.today()) { const x = Finance.today(); return { text: `Hoy llevas ${U.money(x.sofar)}. El ${DAYS[U.weekday(x.lwDate)]} pasado a esta hora llevabas ${U.money(x.lwSameTime)}.` }; }
      const total = SalonDB.appointments({ date: d }).filter(a => a.status === 'completada').reduce((s, a) => s + a.price, 0);
      return { text: `${U.cap(dayLabel(d))} se facturó ${U.money(total)} en servicios.` };
    }

    // Horarios libres
    if (has(t, 'libre', 'disponib', 'hueco', 'espacio', 'desocupad')) {
      const date = parseDate(t, true) || U.today(), time = parseTime(t), st = findStaff(t);
      if (time) {
        const who = SalonDB.staff().filter(s => SalonDB.isFree(s.id, date, U.toMin(time), 30));
        return { text: who.length ? `${dayLabel(date) === 'hoy' ? 'Hoy' : U.cap(dayLabel(date))} a las ${U.fmtTime(time)} está libre: ${who.map(s => first(s.name)).join(', ')}.` : `A esa hora están todos ocupados ${dayLabel(date)}.` };
      }
      const people = (st ? [st] : SalonDB.staff()).map(s => {
        const w = SalonDB.windowFor(s.id, date);
        if (!w) return null;
        const now = date === U.today() ? U.nowMin() : 0, free = [];
        for (let m = Math.ceil(Math.max(w[0], now) / 30) * 30; m + 30 <= w[1]; m += 30) if (SalonDB.isFree(s.id, date, m, 30)) free.push(U.fmtTime(U.fromMin(m)));
        return { s, free };
      }).filter(Boolean);
      if (!people.length) return { text: `${U.cap(dayLabel(date))} no trabaja nadie${st ? ' de ese nombre' : ''}.` };
      return { text: people.map(p => p.free.length ? `${first(p.s.name)}: ${p.free.slice(0, 4).join(', ')}${p.free.length > 4 ? ` y ${p.free.length - 4} más` : ''}` : `${first(p.s.name)} está lleno`).join('. ') + '.' };
    }

    // Por confirmar y comprobantes
    if (has(t, 'confirm', 'pendient')) {
      const d = SalonDB.dashboard();
      return { text: d.pending.length ? `Tienes ${d.pending.length} reservas por confirmar. La primera es de ${first(SalonDB.client(d.pending[0].clientId).name)}, ${dayLabel(d.pending[0].date)} a las ${U.fmtTime(d.pending[0].start)}.${d.receipts.length ? ` Y ${d.receipts.length} comprobantes por revisar.` : ''}` : 'No tienes reservas por confirmar. ¡Todo al día!', then: () => window.AdminUI.go('inicio') };
    }
    if (has(t, 'comprobante', 'transferen', 'pago')) {
      const r = SalonDB.dashboard().receipts;
      return { text: r.length ? `Tienes ${r.length} comprobante${r.length > 1 ? 's' : ''} por revisar, por ${U.money(r.reduce((s, x) => s + (x.kind === 'appt' ? x.item.price : x.item.total), 0))}.` : 'No hay comprobantes por revisar.' };
    }

    // Citas
    if (has(t, 'cita', 'agenda', 'turno', 'quien viene', 'clientes hay')) {
      const st = findStaff(t), date = parseDate(t, true) || U.today();
      if (has(t, 'proxima', 'siguiente')) {
        const now = U.nowMin();
        const next = SalonDB.appointments({ from: U.today() }).find(a => ['pendiente', 'confirmada'].includes(a.status) && (!st || a.staffId === st.id) && (a.date > U.today() || U.toMin(a.start) >= now));
        return next ? { text: `La próxima cita es de ${SalonDB.client(next.clientId).name}, ${dayLabel(next.date)} a las ${U.fmtTime(next.start)}: ${next.serviceIds.map(id => SalonDB.service(id).name.toLowerCase()).join(' y ')} con ${first(SalonDB.staffMember(next.staffId).name)}.` } : { text: 'No hay próximas citas.' };
      }
      const list = SalonDB.appointments({ date, staffId: st ? st.id : undefined }).filter(a => a.status !== 'cancelada');
      return {
        text: list.length ? `${U.cap(dayLabel(date))} ${st ? first(st.name) + ' tiene' : 'hay'} ${list.length} citas. ${list.slice(0, 3).map(a => `${U.fmtTime(a.start)} ${first(SalonDB.client(a.clientId).name)}`).join(', ')}${list.length > 3 ? ' y más' : ''}.` : `${U.cap(dayLabel(date))} no hay citas${st ? ' con ' + first(st.name) : ''}.`,
        then: () => { window.AdminUI.go('agenda'); },
      };
    }

    // Cliente
    const c = findClient(t);
    if (c && has(t, 'vino', 'visita', 'ultima', 'cliente', 'gast', 'cuando')) {
      const s = SalonDB.clientStats(c.id);
      return { text: `${c.name} ha venido ${s.visits} veces${s.last ? ', la última ' + dayLabel(s.last) : ''}, y ha gastado ${U.money(s.spent)}.${s.noShows ? ` Faltó ${s.noShows} veces.` : ''}` };
    }

    if (has(t, 'stock', 'acaba', 'producto', 'inventario')) {
      const low = SalonDB.dashboard().lowStock;
      return { text: low.length ? `Se está acabando: ${low.map(p => `${p.name}, quedan ${p.stock}`).join('; ')}.` : 'Todos los productos tienen buen stock.' };
    }

    if (has(t, 'consejo', 'recomien', 'sugier', 'suger', 'idea', 'que hago', 'como mejoro', 'como vendo')) {
      const ins = Finance.insights();
      return { text: ins.length ? ins.slice(0, 3).map(i => `${i.title}. ${i.text}`).join(' ') : 'Todo se ve bien por ahora. ¡Sigue así!' };
    }

    if (has(t, 'hola', 'buenos', 'buenas')) return { text: '¡Hola! Pregúntame cómo vas hoy, quién está libre o dime a quién agendar.' };
    return { text: 'Todavía no entiendo esa pregunta. Prueba con: “¿Cómo voy hoy?”, “¿Quién está libre mañana a las 4?” o “Agenda a Carla el sábado a las 10 para corte”.' };
  }

  /* ---------- Voz ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const lang = (navigator.language || '').startsWith('es') ? navigator.language : 'es-MX';
  let voiceOn = (() => { try { return localStorage.getItem('salon_voice') !== '0'; } catch (e) { return true; } })();
  function speak(text) {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    // "$157.00" se lee "157 dólares"
    const spoken = text.replace(/\$(\d+)\.00/g, '$1 dólares').replace(/\$(\d+)\.(\d\d)/g, '$1 dólares con $2').replace(/[“”…]/g, '');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = lang;
    const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.startsWith('es'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  /* ---------- Ventana del asistente ---------- */
  const history = [{ who: 'bot', text: '¡Hola! Soy tu asistente. Tócame el micrófono y pregúntame lo que necesites.' }];
  const SUGGEST = ['¿Cómo voy hoy?', '¿Quién está libre mañana a las 4?', '¿Cuánto llevamos este mes?', '¿Qué me recomiendas?', 'Agenda a Carla el sábado a las 10 para corte'];
  let rec = null;

  function open() {
    UI.modal(`<div class="modal-head"><h2>✨ Asistente</h2><div class="row">
        <button class="icon-btn" id="asVoice" aria-label="${voiceOn ? 'Silenciar respuestas' : 'Leer respuestas en voz alta'}" title="Respuestas en voz alta">${voiceOn ? '🔊' : '🔇'}</button>
        <button class="icon-btn" data-action="close" aria-label="Cerrar">${UI.icon('close')}</button></div></div>
      <div class="chat" id="asChat" aria-live="polite"></div>
      <div class="chips mt" id="asChips">${SUGGEST.map(s => `<button class="chip" type="button">${esc(s)}</button>`).join('')}</div>
      <form class="row mt" id="asForm">
        <input id="asIn" autocomplete="off" placeholder="Escribe o toca el micrófono…" aria-label="Pregunta para el asistente">
        <button type="button" class="btn mic-btn" id="asMic" aria-label="Hablar">🎤</button>
        <button class="btn btn-primary" aria-label="Enviar">${UI.icon('right', 18)}</button>
      </form>
      ${SR ? '' : '<p class="muted small mt">En este navegador usa el micrófono del teclado para dictar.</p>'}`, m => {
      const chat = m.querySelector('#asChat'), input = m.querySelector('#asIn'), mic = m.querySelector('#asMic');
      const paint = () => { chat.innerHTML = history.map(h => `<div class="bubble ${h.who}">${esc(h.text)}</div>`).join(''); chat.scrollTop = chat.scrollHeight; };
      const ask = q => {
        q = q.trim();
        if (!q) return;
        history.push({ who: 'me', text: q });
        const r = answer(q);
        history.push({ who: 'bot', text: r.text });
        paint(); input.value = '';
        speak(r.text);
        if (r.then) setTimeout(r.then, 900);
      };
      paint();
      m.querySelector('#asForm').addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
      m.querySelector('#asChips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) ask(b.textContent); });
      m.querySelector('#asVoice').addEventListener('click', e => {
        voiceOn = !voiceOn;
        try { localStorage.setItem('salon_voice', voiceOn ? '1' : '0'); } catch (err) { /* sin almacenamiento */ }
        e.currentTarget.textContent = voiceOn ? '🔊' : '🔇';
        if (!voiceOn && 'speechSynthesis' in window) speechSynthesis.cancel();
      });
      mic.addEventListener('click', () => {
        if (!SR) return UI.toast('Este navegador no permite dictar aquí. Usa el micrófono del teclado.', 'warn', 5000);
        if (rec) { rec.stop(); return; }
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        rec = new SR();
        rec.lang = lang; rec.interimResults = true; rec.maxAlternatives = 1;
        mic.classList.add('on'); input.placeholder = 'Te escucho…';
        rec.onresult = e => {
          const res = [...e.results];
          input.value = res.map(x => x[0].transcript).join('');
          if (res[res.length - 1].isFinal) { const q = input.value; rec.stop(); ask(q); }
        };
        rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') UI.toast('Permite el uso del micrófono para hablarle al asistente.', 'warn', 5000); };
        rec.onend = () => { rec = null; mic.classList.remove('on'); input.placeholder = 'Escribe o toca el micrófono…'; };
        rec.start();
      });
      input.focus();
    });
  }

  // Botón flotante con el micrófono (solo con la sesión iniciada)
  const fab = document.createElement('button');
  fab.className = 'assist-fab';
  fab.setAttribute('aria-label', 'Abrir asistente');
  fab.innerHTML = '🎤<span>Asistente</span>';
  fab.addEventListener('click', open);
  document.body.appendChild(fab);

  // Para probar sin voz
  window.Assistant = { answer, open };
})();
