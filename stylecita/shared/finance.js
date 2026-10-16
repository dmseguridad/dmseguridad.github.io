/* Finanzas: ingresos, comparaciones con la semana anterior, proyecciones y sugerencias.
   Todo se calcula con los datos de SalonDB; no guarda nada propio. */
(function () {
  const isDone = a => a.status === 'completada';
  const isOpen = a => a.status === 'pendiente' || a.status === 'confirmada';
  const sum = (list, f = a => a.price) => list.reduce((t, a) => t + f(a), 0);
  const appts = (from, to) => SalonDB.appointments({ from, to });
  const pct = (a, b) => (b ? (a - b) / b : null);
  const weekStart = d => U.addDays(d, -((U.weekday(d) + 6) % 7)); // lunes
  const monthStart = d => d.slice(0, 8) + '01';
  const monthEnd = d => { const x = U.parseISO(monthStart(d)); x.setMonth(x.getMonth() + 1); x.setDate(0); return U.toISO(x); };
  const days = (from, to) => { const out = []; for (let d = from; d <= to; d = U.addDays(d, 1)) out.push(d); return out; };
  const isOpenDay = d => !!SalonDB.settings.hours[U.weekday(d)];

  // Ingreso de servicios atendidos en un día (opcional: solo lo terminado antes de cierta hora)
  const dayRevenue = (date, untilMin = null) => sum(appts(date, date).filter(a => isDone(a) && (untilMin == null || U.toMin(a.end) <= untilMin)));
  const dayBooked = (date, afterMin = null) => sum(appts(date, date).filter(a => isOpen(a) && (afterMin == null || U.toMin(a.end) > afterMin)));
  const shopRevenue = (from, to) => sum(SalonDB.orders().filter(o => o.status === 'entregado' && o.createdAt >= from && o.createdAt <= to), o => o.total);

  // Qué parte de las citas reservadas termina atendida (últimos 30 días)
  function showRate() {
    const t = U.today(), list = appts(U.addDays(t, -30), U.addDays(t, -1));
    const done = list.filter(isDone).length, miss = list.filter(a => a.status === 'no_asistio').length;
    return done + miss ? done / (done + miss) : 0.9;
  }
  // Ingreso normal de ese día de la semana (promedio de las 4 semanas anteriores)
  function typicalDay(date) {
    if (!isOpenDay(date)) return 0;
    const vals = [7, 14, 21, 28].map(n => U.addDays(date, -n)).filter(d => d < U.today()).map(d => dayRevenue(d));
    return vals.length ? sum(vals, v => v) / vals.length : 0;
  }
  // Lo que se espera ganar un día futuro: lo reservado (con faltas) o lo normal de ese día, lo que sea mayor
  const expectedDay = (date, rate) => Math.max(dayBooked(date) * rate, typicalDay(date) * 0.95);

  /* Hoy contra el mismo día de la semana pasada, a la misma hora */
  function today() {
    const t = U.today(), lw = U.addDays(t, -7), now = U.nowMin(), rate = showRate();
    const sofar = dayRevenue(t), lwSameTime = dayRevenue(lw, now), lwTotal = dayRevenue(lw);
    const remaining = dayBooked(t, now) * rate;
    const projection = sofar + remaining;
    return { date: t, lwDate: lw, sofar, lwSameTime, lwTotal, remaining, projection, diff: pct(sofar, lwSameTime), projDiff: pct(projection, lwTotal) };
  }

  /* Semana o mes: lo que va, comparado con el mismo tramo del período anterior, y proyección de cierre */
  function period(kind) {
    const t = U.today(), rate = showRate();
    const from = kind === 'mes' ? monthStart(t) : weekStart(t);
    const end = kind === 'mes' ? monthEnd(t) : U.addDays(from, 6);
    const elapsed = days(from, t).length;
    const pFrom = kind === 'mes' ? monthStart(U.addDays(from, -1)) : U.addDays(from, -7);
    const pEnd = kind === 'mes' ? monthEnd(pFrom) : U.addDays(pFrom, 6);
    const pSame = U.addDays(pFrom, elapsed - 1) > pEnd ? pEnd : U.addDays(pFrom, elapsed - 1);
    const stats = (a, b) => {
      const list = appts(a, b);
      const done = list.filter(isDone);
      const services = sum(done), shop = shopRevenue(a, b);
      const noShows = list.filter(x => x.status === 'no_asistio');
      return {
        services, shop, total: services + shop, count: done.length, ticket: done.length ? services / done.length : 0,
        noShows: noShows.length, lost: sum(noShows) + sum(list.filter(x => x.status === 'cancelada')),
        newClients: SalonDB.clients().filter(c => c.createdAt >= a && c.createdAt <= b).length,
      };
    };
    const cur = stats(from, t), prevSame = stats(pFrom, pSame), prevFull = stats(pFrom, pEnd);
    // Proyección: lo ganado + lo que falta de hoy + lo esperado en los días que quedan
    const projection = cur.total + dayBooked(t, U.nowMin()) * rate + sum(days(U.addDays(t, 1), end), d => expectedDay(d, rate));
    return { kind, from, end, pFrom, pEnd, cur, prevSame, prevFull, projection, diff: pct(cur.total, prevSame.total), projDiff: pct(projection, prevFull.total) };
  }

  /* Ingresos por día de esta semana contra la semana pasada (los días que faltan muestran lo reservado) */
  function weekCompare() {
    const t = U.today(), from = weekStart(t);
    return [0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = U.addDays(from, i), lw = U.addDays(d, -7);
      return { label: U.DAYS_SHORT[U.weekday(d)], now: d <= t ? dayRevenue(d) : 0, booked: d >= t ? dayBooked(d, d === t ? U.nowMin() : null) : 0, last: dayRevenue(lw), isToday: d === t };
    });
  }

  function byStaff(from, to) {
    const t = U.today(), until = to > t ? t : to;
    return SalonDB.staff().map(st => {
      const list = SalonDB.appointments({ from, to, staffId: st.id });
      const done = list.filter(isDone);
      // Ocupación: minutos con citas sobre minutos de trabajo
      let avail = 0, busy = 0;
      days(from, until).forEach(d => {
        const w = SalonDB.windowFor(st.id, d);
        if (!w) return;
        avail += w[1] - w[0];
        busy += sum(list.filter(a => a.date === d && a.status !== 'cancelada'), a => U.toMin(a.end) - U.toMin(a.start));
      });
      return { staff: st, revenue: sum(done), count: done.length, ticket: done.length ? sum(done) / done.length : 0, occupancy: avail ? Math.min(1, busy / avail) : 0 };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  function byCategory(from, to) {
    const out = {};
    appts(from, to).filter(isDone).forEach(a => a.serviceIds.forEach(id => {
      const s = SalonDB.service(id);
      if (s) out[s.category] = (out[s.category] || 0) + s.price;
    }));
    return Object.entries(out).map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue);
  }

  function byPayment(from, to) {
    const items = [...appts(from, to).filter(a => a.status !== 'cancelada').map(a => ({ amount: a.price, p: SalonDB.paymentOf(a) })),
      ...SalonDB.orders().filter(o => o.status !== 'cancelado' && o.createdAt >= from && o.createdAt <= to).map(o => ({ amount: o.total, p: SalonDB.paymentOf(o) }))];
    const tr = items.filter(x => x.p.method === 'transferencia');
    return {
      salon: sum(items.filter(x => x.p.method !== 'transferencia'), x => x.amount),
      transfer: sum(tr, x => x.amount),
      verified: sum(tr.filter(x => x.p.status === 'verificado'), x => x.amount),
      toReview: sum(tr.filter(x => x.p.status === 'en_revision'), x => x.amount),
      missing: sum(tr.filter(x => ['pendiente', 'rechazado'].includes(x.p.status)), x => x.amount),
    };
  }

  // Espacios libres de 30 min que quedan hoy (o en una fecha)
  function freeSlots(date) {
    const now = date === U.today() ? U.nowMin() : 0;
    let n = 0;
    SalonDB.staff().forEach(st => {
      const w = SalonDB.windowFor(st.id, date);
      if (!w) return;
      for (let m = Math.ceil(Math.max(w[0], now) / 30) * 30; m + 30 <= w[1]; m += 30) if (SalonDB.isFree(st.id, date, m, 30)) n++;
    });
    return n;
  }

  /* Sugerencias automáticas a partir de los datos (reglas, no un modelo de lenguaje) */
  function insights() {
    const out = [], t = U.today(), name = SalonDB.settings.salonName;
    const td = today(), dayName = U.DAYS[U.weekday(t)].toLowerCase();
    const free = freeSlots(t), freeTomorrow = freeSlots(U.addDays(t, 1));
    const share = `¡Tenemos espacios libres hoy en ${name}! 💇‍♀️ Reserva tu cita desde la app: ${new URL('../cliente/', location.href).href}`;

    if (td.diff != null && td.diff <= -0.1) out.push({ level: 'bad', icon: '📉', title: `Hoy vas ${Math.round(-td.diff * 100)}% abajo del ${dayName} pasado`, text: `A esta hora llevabas ${U.money(td.lwSameTime)} y hoy ${U.money(td.sofar)}.${free ? ` Te quedan ${free} espacios libres de 30 min: compártelos en tus estados.` : ''}`, action: free ? { label: 'Compartir horarios', href: 'https://wa.me/?text=' + encodeURIComponent(share) } : null });
    else if (td.diff != null && td.diff >= 0.1) out.push({ level: 'ok', icon: '📈', title: `Hoy vas ${Math.round(td.diff * 100)}% arriba del ${dayName} pasado`, text: `Llevas ${U.money(td.sofar)} contra ${U.money(td.lwSameTime)} a la misma hora. ¡Buen día!` });
    else if (free >= 4) out.push({ level: 'warn', icon: '🕒', title: `Quedan ${free} espacios libres hoy`, text: 'Un estado de WhatsApp con tus horarios libres suele llenar la tarde.', action: { label: 'Compartir horarios', href: 'https://wa.me/?text=' + encodeURIComponent(share) } });

    // Día más flojo de la semana (últimas 4 semanas)
    const byDay = {};
    days(U.addDays(t, -28), U.addDays(t, -1)).filter(isOpenDay).forEach(d => { const w = U.weekday(d); (byDay[w] = byDay[w] || []).push(dayRevenue(d)); });
    const avgs = Object.entries(byDay).map(([w, v]) => ({ w: +w, avg: sum(v, x => x) / v.length }));
    if (avgs.length > 2) {
      const mean = sum(avgs, x => x.avg) / avgs.length, low = avgs.sort((a, b) => a.avg - b.avg)[0];
      if (low.avg < mean * 0.8) out.push({ level: 'warn', icon: '💡', title: `Los ${U.DAYS[low.w].toLowerCase()} son tu día más flojo`, text: `Facturas ${Math.round((1 - low.avg / mean) * 100)}% menos que un día promedio. Prueba una promo solo para ese día (ej.: 10% en color o “trae a un amigo”).` });
    }

    // Ocupación del equipo esta semana
    const staff = byStaff(weekStart(t), t).filter(s => s.occupancy > 0);
    if (staff.length > 1) {
      const sorted = [...staff].sort((a, b) => b.occupancy - a.occupancy), hi = sorted[0], lo = sorted[sorted.length - 1];
      if (hi.occupancy - lo.occupancy > 0.25) out.push({ level: 'info', icon: '👥', title: `${U.first(hi.staff.name)} está al ${Math.round(hi.occupancy * 100)}% y ${U.first(lo.staff.name)} al ${Math.round(lo.occupancy * 100)}%`, text: `Cuando ${U.first(hi.staff.name)} esté lleno, ofrece a ${U.first(lo.staff.name)} para no perder la cita.` });
    }

    // Clientes que no vuelven
    const lost = SalonDB.clients().map(c => ({ c, s: SalonDB.clientStats(c.id) }))
      .filter(x => x.s.visits >= 2 && x.s.last && x.s.last < U.addDays(t, -21) && !SalonDB.appointments({ clientId: x.c.id, from: t }).some(isOpen))
      .sort((a, b) => b.s.spent - a.s.spent).slice(0, 3);
    if (lost.length) out.push({ level: 'info', icon: '💌', title: `${lost.length} buenos clientes no vuelven hace más de 3 semanas`, text: lost.map(x => `${x.c.name} (${U.money(x.s.spent)})`).join(', ') + '. Escríbeles para invitarlos a volver.', action: { label: `Escribir a ${U.first(lost[0].c.name)}`, href: U.waLink(lost[0].c.phone, `Hola ${U.first(lost[0].c.name)} 👋 ¡Te extrañamos en ${name}! Esta semana tenemos horarios libres, reserva desde la app 💇‍♀️`) } });

    // Faltas
    const rate = showRate();
    if (rate < 0.93) out.push({ level: 'warn', icon: '⚠️', title: `${Math.round((1 - rate) * 100)}% de las citas terminan en falta`, text: 'Envía el recordatorio por WhatsApp el día anterior, o pide un anticipo por transferencia para servicios largos como color o keratina.' });

    if (freeTomorrow >= 6 && out.length < 5) out.push({ level: 'info', icon: '📅', title: `Mañana tienes ${freeTomorrow} espacios libres`, text: 'Todavía estás a tiempo de llenarlos con un estado o un mensaje a tus clientes frecuentes.' });

    const low = SalonDB.dashboard().lowStock;
    if (low.length) out.push({ level: 'warn', icon: '📦', title: `Se está acabando: ${low.map(p => p.name).join(', ')}`, text: 'Pide a tu proveedor antes de quedarte sin stock.' });
    return out;
  }

  window.Finance = { today, period, weekCompare, byStaff, byCategory, byPayment, insights, freeSlots, weekStart, monthStart, pct };
})();
