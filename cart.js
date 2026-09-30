(function(){
  'use strict';

  const CART_KEY = 'dmCart';
  const WHATSAPP_NUMBER = '593980781862';
  // Cámaras analógicas (HDTVI/AHD/CVI) necesitan DVR. Las EZVIZ son IP/WiFi y graban en microSD, no en DVR.
  const ANALOG_CAM_CATS = ['cctv'];
  const IP_CAM_CATS = ['ezviz'];

  const DVR_TABLE = [
    { max: 8,  sku: 'DMS-DVR-001', name: 'DVR HiLook 8CH + 4 IP, hasta 6MP' },
    { max: 16, sku: 'DMS-DVR-002', name: 'DVR HiLook 16 canales 720P-1080P Lite' },
    { max: Infinity, sku: null, name: null }
  ];
  const SD_CARD = { sku: 'TF-C1-32G', name: 'MicroSD Hiksemi 32GB Clase 10' };

  function getCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch(e){ return []; }
  }
  function setCart(cart){
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  }
  function findItem(cart, sku){ return cart.find(i => i.sku === sku); }

  function addToCart(item){
    const cart = getCart();
    const existing = findItem(cart, item.sku);
    if (existing) existing.qty += 1;
    else cart.push(Object.assign({ qty: 1 }, item));
    setCart(cart);
    openDrawer();
  }
  function setQty(sku, qty){
    let cart = getCart();
    if (qty <= 0){
      cart = cart.filter(i => i.sku !== sku);
    } else {
      const it = findItem(cart, sku);
      if (it) it.qty = qty;
    }
    setCart(cart);
  }
  function removeItem(sku){ setQty(sku, 0); }
  function clearCart(){ setCart([]); }

  // Listed prices are before VAT; IVA (15%) is added at checkout.
  const IVA_RATE = 0.15;
  function cartTotal(cart){ return cart.reduce((s,i) => s + (i.price * i.qty), 0); }
  function round2(n){ return Math.round(n * 100) / 100; }
  function cartTotals(cart){
    const subtotal = round2(cartTotal(cart));
    const iva = round2(subtotal * IVA_RATE);
    return { subtotal, iva, total: round2(subtotal + iva) };
  }
  function cartCount(cart){ return cart.reduce((s,i) => s + i.qty, 0); }
  function analogCamCount(cart){
    return cart.filter(i => ANALOG_CAM_CATS.indexOf(i.cat) !== -1).reduce((s,i) => s + i.qty, 0);
  }
  function ipCamCount(cart){
    return cart.filter(i => IP_CAM_CATS.indexOf(i.cat) !== -1).reduce((s,i) => s + i.qty, 0);
  }
  function recommendDVR(nCams){
    if (nCams <= 0) return null;
    for (const row of DVR_TABLE){
      if (nCams <= row.max) return row;
    }
    return null;
  }
  function recommendSD(nIpCams){
    if (nIpCams <= 0) return null;
    return Object.assign({ qty: nIpCams }, SD_CARD);
  }
  function money(n){ return '$' + n.toFixed(2); }

  function waLink(msg){
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  // ---------- UI injection ----------
  const css = `
  .dm-cart-fab{position:fixed; left:18px; bottom:18px; z-index:90; background:#192D3D; color:#fff; width:58px; height:58px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(0,0,0,0.35); cursor:pointer; font-size:24px; border:none;}
  .dm-cart-fab:hover{background:#0DCC30;}
  .dm-cart-badge{position:absolute; top:-4px; right:-4px; background:#FCFC00; color:#192D3D; font-size:11px; font-weight:800; min-width:20px; height:20px; border-radius:10px; display:flex; align-items:center; justify-content:center; padding:0 5px; font-family:system-ui,sans-serif;}
  .dm-cart-overlay{position:fixed; inset:0; background:rgba(9,15,20,0.55); z-index:98; display:none;}
  .dm-cart-overlay.open{display:block;}
  .dm-cart-drawer{position:fixed; top:0; right:-420px; width:100%; max-width:420px; height:100%; background:#EEF0F2; z-index:99; box-shadow:-10px 0 40px rgba(0,0,0,0.3); transition:right .25s ease; display:flex; flex-direction:column; font-family:'Public Sans',system-ui,sans-serif;}
  .dm-cart-drawer.open{right:0;}
  .dm-cart-head{background:#192D3D; color:#fff; padding:18px 20px; display:flex; align-items:center; justify-content:space-between; font-family:'Barlow Semi Condensed',system-ui,sans-serif;}
  .dm-cart-head h2{margin:0; font-size:20px; font-weight:700;}
  .dm-cart-close{background:none; border:none; color:#fff; font-size:22px; cursor:pointer; line-height:1;}
  .dm-cart-body{flex:1; overflow-y:auto; padding:16px 20px;}
  .dm-cart-empty{color:#7C8894; font-size:14px; text-align:center; padding:40px 10px;}
  .dm-cart-item{display:flex; gap:12px; background:#fff; border:1px solid #DDE1E4; border-radius:12px; padding:12px; margin-bottom:12px;}
  .dm-cart-item img{width:64px; height:64px; object-fit:cover; border-radius:8px; background:#EEF0F2; flex-shrink:0; border:1px solid #DDE1E4;}
  .dm-cart-item-info{flex:1; min-width:0;}
  .dm-cart-item-info .sku{font-family:ui-monospace,monospace; font-size:10px; font-weight:700; color:#0DCC30; background:#EEF0F2; border:1px solid #DDE1E4; border-radius:5px; padding:2px 6px; display:inline-block; margin-bottom:4px;}
  .dm-cart-item-info h4{margin:0 0 4px; font-size:13.5px; font-weight:700; color:#192D3D; font-family:'Barlow Semi Condensed',system-ui,sans-serif;}
  .dm-cart-item-info .price-line{font-size:12.5px; color:#4B5866;}
  .dm-cart-qty{display:flex; align-items:center; gap:8px; margin-top:8px;}
  .dm-cart-qty button{width:26px; height:26px; border-radius:6px; border:1px solid #DDE1E4; background:#EEF0F2; font-size:15px; font-weight:700; cursor:pointer; color:#192D3D;}
  .dm-cart-qty button:hover{background:#DDE1E4;}
  .dm-cart-qty span{font-weight:700; min-width:18px; text-align:center; font-size:13.5px;}
  .dm-cart-remove{background:none; border:none; color:#c0392b; font-size:12px; font-weight:700; cursor:pointer; padding:0; margin-top:8px;}
  .dm-cart-dvr{background:#FFFBE0; border:1px solid #FCFC00; border-radius:10px; padding:12px 14px; font-size:12.5px; color:#192D3D; margin-bottom:12px;}
  .dm-cart-dvr strong{display:block; font-size:13px; margin-bottom:3px;}
  .dm-cart-sd{background:#EAFBEE; border:1px solid #0DCC30; border-radius:10px; padding:12px 14px; font-size:12.5px; color:#192D3D; margin-bottom:14px;}
  .dm-cart-sd strong{display:block; font-size:13px; margin-bottom:3px;}
  .dm-cart-foot{border-top:1px solid #DDE1E4; padding:16px 20px; background:#fff;}
  .prod-card .price::after, .product-info .price::after, .acc-card .price::after{content:" + IVA"; font-size:0.55em; font-weight:600; color:#7C8894; letter-spacing:.02em;}
  .dm-cart-line{display:flex; justify-content:space-between; font-size:13.5px; color:#4B5866; margin-bottom:4px;}
  .dm-cart-total{display:flex; justify-content:space-between; font-size:16px; font-weight:800; color:#192D3D; margin-bottom:12px; font-family:'Barlow Semi Condensed',system-ui,sans-serif;}
  .dm-cart-checkout{display:block; width:100%; background:#25D366; color:#fff; border:none; padding:14px; border-radius:10px; font-weight:700; font-size:14.5px; cursor:pointer; text-align:center;}
  .dm-cart-checkout:hover{background:#1DA851;}
  .dm-cart-checkout:disabled{background:#B7C0C7; cursor:not-allowed;}
  .dm-cart-clear{display:block; width:100%; background:none; border:none; color:#7C8894; font-size:12px; text-align:center; margin-top:10px; cursor:pointer; text-decoration:underline;}
  .dm-cart-form{background:#fff; border:1px solid #DDE1E4; border-radius:12px; padding:14px; margin-top:6px;}
  .dm-cart-form h3{margin:0 0 4px; font-size:14.5px; color:#192D3D; font-family:'Barlow Semi Condensed',system-ui,sans-serif;}
  .dm-cart-form .hint{font-size:11.5px; color:#7C8894; margin:0 0 10px;}
  .dm-cart-form label{display:block; font-size:12px; font-weight:700; color:#4B5866; margin:10px 0 4px;}
  .dm-cart-form label small{font-weight:400; color:#7C8894;}
  .dm-cart-form input, .dm-cart-form select{width:100%; box-sizing:border-box; padding:10px 11px; border:1px solid #C9D0D6; border-radius:8px; font-size:14px; font-family:inherit; color:#192D3D; background:#fff;}
  .dm-cart-form input:focus, .dm-cart-form select:focus{outline:none; border-color:#0DCC30; box-shadow:0 0 0 3px rgba(13,204,48,0.15);}
  .dm-cart-form input.bad{border-color:#c0392b;}
  .dm-cart-form .err{display:none; font-size:11.5px; color:#c0392b; margin-top:3px;}
  .dm-cart-form .err.show{display:block;}
  .dm-add-btn{display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#fff; background:#192D3D; border:none; padding:9px 14px; border-radius:8px; cursor:pointer; text-decoration:none;}
  .dm-add-btn:hover{background:#0DCC30;}
  .dm-add-btn.big{padding:14px 26px; border-radius:10px; font-size:15px;}
  .dm-add-ok{background:#0DCC30 !important;}
  @media (max-width:480px){ .dm-cart-drawer{max-width:100%; right:-100%;} }
  `;
  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  const fab = document.createElement('button');
  fab.className = 'dm-cart-fab';
  fab.setAttribute('aria-label', 'Ver carrito');
  fab.innerHTML = '🛒<span class="dm-cart-badge" id="dmCartBadge" style="display:none;">0</span>';
  document.body.appendChild(fab);

  const overlay = document.createElement('div');
  overlay.className = 'dm-cart-overlay';
  document.body.appendChild(overlay);

  const drawer = document.createElement('div');
  drawer.className = 'dm-cart-drawer';
  drawer.innerHTML = `
    <div class="dm-cart-head">
      <h2>Tu carrito</h2>
      <button class="dm-cart-close" aria-label="Cerrar">✕</button>
    </div>
    <div class="dm-cart-body" id="dmCartBody"></div>
    <div class="dm-cart-foot" id="dmCartFoot"></div>
  `;
  document.body.appendChild(drawer);

  function openDrawer(){ drawer.classList.add('open'); overlay.classList.add('open'); }
  function closeDrawer(){ drawer.classList.remove('open'); overlay.classList.remove('open'); }
  fab.addEventListener('click', () => { drawer.classList.contains('open') ? closeDrawer() : openDrawer(); });
  overlay.addEventListener('click', closeDrawer);
  drawer.querySelector('.dm-cart-close').addEventListener('click', closeDrawer);

  function renderCart(){
    const cart = getCart();
    const badge = document.getElementById('dmCartBadge');
    const count = cartCount(cart);
    if (count > 0){ badge.style.display = 'flex'; badge.textContent = count; }
    else { badge.style.display = 'none'; }

    const body = document.getElementById('dmCartBody');
    const foot = document.getElementById('dmCartFoot');
    if (!body || !foot) return;

    if (cart.length === 0){
      body.innerHTML = '<div class="dm-cart-empty">Tu carrito está vacío.<br>Agrega equipos desde el catálogo.</div>';
      foot.innerHTML = '';
      return;
    }

    let html = '';
    const nAnalog = analogCamCount(cart);
    const nIp = ipCamCount(cart);
    const dvr = recommendDVR(nAnalog);
    const sd = recommendSD(nIp);
    if (dvr){
      if (dvr.sku){
        html += `<div class="dm-cart-dvr"><strong>📹 Recomendación de grabador (DVR)</strong>Con ${nAnalog} cámara(s) analógica(s) te recomendamos el <strong>${dvr.name}</strong> (${dvr.sku}). Un asesor lo confirmará contigo.</div>`;
      } else {
        html += `<div class="dm-cart-dvr"><strong>📹 Recomendación de grabador (DVR)</strong>Con ${nAnalog} cámaras analógicas, un asesor te recomendará el mejor grabador o si conviene más de uno.</div>`;
      }
    }
    if (sd){
      html += `<div class="dm-cart-sd"><strong>💾 Recomendación de almacenamiento</strong>Tus ${nIp} cámara(s) EZVIZ son IP y graban en microSD, no en DVR. Te recomendamos ${sd.qty} × <strong>${sd.name}</strong> (${sd.sku}), una por cámara.</div>`;
    }

    cart.forEach(item => {
      const imgHtml = item.img ? `<img src="${item.img}" alt="${item.name}">` : '';
      html += `
        <div class="dm-cart-item" data-sku="${item.sku}">
          ${imgHtml}
          <div class="dm-cart-item-info">
            <div class="sku">${item.sku}</div>
            <h4>${item.name}</h4>
            <div class="price-line">${money(item.price)} c/u + IVA · Subtotal: <strong>${money(item.price * item.qty)}</strong></div>
            <div class="dm-cart-qty">
              <button data-act="dec">−</button>
              <span>${item.qty}</span>
              <button data-act="inc">+</button>
            </div>
            <button class="dm-cart-remove" data-act="remove">Quitar</button>
          </div>
        </div>`;
    });
    const c = getCustomer();
    html += `
      <div class="dm-cart-form" id="dmCartForm">
        <h3>Tus datos</h3>
        <p class="hint">Los necesitamos para preparar tu cotización y poder contactarte.</p>
        <label for="dmTipoDoc">Tipo de documento</label>
        <select id="dmTipoDoc">
          <option value="cedula"${c.tipoDoc === 'pasaporte' ? '' : ' selected'}>Cédula o RUC</option>
          <option value="pasaporte"${c.tipoDoc === 'pasaporte' ? ' selected' : ''}>Pasaporte</option>
        </select>
        <label for="dmCedula" id="dmCedulaLabel">${c.tipoDoc === 'pasaporte' ? 'Número de pasaporte' : 'Cédula o RUC'}</label>
        <input id="dmCedula" inputmode="${c.tipoDoc === 'pasaporte' ? 'text' : 'numeric'}" maxlength="20" autocomplete="off" value="${esc(c.cedula)}">
        <div class="err" data-for="dmCedula">${c.tipoDoc === 'pasaporte' ? PASSPORT_ERR : CEDULA_ERR}</div>
        <label for="dmNombre">Nombres y apellidos</label>
        <input id="dmNombre" autocomplete="name" value="${esc(c.nombre)}">
        <div class="err" data-for="dmNombre">Ingresa tus nombres y apellidos.</div>
        <label for="dmWhatsapp">Número de WhatsApp</label>
        <input id="dmWhatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="09XXXXXXXX" value="${esc(c.whatsapp)}">
        <div class="err" data-for="dmWhatsapp">Ingresa un número válido (ej. 0991234567).</div>
        <label for="dmLlamadas">Número para llamadas <small>(solo si es diferente al de WhatsApp)</small></label>
        <input id="dmLlamadas" type="tel" inputmode="tel" placeholder="Opcional" value="${esc(c.llamadas)}">
        <div class="err" data-for="dmLlamadas">Ingresa un número válido o deja el campo vacío.</div>
      </div>`;
    body.innerHTML = html;

    document.getElementById('dmTipoDoc').addEventListener('change', e => {
      const pasaporte = e.target.value === 'pasaporte';
      const input = document.getElementById('dmCedula');
      document.getElementById('dmCedulaLabel').textContent = pasaporte ? 'Número de pasaporte' : 'Cédula o RUC';
      input.inputMode = pasaporte ? 'text' : 'numeric';
      input.classList.remove('bad');
      const err = body.querySelector('.err[data-for="dmCedula"]');
      err.textContent = pasaporte ? PASSPORT_ERR : CEDULA_ERR;
      err.classList.remove('show');
      saveCustomer(readCustomerForm());
    });

    ['dmCedula','dmNombre','dmWhatsapp','dmLlamadas'].forEach(id => {
      const input = document.getElementById(id);
      input.addEventListener('input', () => {
        input.classList.remove('bad');
        body.querySelector(`.err[data-for="${id}"]`).classList.remove('show');
        saveCustomer(readCustomerForm());
      });
    });

    body.querySelectorAll('.dm-cart-item').forEach(el => {
      const sku = el.dataset.sku;
      const item = findItem(cart, sku);
      el.querySelector('[data-act="inc"]').addEventListener('click', () => setQty(sku, item.qty + 1));
      el.querySelector('[data-act="dec"]').addEventListener('click', () => setQty(sku, item.qty - 1));
      el.querySelector('[data-act="remove"]').addEventListener('click', () => removeItem(sku));
    });

    const t = cartTotals(cart);
    foot.innerHTML = `
      <div class="dm-cart-line"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div class="dm-cart-line"><span>IVA 15%</span><span>${money(t.iva)}</span></div>
      <div class="dm-cart-total"><span>Total estimado</span><span>${money(t.total)}</span></div>
      <button class="dm-cart-checkout" id="dmCartCheckout">📄 Finalizar y enviar por WhatsApp</button>
      <button class="dm-cart-clear" id="dmCartClear">Vaciar carrito</button>
    `;
    document.getElementById('dmCartCheckout').addEventListener('click', checkout);
    document.getElementById('dmCartClear').addEventListener('click', () => {
      if (confirm('¿Vaciar el carrito?')) clearCart();
    });
  }

  // ---------- Customer data (required before checkout) ----------
  const CUSTOMER_KEY = 'dm_cart_customer';
  const CEDULA_ERR = 'Ingresa una cédula (10 dígitos) o RUC (13 dígitos) válido.';
  const PASSPORT_ERR = 'Ingresa un número de pasaporte válido (letras y números).';
  function esc(s){ return String(s || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function getCustomer(){
    try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {}; } catch(e){ return {}; }
  }
  function saveCustomer(c){
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c)); } catch(e){}
  }
  function readCustomerForm(){
    const v = id => (document.getElementById(id)?.value || '').trim();
    return { tipoDoc: v('dmTipoDoc') || 'cedula', cedula: v('dmCedula'), nombre: v('dmNombre'), whatsapp: v('dmWhatsapp'), llamadas: v('dmLlamadas') };
  }
  // Ecuadorian cédula (módulo 10); a RUC is a valid cédula + 001, or 13 digits for companies.
  function validCedula(id){
    if (/^\d{13}$/.test(id)) return id.endsWith('001') && (validCedula(id.slice(0,10)) || /^\d{2}[69]/.test(id));
    if (!/^\d{10}$/.test(id)) return false;
    const prov = +id.slice(0,2);
    if (!((prov >= 1 && prov <= 24) || prov === 30) || +id[2] > 5) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++){ let d = +id[i] * (i % 2 === 0 ? 2 : 1); if (d > 9) d -= 9; sum += d; }
    return (10 - sum % 10) % 10 === +id[9];
  }
  function validPhone(p){ const d = p.replace(/[^\d]/g, ''); return d.length >= 9 && d.length <= 13; }
  function validateCustomer(c){
    const bad = [];
    const docOk = c.tipoDoc === 'pasaporte'
      ? /^[A-Za-z0-9]{5,20}$/.test(c.cedula.replace(/[\s-]/g, ''))
      : validCedula(c.cedula.replace(/\D/g, ''));
    if (!docOk) bad.push('dmCedula');
    if (c.nombre.split(/\s+/).filter(Boolean).length < 2) bad.push('dmNombre');
    if (!validPhone(c.whatsapp)) bad.push('dmWhatsapp');
    if (c.llamadas && !validPhone(c.llamadas)) bad.push('dmLlamadas');
    bad.forEach(id => {
      document.getElementById(id)?.classList.add('bad');
      document.querySelector(`.err[data-for="${id}"]`)?.classList.add('show');
    });
    if (bad.length) document.getElementById(bad[0])?.focus();
    return bad.length === 0;
  }

  // ---------- Checkout: PDF + WhatsApp handoff ----------
  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function generatePDF(cart, dvr, sd, customer){
    if (!window.jspdf){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 50;

    doc.setFillColor(25, 45, 61);
    doc.rect(0, 0, pageW, 70, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('DM Seguridad Digital', 40, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Pedido / Cotización generada desde el catálogo', 40, 48);
    doc.text('WhatsApp: +593 98 078 1862 · dmseguridaddigital.com', 40, 62);

    y = 100;
    doc.setTextColor(25,45,61);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Fecha: ' + new Date().toLocaleDateString('es-EC'), 40, y);
    y += 22;

    doc.setFillColor(238, 240, 242);
    doc.rect(40, y - 14, 515, customer.llamadas ? 76 : 62, 'F');
    doc.setFontSize(11);
    doc.text('DATOS DEL CLIENTE', 50, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    y += 16;
    doc.text('Nombres: ' + customer.nombre, 50, y);
    doc.text((customer.tipoDoc === 'pasaporte' ? 'Pasaporte: ' : 'Cédula / RUC: ') + customer.cedula, 330, y);
    y += 14;
    doc.text('WhatsApp: ' + customer.whatsapp, 50, y);
    if (customer.llamadas){ y += 14; doc.text('Número para llamadas: ' + customer.llamadas, 50, y); }
    doc.setFont('helvetica', 'bold');
    y += 36;

    doc.setFontSize(10.5);
    doc.text('CÓDIGO', 40, y);
    doc.text('PRODUCTO', 130, y);
    doc.text('CANT.', 380, y);
    doc.text('P. UNIT.', 430, y);
    doc.text('SUBTOTAL', 500, y);
    y += 8;
    doc.setDrawColor(220,220,220);
    doc.line(40, y, 555, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    cart.forEach(item => {
      const lines = doc.splitTextToSize(item.name, 240);
      doc.text(item.sku, 40, y);
      doc.text(lines, 130, y);
      doc.text(String(item.qty), 385, y);
      doc.text(money(item.price), 430, y);
      doc.text(money(item.price * item.qty), 500, y);
      y += Math.max(16, lines.length * 12) + 6;
      if (y > 740){ doc.addPage(); y = 50; }
    });

    y += 10;
    doc.setDrawColor(220,220,220);
    doc.line(40, y, 555, y);
    y += 20;
    const t = cartTotals(cart);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Subtotal:', 380, y); doc.text(money(t.subtotal), 555, y, { align: 'right' });
    y += 16;
    doc.text('IVA 15%:', 380, y); doc.text(money(t.iva), 555, y, { align: 'right' });
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('TOTAL ESTIMADO:', 380, y); doc.text(money(t.total), 555, y, { align: 'right' });

    if (dvr){
      y += 34;
      doc.setFillColor(255, 251, 224);
      doc.rect(40, y - 16, 515, dvr.sku ? 40 : 50, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Recomendación de grabador (DVR) para cámaras analógicas:', 50, y);
      doc.setFont('helvetica', 'normal');
      y += 16;
      if (dvr.sku){
        doc.text(dvr.name + ' (' + dvr.sku + ')', 50, y);
      } else {
        doc.text('Más de 16 cámaras: un asesor recomendará el mejor grabador.', 50, y);
      }
      y += 20;
    }

    if (sd){
      y += 14;
      doc.setFillColor(234, 251, 238);
      doc.rect(40, y - 16, 515, 40, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Recomendación de almacenamiento para cámaras EZVIZ (IP):', 50, y);
      doc.setFont('helvetica', 'normal');
      y += 16;
      doc.text(sd.qty + ' x ' + sd.name + ' (' + sd.sku + ')', 50, y);
    }

    y += 50;
    doc.setFontSize(9.5);
    doc.setTextColor(120,120,120);
    doc.text('Este documento es una preselección del cliente. Un asesor de DM Seguridad Digital confirmará', 40, y);
    doc.text('disponibilidad, precios finales y si el equipo recomendado es el adecuado para su instalación.', 40, y + 12);

    const filename = 'pedido-dm-seguridad-' + Date.now() + '.pdf';
    doc.save(filename);
    return filename;
  }

  async function checkout(){
    const cart = getCart();
    if (cart.length === 0) return;
    const customer = readCustomerForm();
    if (!validateCustomer(customer)) return;
    saveCustomer(customer);
    const btn = document.getElementById('dmCartCheckout');
    btn.disabled = true;
    btn.textContent = 'Generando PDF…';
    try {
      const nAnalog = analogCamCount(cart);
      const nIp = ipCamCount(cart);
      const dvr = recommendDVR(nAnalog);
      const sd = recommendSD(nIp);
      const filename = await generatePDF(cart, dvr, sd, customer);

      let msg = 'Hola, arme este pedido en su catálogo y descargué el PDF (' + filename + '). Adjunto el PDF a este chat.\n\n';
      msg += '*Mis datos*\n';
      msg += 'Nombres: ' + customer.nombre + '\n';
      msg += (customer.tipoDoc === 'pasaporte' ? 'Pasaporte: ' : 'Cédula/RUC: ') + customer.cedula + '\n';
      msg += 'WhatsApp: ' + customer.whatsapp + '\n';
      if (customer.llamadas) msg += 'Número para llamadas: ' + customer.llamadas + '\n';
      msg += '\n*Mi pedido*\n';
      cart.forEach(item => {
        msg += '• ' + item.qty + 'x ' + item.name + ' (' + item.sku + ') — ' + money(item.price * item.qty) + '\n';
      });
      const t = cartTotals(cart);
      msg += '\nSubtotal: ' + money(t.subtotal);
      msg += '\nIVA 15%: ' + money(t.iva);
      msg += '\n*Total estimado: ' + money(t.total) + '*';
      if (dvr && dvr.sku){
        msg += '\nGrabador recomendado: ' + dvr.name + ' (' + dvr.sku + ')';
      } else if (dvr){
        msg += '\nTengo ' + nAnalog + ' cámaras analógicas, ¿qué grabador me recomiendan?';
      }
      if (sd){
        msg += '\nAlmacenamiento recomendado: ' + sd.qty + 'x ' + sd.name + ' (' + sd.sku + ')';
      }
      msg += '\n\n¿Está bien lo que escogí o me recomiendan algún cambio?';

      btn.textContent = '📎 Abriendo WhatsApp…';
      setTimeout(() => {
        window.open(waLink(msg), '_blank');
        btn.disabled = false;
        btn.textContent = '📄 Finalizar y enviar por WhatsApp';
      }, 400);
    } catch(e){
      console.error(e);
      alert('No se pudo generar el PDF. Intenta de nuevo o escríbenos directo por WhatsApp.');
      btn.disabled = false;
      btn.textContent = '📄 Finalizar y enviar por WhatsApp';
    }
  }

  // ---------- Auto-convert "Cotizar" buttons on priced products ----------
  function enhanceProductCards(){
    document.querySelectorAll('.prod-card, .acc-card').forEach(card => {
      const priceEl = card.querySelector('.price');
      const waLinkEl = card.querySelector('a.wa-link');
      if (!priceEl || !waLinkEl) return;
      const skuEl = card.querySelector('.sku');
      const nameEl = card.querySelector('h3');
      if (!skuEl || !nameEl) return;

      const sku = skuEl.textContent.trim();
      const name = nameEl.textContent.trim();
      const price = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
      if (isNaN(price)) return;
      const cat = card.dataset.cat || '';
      const imgEl = card.querySelector('.prod-photo img, .acc-photo img');
      const img = imgEl ? imgEl.getAttribute('src') : '';

      const btn = document.createElement('button');
      btn.className = 'dm-add-btn';
      btn.type = 'button';
      btn.textContent = '🛒 Agregar al carrito';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        addToCart({ sku, name, price, cat, img });
        btn.textContent = '✓ Agregado';
        btn.classList.add('dm-add-ok');
        setTimeout(() => { btn.textContent = '🛒 Agregar al carrito'; btn.classList.remove('dm-add-ok'); }, 1400);
      });
      waLinkEl.replaceWith(btn);
    });

    // main hero CTA on product detail pages (button says "💬 Cotizar por WhatsApp")
    const heroBtn = document.querySelector('.product-info .btn-cotizar.wa-link, .btn-cotizar.wa-link');
    const heroPrice = document.querySelector('.product-info .price');
    const heroSku = document.querySelector('.product-info .sku');
    const heroName = document.querySelector('.product-info h1');
    if (heroBtn && heroPrice && heroSku && heroName){
      const sku = heroSku.textContent.trim();
      const name = heroName.textContent.trim();
      const price = parseFloat(heroPrice.textContent.replace(/[^0-9.]/g, ''));
      const heroImgEl = document.querySelector('.product-photo img');
      const img = heroImgEl ? heroImgEl.getAttribute('src') : '';
      if (!isNaN(price)){
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '10px';
        wrap.style.flexWrap = 'wrap';

        const addBtn = document.createElement('button');
        addBtn.className = 'dm-add-btn big';
        addBtn.type = 'button';
        addBtn.textContent = '🛒 Agregar al carrito';
        addBtn.addEventListener('click', () => {
          addToCart({ sku, name, price, cat: (window.DM_PRODUCT_CAT || ''), img });
          addBtn.textContent = '✓ Agregado al carrito';
          addBtn.classList.add('dm-add-ok');
          setTimeout(() => { addBtn.textContent = '🛒 Agregar al carrito'; addBtn.classList.remove('dm-add-ok'); }, 1400);
        });

        heroBtn.parentNode.insertBefore(wrap, heroBtn);
        wrap.appendChild(addBtn);
        wrap.appendChild(heroBtn);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    enhanceProductCards();
    renderCart();
  });

  window.DMCart = { addToCart, getCart, cartTotal, cartCount };
})();
