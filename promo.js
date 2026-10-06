(function(){
  'use strict';

  // Welcome coupon: 5% off equipment (not kits or Starlink plans) on orders
  // of $100+ in equipment, valid 72 h from the visitor's first visit.
  // cart.js reads window.DMPromo to apply it.
  const PROMO_KEY = 'dmPromo';
  const CODE = 'BIENVENIDO5';
  const RATE = 0.05;
  const MIN = 100;
  const HOURS = 72;

  function load(){
    try { return JSON.parse(localStorage.getItem(PROMO_KEY)) || null; } catch(e){ return null; }
  }
  function save(p){
    try { localStorage.setItem(PROMO_KEY, JSON.stringify(p)); } catch(e){}
  }

  let promo = load();
  if (!promo || !promo.start){
    promo = { start: Date.now(), shown: false };
    save(promo);
  }

  function msLeft(){ return promo.start + HOURS * 3600 * 1000 - Date.now(); }
  function active(){ return msLeft() > 0; }
  function hoursLeft(){ return Math.max(0, Math.ceil(msLeft() / 3600000)); }

  window.DMPromo = { code: CODE, rate: RATE, min: MIN, active, hoursLeft };

  function track(name, params){
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params); } catch(e){}
  }

  if (!active()) return;

  const css = `
  .dm-promo-overlay{position:fixed; inset:0; background:rgba(9,15,20,.55); z-index:300; display:flex; align-items:center; justify-content:center; padding:16px; opacity:0; transition:opacity .25s ease;}
  .dm-promo-overlay.open{opacity:1;}
  .dm-promo{position:relative; width:100%; max-width:380px; max-height:calc(100vh - 32px); overflow-y:auto; background:#fff; border-radius:18px; box-shadow:0 30px 60px -20px rgba(0,0,0,.6); font-family:'Public Sans',system-ui,Arial,sans-serif; color:#192D3D; transform:translateY(12px); transition:transform .25s ease;}
  .dm-promo-overlay.open .dm-promo{transform:none;}
  .dm-promo-top{background:radial-gradient(120% 140% at 100% 0%, #22394B 0%, #192D3D 55%, #0E1820 100%); color:#fff; padding:26px 24px 22px; text-align:center; position:relative;}
  .dm-promo-top::after{content:""; position:absolute; left:0; right:0; bottom:0; height:4px; background:linear-gradient(90deg,#0DCC30,#FCFC00);}
  .dm-promo-gift{font-size:34px; line-height:1;}
  .dm-promo-pct{font-family:'Barlow Semi Condensed',system-ui,sans-serif; font-size:54px; font-weight:800; line-height:1; margin:8px 0 2px;}
  .dm-promo-pct span{font-size:22px; font-weight:700;}
  .dm-promo-top p{margin:0; font-size:14px; color:#C9D0D6;}
  .dm-promo-body{padding:20px 24px 22px; text-align:center;}
  .dm-promo-code{display:inline-block; font-family:ui-monospace,'IBM Plex Mono',monospace; font-weight:800; font-size:19px; letter-spacing:.08em; border:2px dashed #0DCC30; background:#EAFBEE; border-radius:10px; padding:8px 16px; margin-bottom:10px;}
  .dm-promo-body small{display:block; font-size:12px; color:#7C8894; line-height:1.45; margin-bottom:16px;}
  .dm-promo-cta{display:block; width:100%; background:#25D366; color:#fff; border:none; border-radius:10px; padding:13px; font-weight:700; font-size:15px; cursor:pointer; text-decoration:none;}
  .dm-promo-cta:hover{background:#1DA851;}
  .dm-promo-close{position:absolute; top:10px; right:12px; background:none; border:none; color:#fff; font-size:20px; cursor:pointer; opacity:.8;}
  .dm-promo-close:hover{opacity:1;}
  .dm-promo-badge{position:fixed; left:50%; bottom:22px; transform:translate(-50%, 20px); opacity:0; z-index:75; display:inline-flex; align-items:center; gap:7px; max-width:calc(100vw - 170px); background:#192D3D; color:#fff; border:1px solid rgba(252,252,0,.55); border-radius:999px; padding:9px 15px; font-family:'Public Sans',system-ui,Arial,sans-serif; font-size:13px; font-weight:700; white-space:nowrap; cursor:pointer; box-shadow:0 8px 22px rgba(0,0,0,.3); transition:opacity .3s ease, transform .3s ease;}
  .dm-promo-badge.on{opacity:1; transform:translate(-50%, 0);}
  .dm-promo-badge:hover{border-color:#FCFC00;}
  .dm-promo-badge b{color:#FCFC00;}
  .dm-promo-badge span{font-weight:500; color:#C9D0D6; overflow:hidden; text-overflow:ellipsis;}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Small reminder pill at the bottom while the coupon is active; tapping it reopens the popup.
  let badge = null;
  function badgeText(){
    const h = hoursLeft();
    return `🎁 <b>5% OFF</b><span>· quedan ${h > 1 ? h + ' h' : 'minutos'}</span>`;
  }
  function showBadge(){
    if (!active()) return;
    if (!badge){
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'dm-promo-badge';
      badge.setAttribute('aria-label', 'Ver cupón de 5% de descuento');
      badge.addEventListener('click', () => { hideBadge(); show(); track('ver_cupon_etiqueta', { coupon: CODE }); });
      document.body.appendChild(badge);
      setInterval(() => {
        if (!active()){ hideBadge(); return; }
        badge.innerHTML = badgeText();
      }, 60000);
    }
    badge.innerHTML = badgeText();
    requestAnimationFrame(() => badge.classList.add('on'));
  }
  function hideBadge(){ if (badge) badge.classList.remove('on'); }

  function show(){
    const onCatalog = /catalogo\.html$/.test(location.pathname);
    const overlay = document.createElement('div');
    overlay.className = 'dm-promo-overlay';
    overlay.innerHTML = `
      <div class="dm-promo" role="dialog" aria-modal="true" aria-labelledby="dmPromoTitle">
        <div class="dm-promo-top">
          <button class="dm-promo-close" aria-label="Cerrar">✕</button>
          <div class="dm-promo-gift">🎁</div>
          <div class="dm-promo-pct" id="dmPromoTitle">5%<span> OFF</span></div>
          <p>de descuento en tu primera compra</p>
        </div>
        <div class="dm-promo-body">
          <div class="dm-promo-code">${CODE}</div>
          <small>Se aplica solo en tu carrito durante las próximas ${hoursLeft()} horas.<br>Compras desde $${MIN} en equipos. No aplica a kits ni a planes Starlink.</small>
          ${onCatalog
            ? '<button class="dm-promo-cta" type="button">Ver equipos</button>'
            : '<a class="dm-promo-cta" href="catalogo.html">Ver catálogo</a>'}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    if (!promo.shown){
      promo.shown = true;
      save(promo);
      track('ver_cupon', { coupon: CODE });
    }

    function close(){
      overlay.classList.remove('open');
      setTimeout(() => { overlay.remove(); showBadge(); }, 250);
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.dm-promo-close').addEventListener('click', close);
    const cta = overlay.querySelector('.dm-promo-cta');
    cta.addEventListener('click', () => {
      track('aceptar_cupon', { coupon: CODE });
      if (cta.tagName === 'BUTTON') close();
    });
  }

  // First visit: big popup after 6 s. Afterwards: only the small pill.
  if (promo.shown) showBadge();
  else setTimeout(show, 6000);
})();
