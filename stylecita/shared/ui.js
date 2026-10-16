/* Utilidades de interfaz compartidas: íconos, modales, avisos y gráficos SVG. */
(function () {
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5.5-5-6.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17c1-2 2.5-3 4-3s3 1 4 3"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    scissors: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16 19 3M16 16 5 3"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    pin: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  };

  let uidN = 0;
  // Ancho lógico menor en pantallas chicas para que los textos del gráfico se lean bien
  const chartW = () => (window.innerWidth < 520 ? 380 : 600);
  window.UI = {
    BRAND: 'StyleCita', // nombre del producto
    icon(name, size = 20) {
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
    },
    toast(msg, type = 'ok') {
      document.querySelectorAll('.toast').forEach(t => t.remove());
      const t = document.createElement('div');
      t.className = 'toast ' + type; t.setAttribute('role', 'status'); t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    },
    modal(html, onMount) {
      UI.closeModal();
      const bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
      bg.addEventListener('mousedown', e => { if (e.target === bg) UI.closeModal(); });
      document.body.appendChild(bg);
      document.body.style.overflow = 'hidden';
      if (onMount) onMount(bg.firstElementChild);
    },
    closeModal() {
      document.querySelectorAll('.modal-bg').forEach(x => x.remove());
      document.body.style.overflow = '';
    },
    isModalOpen: () => !!document.querySelector('.modal-bg'),
    formData: form => Object.fromEntries(new FormData(form).entries()),
    badge: s => `<span class="badge ${s.cls}">${U.esc(s.label)}</span>`,
    progress: pct => `<div class="progress" role="progressbar" aria-valuenow="${Math.round(pct * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(2, Math.min(100, pct * 100))}%"></span></div>`,
    download(filename, text) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    /* Abre la galería/cámara y devuelve la imagen reducida como data URL
       (fotos pequeñas para no llenar el almacenamiento). */
    pickImage({ max = 320, square = false, type = 'image/jpeg', quality = 0.82 } = {}) {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          input.remove();
          if (!file) return resolve(null);
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
            if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
            const scale = Math.min(1, max / Math.max(sw, sh));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
            const ctx = c.getContext('2d');
            if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL(type, quality));
          };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
          img.src = url;
        });
        input.click();
      });
    },
    // Logo del patrocinador de un reto, o sus iniciales en el color del reto
    sponsor(c, size = 40) {
      if (c.sponsorLogo) return `<img class="logo-img" src="${c.sponsorLogo}" alt="${U.esc(c.sponsor)}" style="width:${size}px;height:${size}px">`;
      return `<span class="sponsor-ini" style="width:${size}px;height:${size}px;background:${c.color || 'var(--accent)'};font-size:${Math.round(size * 0.36)}px">${U.esc(U.initials(c.sponsor || 'R'))}</span>`;
    },
    // Firma del producto en las pantallas del gimnasio
    poweredBy: () => '<a class="powered" href="../"><img src="../shared/icon.svg" alt="">con <strong>' + UI.BRAND + '</strong></a>',
    // Logo del gimnasio (el que sube el administrador) o el ícono por defecto
    logo(size = 36) {
      const l = SalonDB.settings.logo;
      return l
        ? `<img class="logo-img" src="${l}" alt="Logo" style="width:${size}px;height:${size}px">`
        : `<span class="logo-box" style="width:${size}px;height:${size}px">${UI.icon('scissors', Math.round(size * 0.55))}</span>`;
    },
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeModal(); });
  window.addEventListener('salondb-save-error', () => UI.toast('No hay espacio para guardar. Usa una imagen más pequeña.', 'bad'));

  /* ---------- Gráficos SVG livianos (sin librerías) ---------- */
  window.Charts = {
    line({ points, target = null, unit = 'kg', height = 190 }) {
      if (!points.length) return '<div class="empty small">Aún no hay registros para graficar</div>';
      const W = chartW(), H = height, pl = 34, pr = 12, pt = 16, pb = 28, gid = 'lg' + (++uidN);
      const vals = points.map(p => p.value);
      const all = target != null ? [...vals, target] : vals;
      let min = Math.min(...all), max = Math.max(...all);
      if (max - min < 1) { min -= 1; max += 1; }
      const padV = (max - min) * 0.18; min -= padV; max += padV;
      const n = points.length;
      const x = i => pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1));
      const y = v => pt + (max - v) * (H - pt - pb) / (max - min);
      const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart" role="img" aria-label="Gráfico de evolución"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
      for (let k = 0; k <= 3; k++) {
        const v = min + (max - min) * k / 3, yy = y(v);
        s += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--border)" stroke-width="1"/><text x="${pl - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.round(v)}</text>`;
      }
      if (target != null) {
        const ty = y(target);
        s += `<line x1="${pl}" x2="${W - pr}" y1="${ty}" y2="${ty}" stroke="var(--ok)" stroke-width="2" stroke-dasharray="6 5"/><text x="${pl + 4}" y="${ty - 6}" text-anchor="start" font-size="12" font-weight="700" fill="var(--ok)">Meta ${U.num(target)} ${unit}</text>`;
      }
      if (n > 1) s += `<path d="M${x(0)},${H - pb} L${line.replace(/ /g, ' L')} L${x(n - 1)},${H - pb}Z" fill="url(#${gid})"/>`;
      s += `<polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
      points.forEach((p, i) => { s += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${i === n - 1 ? 5 : 3}" fill="${i === n - 1 ? 'var(--accent)' : 'var(--surface)'}" stroke="var(--accent)" stroke-width="2"><title>${U.fmtDate(p.date)}: ${U.num(p.value)} ${unit}</title></circle>`; });
      const step = Math.max(1, Math.ceil(n / 6));
      points.forEach((p, i) => { if (i % step === 0 || i === n - 1) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${U.fmtDate(p.date)}</text>`; });
      const last = points[n - 1];
      s += `<text x="${Math.min(x(n - 1), W - pr - 4)}" y="${y(last.value) - 10}" text-anchor="end" font-size="13" font-weight="800" fill="var(--text)">${U.num(last.value)} ${unit}</text>`;
      return s + '</svg>';
    },
    bars({ data, height = 190, fmt = v => v, highlightLast = false }) {
      if (!data.length) return '<div class="empty small">Sin datos</div>';
      const W = chartW(), H = height, pl = 4, pr = 4, pt = 22, pb = 26;
      const max = Math.max(1, ...data.map(d => d.value));
      const bw = (W - pl - pr) / data.length;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="chart" role="img" aria-label="Gráfico de barras">`;
      data.forEach((d, i) => {
        const h = (H - pt - pb) * d.value / max, x = pl + i * bw + bw * 0.18, w = bw * 0.64, yy = H - pb - h;
        const hot = highlightLast ? i === data.length - 1 : d.value === max;
        s += `<rect x="${x}" y="${yy}" width="${w}" height="${Math.max(h, 1)}" rx="5" fill="${hot ? 'var(--accent)' : 'var(--bar)'}"><title>${d.label}: ${fmt(d.value)}</title></rect>`;
        if (data.length <= 12) s += `<text x="${x + w / 2}" y="${yy - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${fmt(d.value)}</text>`;
        s += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${d.label}</text>`;
      });
      return s + '</svg>';
    },
    ring(pct, size = 110) {
      const r = 42, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
      const done = p >= 1;
      return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="ring" role="img" aria-label="${Math.round(p * 100)}% de la meta"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="10"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${done ? 'var(--ok)' : 'var(--accent)'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 50 50)"/><text x="50" y="${done ? 50 : 55}" text-anchor="middle" font-size="${done ? 20 : 22}" font-weight="800" fill="var(--text)">${done ? '🏆' : Math.round(p * 100) + '%'}</text>${done ? '<text x="50" y="68" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ok)">¡Lograda!</text>' : ''}</svg>`;
    },
  };
})();

/* Cédula ecuatoriana (10 dígitos, con dígito verificador) o RUC (13 dígitos terminado en 001) */
window.validId = function (v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 13) return /001$/.test(d) && Number(d.slice(0, 2)) >= 1 && Number(d.slice(0, 2)) <= 24;
  if (d.length !== 10 || Number(d.slice(0, 2)) < 1 || Number(d.slice(0, 2)) > 24) return false;
  const sum = [...d.slice(0, 9)].reduce((t, c, i) => { let n = Number(c) * (i % 2 ? 1 : 2); if (n > 9) n -= 9; return t + n; }, 0);
  return (10 - sum % 10) % 10 === Number(d[9]);
};
