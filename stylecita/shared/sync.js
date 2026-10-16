/* Sincronización en vivo SOLO PARA LA DEMO, con ntfy.sh (servicio gratis de avisos, sin cuenta).
   Cada reserva, cambio de estado, pedido o comprobante se publica en un "tema" y todos los
   aparatos con la app abierta (celular del cliente, compu del salón, TV) lo reciben al instante.
   El tema es público: usar solo datos de prueba. En producción esto se reemplaza por Supabase. */
(function () {
  const TOPIC = 'stylecita-demo-q7k2m9x4';
  const BASE = 'https://ntfy.sh/' + TOPIC;
  const DEVICE = (() => {
    try {
      let d = localStorage.getItem('salon_device');
      if (!d) { d = U.uid(); localStorage.setItem('salon_device', d); }
      return d;
    } catch (e) { return U.uid(); }
  })();
  const startedAt = Date.now() / 1000;
  const seen = new Set(); // mensajes ya aplicados (al reconectar, ntfy los vuelve a mandar)

  async function send(evt, image) {
    const msg = JSON.stringify({ ...evt, from: DEVICE });
    try {
      if (image) {
        // La foto del comprobante va como archivo adjunto; los datos van en la cabecera
        const blob = await (await fetch(image)).blob();
        await fetch(BASE, { method: 'PUT', body: blob, headers: { 'X-Filename': 'comprobante.jpg', 'X-Message': msg } });
      } else {
        await fetch(BASE, { method: 'POST', body: msg });
      }
    } catch (e) { /* sin internet: el cambio queda guardado en este aparato */ }
  }
  SalonDB.setPublisher((evt, image) => { send(evt, image); });

  // Indicador "En vivo" (solo en el panel del salón)
  let badge = null;
  if (/\/admin\//.test(location.pathname)) {
    badge = document.createElement('div');
    badge.className = 'live-badge';
    document.body.appendChild(badge);
  }
  function setLive(on) {
    if (!badge) return;
    badge.classList.toggle('on', on);
    badge.textContent = on ? 'En vivo' : 'Conectando…';
  }
  setLive(false);

  function connect() {
    // since=12h: al abrir, también recibe lo que pasó en las últimas horas
    const es = new EventSource(BASE + '/sse?since=12h');
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false); // EventSource reintenta solo
    es.onmessage = ev => {
      let m, evt;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.event !== 'message' || seen.has(m.id)) return;
      seen.add(m.id);
      try { evt = JSON.parse(m.message); } catch (e) { return; }
      if (!evt || !evt.t) return;
      SalonDB.applyRemote(evt, m.attachment && m.attachment.url);
      setLive(true);
      window.dispatchEvent(new CustomEvent('salondb-change', {
        detail: { ...evt, remote: evt.from !== DEVICE, replay: m.time < startedAt - 5 },
      }));
    };
  }
  if ('EventSource' in window) connect();
})();
