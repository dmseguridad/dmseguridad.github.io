/* Asistente del panel, por voz o por texto (demo).
   Entiende las preguntas más comunes del dueño y responde con los datos del salón. Sobre todo
   mueve, adelanta, cancela y agenda citas dichas en voz alta, siempre pidiendo confirmación
   ("mueve la cita de María a las 5" → "¿La muevo?" → "sí") y ofreciendo avisar al cliente.
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
  // prefix: qué palabras van antes de la hora ("a las 5" es la hora nueva; "de las 3", la hora actual)
  function parseTime(t, prefix = '(?:a las|a la|las|tipo)') {
    const s = t.replace(/\b(las|la) (una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g, (x, p, w) => `${p} ${NUMS[w]}`);
    const m = s.match(new RegExp(`\\b${prefix}\\s+(\\d{1,2})(?:[: ](\\d{2})| y media| y cuarto)?\\s*(de la manana|de la tarde|de la noche|am|pm)?`));
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

  /* ---------- Mover, adelantar y cancelar citas ---------- */
  const DAY_WORDS = 'pasado manana|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo';
  const isActive = a => a.status === 'pendiente' || a.status === 'confirmada';
  const durOf = a => U.toMin(a.end) - U.toMin(a.start);
  const svcTxt = a => a.serviceIds.map(id => (SalonDB.service(id) || {}).name || '').join(' y ').toLowerCase();
  const when = (date, start) => `${dayLabel(date)} a las ${U.fmtTime(start)}`;
  const ctx = { apptId: null }; // última cita de la que se habló ("pásala a las 5")

  // Día nuevo: "al lunes", "para mañana"; día actual de la cita: "la de hoy", "del lunes"
  function targetDate(t) {
    const m = t.match(new RegExp(`\\b(?:al|para el|para|a|pasala al|pasala para)\\s+(${DAY_WORDS}|\\d{1,2})\\b`));
    if (!m) return null;
    return /^\d/.test(m[1]) ? parseDate('el ' + m[1], true) : parseDate(m[1], true);
  }
  function sourceDate(t) {
    const m = t.match(new RegExp(`\\b(?:de|del|la de)\\s+(${DAY_WORDS})\\b`));
    return m ? parseDate(m[1], true) : null;
  }
  // "media hora", "una hora", "20 minutos"
  function relMinutes(t) {
    if (/\bmedia hora\b/.test(t)) return 30;
    if (/\bun cuarto de hora\b/.test(t)) return 15;
    const m = t.match(/\b(\d+|una|un|dos)\s*(horas?|minutos?|min)\b/);
    if (!m) return 0;
    const n = m[1] === 'una' || m[1] === 'un' ? 1 : m[1] === 'dos' ? 2 : +m[1];
    return /hora/.test(m[2]) ? n * 60 : n;
  }
  const upcomingOf = c => SalonDB.appointments({ clientId: c.id, from: U.today() })
    .filter(a => isActive(a) && !(a.date === U.today() && U.toMin(a.end) <= U.nowMin()));
  // Horas libres de un estilista ese día (en minutos), las más cercanas a la hora pedida primero
  function freeStarts(staffId, date, dur, ignoreId) {
    const w = SalonDB.windowFor(staffId, date);
    if (!w) return [];
    const from = date === U.today() ? Math.max(w[0], Math.ceil(U.nowMin() / 30) * 30) : w[0];
    const out = [];
    for (let m = Math.ceil(from / 30) * 30; m + dur <= w[1]; m += 30) if (SalonDB.isFree(staffId, date, m, dur, ignoreId)) out.push(m);
    return out;
  }
  const nearest = (list, around, n = 3) => [...list].sort((a, b) => Math.abs(a - around) - Math.abs(b - around)).slice(0, n).sort((a, b) => a - b);

  function waBtn(a, kind) {
    const c = SalonDB.client(a.clientId), st = SalonDB.staffMember(a.staffId), salon = SalonDB.settings.salonName;
    const msg = kind === 'cancel'
      ? `Hola ${first(c.name)} 👋, te escribimos de ${salon}: tu cita de ${svcTxt(a)} del ${U.fmtLong(a.date)} a las ${U.fmtTime(a.start)} quedó cancelada. Cuando quieras, reserva de nuevo desde la app 💇‍♀️`
      : kind === 'confirm'
        ? `Hola ${first(c.name)} 👋, tu cita en ${salon} está confirmada: ${svcTxt(a)} el ${U.fmtLong(a.date)} a las ${U.fmtTime(a.start)} con ${first(st.name)}. ¡Te esperamos!`
        : `Hola ${first(c.name)} 👋, te escribimos de ${salon}: tu cita de ${svcTxt(a)} quedó para el ${U.fmtLong(a.date)} a las ${U.fmtTime(a.start)} con ${first(st.name)}. ¿Te queda bien? 🙏`;
    return { label: `📲 Avisar a ${first(c.name)}`, href: U.waLink(c.phone, msg) };
  }

  function doMove(a, date, start, staffId) {
    const before = when(a.date, a.start);
    try {
      a = SalonDB.book({ id: a.id, clientId: a.clientId, serviceIds: a.serviceIds, staffId, date, start, source: 'salon', notes: a.notes || '' });
    } catch (e) { return { text: e.message }; }
    window.AdminUI.render();
    ctx.apptId = a.id;
    const c = SalonDB.client(a.clientId);
    return { text: `Listo. La cita de ${c.name} pasó de ${before} a ${when(a.date, a.start)} con ${first(SalonDB.staffMember(a.staffId).name)}. Avísale para que llegue a tiempo.`, buttons: [waBtn(a, 'move')] };
  }

  /* Busca una cita posterior que quepa en un espacio libre, para adelantarla */
  function fillSuggestion(date, staffId = null, fromMin = null) {
    const staff = staffId ? [SalonDB.staffMember(staffId)] : SalonDB.staff();
    let best = null;
    staff.forEach(st => {
      const later = SalonDB.appointments({ date, staffId: st.id }).filter(isActive);
      freeStarts(st.id, date, 30).filter(m => fromMin == null || m >= fromMin).forEach(m => {
        if (best && best.m <= m) return;
        const b = later.find(x => U.toMin(x.start) > m && SalonDB.isFree(st.id, date, m, durOf(x), x.id));
        if (b) best = { m, b, st };
      });
    });
    if (!best) return null;
    const c = SalonDB.client(best.b.clientId), start = U.fromMin(best.m);
    return {
      text: `Puedo adelantar a ${c.name} (${svcTxt(best.b)}) de las ${U.fmtTime(best.b.start)} a las ${U.fmtTime(start)} con ${first(best.st.name)}. ¿Lo adelanto?`,
      confirm: { label: 'adelantar', run: () => doMove(best.b, date, start, best.st.id) },
    };
  }

  // Encuentra la cita de la que se habla: por cliente (y día/hora si los dice) o la última mencionada
  function pickAppt(t, c) {
    if (!c) {
      const prev = ctx.apptId && SalonDB.appointment(ctx.apptId);
      return prev && isActive(prev) ? prev : null;
    }
    const sd = sourceDate(t), st = parseTime(t, '(?:de las|de la)');
    const list = upcomingOf(c);
    return list.find(a => (!sd || a.date === sd) && (!st || a.start === st)) || list[0] || null;
  }

  function moveAppt(t, a) {
    const c = SalonDB.client(a.clientId);
    ctx.apptId = a.id;
    const staff = findStaff(t, true) || SalonDB.staffMember(a.staffId);
    if (!a.serviceIds.every(id => staff.serviceIds.includes(id))) return { text: `${first(staff.name)} no hace ${svcTxt(a)}.` };
    const date = targetDate(t) || a.date, dur = durOf(a);
    const earlier = has(t, 'adelant', 'antes', 'mas temprano');
    let start = parseTime(t, '(?:a las|a la|para las|para la|tipo)');
    const rel = relMinutes(t);
    if (!start && rel) start = U.fromMin(U.toMin(a.start) + (earlier ? -rel : rel));
    if (!start && earlier) {
      const opts = freeStarts(staff.id, date, dur, a.id).filter(m => date < a.date || m < U.toMin(a.start));
      if (!opts.length) return { text: `${first(staff.name)} no tiene espacio antes de las ${U.fmtTime(a.start)} ${dayLabel(date)}.` };
      start = U.fromMin(opts[0]);
    }
    if (!start && date !== a.date) start = a.start; // "pásala al lunes": misma hora
    if (!start) return { text: `¿A qué hora paso la cita de ${first(c.name)} (${when(a.date, a.start)})? Dime por ejemplo “pásala a las 5”.` };
    const min = U.toMin(start);
    if (SalonDB.isFree(staff.id, date, min, dur, a.id)) {
      return {
        text: `¿Muevo la cita de ${c.name} (${svcTxt(a)}) de ${when(a.date, a.start)} a ${when(date, start)} con ${first(staff.name)}?`,
        confirm: { label: 'mover', run: () => doMove(a, date, start, staff.id) },
      };
    }
    // Ocupado: ofrece las horas libres más cercanas o a otra persona del equipo a esa hora
    const alts = nearest(freeStarts(staff.id, date, dur, a.id), min);
    const other = SalonDB.staffFor(a.serviceIds).find(s => s.id !== staff.id && SalonDB.isFree(s.id, date, min, dur, a.id));
    const buttons = alts.map(m => ({ label: `Mover a las ${U.fmtTime(U.fromMin(m))}`, run: () => doMove(a, date, U.fromMin(m), staff.id) }));
    if (other) buttons.push({ label: `Con ${first(other.name)} a las ${U.fmtTime(start)}`, run: () => doMove(a, date, start, other.id) });
    return {
      text: `${first(staff.name)} ya tiene cita ${when(date, start)}.${alts.length ? ` Tiene libre a las ${alts.map(m => U.fmtTime(U.fromMin(m))).join(', ')}.` : ''}${other ? ` A esa hora está libre ${first(other.name)}.` : ''}${buttons.length ? ' Elige una opción.' : ' Prueba otro día.'}`,
      buttons,
    };
  }

  function cancelAppt(a) {
    const c = SalonDB.client(a.clientId), st = SalonDB.staffMember(a.staffId);
    ctx.apptId = a.id;
    return {
      text: `¿Cancelo la cita de ${c.name} (${svcTxt(a)}), ${when(a.date, a.start)} con ${first(st.name)}?`,
      confirm: {
        label: 'cancelar', run: () => {
          SalonDB.setStatus(a.id, 'cancelada');
          window.AdminUI.render();
          const fill = fillSuggestion(a.date, a.staffId, U.toMin(a.start));
          return { text: `Cancelada. ${first(st.name)} quedó libre ${when(a.date, a.start)}.${fill ? ' ' + fill.text : ''}`, buttons: [waBtn(a, 'cancel')], confirm: fill ? fill.confirm : null };
        },
      },
    };
  }

  /* ---------- Respuestas ---------- */
  function answer(raw) {
    const t = norm(raw);
    if (!t) return { text: 'No te escuché bien. ¿Me lo repites?' };

    // Cambios sobre citas existentes (van antes que "agendar")
    const client = findClient(t);
    const moveWords = has(t, 'mueve', 'mover', 'muevel', 'cambia', 'cambiar', 'pasa', 'pasal', 'adelant', 'atrasa', 'atrasal', 'retrasa', 'corre', 'reprogram');
    const refersToCita = client || /\b(la cita|esa cita|esa|pasala|muevela|cambiala|adelantala|atrasala|correla|cancelala)\b/.test(t);
    if (has(t, 'hueco', 'huecos', 'llena', 'rellena', 'aprovecha') || (has(t, 'adelant') && has(t, 'citas') && !client)) {
      const s = fillSuggestion(parseDate(t, true) || U.today(), (findStaff(t) || {}).id || null);
      return s || { text: `No encontré citas que se puedan adelantar ${dayLabel(parseDate(t, true) || U.today())}.` };
    }
    if (has(t, 'cancela', 'anula', 'elimina') && refersToCita) {
      const a = pickAppt(t, client);
      return a ? cancelAppt(a) : { text: client ? `${client.name} no tiene citas próximas.` : '¿De quién es la cita que quieres cancelar?' };
    }
    if (/\bconfirma(le|la)?\b/.test(t) && client) {
      const a = upcomingOf(client).find(x => x.status === 'pendiente') || upcomingOf(client)[0];
      if (!a) return { text: `${client.name} no tiene citas próximas.` };
      SalonDB.setStatus(a.id, 'confirmada');
      window.AdminUI.render();
      return { text: `Confirmé la cita de ${client.name}, ${when(a.date, a.start)}.`, buttons: [waBtn(a, 'confirm')] };
    }
    if (moveWords && refersToCita) {
      const a = pickAppt(t, client);
      if (a) return moveAppt(t, a);
      return { text: client ? `${client.name} no tiene citas próximas para mover.` : '¿De quién es la cita? Dime por ejemplo “mueve la cita de María a las 5”.' };
    }

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
  const history = [{ who: 'bot', text: '¡Hola! Soy tu asistente. Puedo mover, adelantar o cancelar citas y contarte cómo va el negocio. Toca el micrófono y háblame.' }];
  const runs = [];      // acciones de los botones del chat
  let pending = null;   // acción que espera un "sí"
  let rec = null;
  const YES = /^(si|dale|hazlo|ok|okey|okay|confirmo|confirmado|de una|claro|listo|por favor|si por favor|afirmativo|correcto)\b/;
  const NO = /^(no|mejor no|dejalo|deja asi|olvidalo|cancela eso)\b/;

  // Ejemplos con nombres reales de la agenda, para que la demo funcione al tocar
  function suggestions() {
    const next = SalonDB.appointments({ from: U.today() }).find(a => isActive(a) && !(a.date === U.today() && U.toMin(a.start) <= U.nowMin()));
    const out = ['¿Cómo voy hoy?'];
    if (next) {
      const n = SalonDB.client(next.clientId).name.split(' ').slice(0, 2).join(' ');
      out.push(`Adelanta la cita de ${n}`, `Mueve la cita de ${n} a las ${U.fmtTime(U.fromMin(Math.min(U.toMin(next.start) + 120, 17 * 60))).replace(':00', '').replace(/ (am|pm)/, '')}`);
    }
    out.push('Adelanta las citas de hoy', '¿Quién está libre mañana a las 4?', '¿Qué me recomiendas?');
    return out;
  }

  // Agrega la respuesta al chat; si pide confirmación, deja la acción esperando un "sí"
  function reply(r) {
    const buttons = (r.buttons || []).map(b => (b.run ? { ...b, i: runs.push(b.run) - 1 } : b));
    if (r.confirm) {
      pending = r.confirm.run;
      buttons.unshift({ label: `Sí, ${r.confirm.label}`, i: runs.push(() => { pending = null; return r.confirm.run(); }) - 1, primary: true },
        { label: 'No', i: runs.push(() => { pending = null; return { text: 'Listo, no cambio nada.' }; }) - 1 });
    }
    history.push({ who: 'bot', text: r.text, buttons });
    speak(r.text);
    if (r.then) setTimeout(r.then, 900);
  }

  function open() {
    UI.modal(`<div class="modal-head"><h2>✨ Asistente</h2><div class="row">
        <button class="icon-btn" id="asVoice" aria-label="${voiceOn ? 'Silenciar respuestas' : 'Leer respuestas en voz alta'}" title="Respuestas en voz alta">${voiceOn ? '🔊' : '🔇'}</button>
        <button class="icon-btn" data-action="close" aria-label="Cerrar">${UI.icon('close')}</button></div></div>
      <div class="chat" id="asChat" aria-live="polite"></div>
      <div class="chips mt" id="asChips">${suggestions().map(s => `<button class="chip" type="button">${esc(s)}</button>`).join('')}</div>
      <form class="row mt" id="asForm">
        <input id="asIn" autocomplete="off" placeholder="Escribe o toca el micrófono…" aria-label="Pregunta para el asistente">
        <button type="button" class="btn mic-btn" id="asMic" aria-label="Hablar">🎤</button>
        <button class="btn btn-primary" aria-label="Enviar">${UI.icon('right', 18)}</button>
      </form>
      ${SR ? '' : '<p class="muted small mt">En este navegador usa el micrófono del teclado para dictar.</p>'}`, m => {
      const chat = m.querySelector('#asChat'), input = m.querySelector('#asIn'), mic = m.querySelector('#asMic');
      const paint = () => {
        chat.innerHTML = history.map((h, k) => `<div class="bubble ${h.who}">${esc(h.text)}${h.buttons && h.buttons.length ? `<div class="bubble-actions">${h.buttons.map(b => b.href
          ? `<a class="btn btn-sm btn-wa" target="_blank" rel="noopener" href="${b.href}">${esc(b.label)}</a>`
          : `<button type="button" class="btn btn-sm ${b.primary ? 'btn-primary' : ''}" data-run="${b.i}" ${h.used ? 'disabled' : ''}>${esc(b.label)}</button>`).join('')}</div>` : ''}</div>`).join('');
        chat.scrollTop = chat.scrollHeight;
      };
      const runAction = i => {
        // Los botones de una respuesta se usan una sola vez
        history.forEach(h => { if (h.buttons && h.buttons.some(b => b.i === i)) h.used = true; });
        reply(runs[i]());
        paint();
      };
      const ask = q => {
        q = q.trim();
        if (!q) return;
        history.push({ who: 'me', text: q });
        input.value = '';
        const t = norm(q);
        if (pending && YES.test(t)) {
          const run = pending; pending = null;
          history.forEach(h => { if (h.buttons) h.used = true; });
          reply(run());
        } else if (pending && NO.test(t)) {
          pending = null;
          history.forEach(h => { if (h.buttons) h.used = true; });
          reply({ text: 'Listo, no cambio nada.' });
        } else {
          pending = null;
          reply(answer(q));
        }
        paint();
      };
      chat.addEventListener('click', e => { const b = e.target.closest('[data-run]'); if (b && !b.disabled) runAction(+b.dataset.run); });
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
