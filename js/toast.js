// Ameple — Custom Toast Notification System
// Overrides Notyf with the site's Neobrutalist cartoon style.
// All existing notyf.success() / notyf.error() calls work unchanged.

(function () {
  // ── Inject styles ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #ameple-toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    .ameple-toast {
      pointer-events: all;
      display: flex;
      align-items: center;
      gap: 0;
      min-width: 280px;
      max-width: 380px;
      background: #FFFFFF;
      border: 3px solid #1A1A2E;
      border-radius: 18px;
      box-shadow: 5px 5px 0px #1A1A2E;
      overflow: hidden;
      font-family: 'Segoe UI', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
      animation: ameple-toast-in 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      will-change: transform, opacity;
    }

    .ameple-toast.removing {
      animation: ameple-toast-out 0.22s ease-in forwards;
    }

    .ameple-toast.shake {
      animation: ameple-toast-in 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
                 ameple-toast-shake 0.45s ease 0.28s;
    }

    /* Colored left stripe */
    .ameple-toast-stripe {
      width: 6px;
      align-self: stretch;
      flex-shrink: 0;
      border-radius: 0;
    }
    .ameple-toast.success .ameple-toast-stripe { background: #10B981; }
    .ameple-toast.error   .ameple-toast-stripe { background: #EF4444; }
    .ameple-toast.warning .ameple-toast-stripe { background: #F59E0B; }
    .ameple-toast.info    .ameple-toast-stripe { background: #2563EB; }

    /* Icon circle */
    .ameple-toast-icon {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 2.5px solid #1A1A2E;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 900;
      color: #FFFFFF;
      margin: 0 10px 0 14px;
    }
    .ameple-toast.success .ameple-toast-icon { background: #10B981; }
    .ameple-toast.error   .ameple-toast-icon { background: #EF4444; }
    .ameple-toast.warning .ameple-toast-icon { background: #F59E0B; }
    .ameple-toast.info    .ameple-toast-icon { background: #2563EB; }

    /* Message text */
    .ameple-toast-body {
      flex: 1;
      padding: 14px 4px 14px 0;
      font-size: 13.5px;
      font-weight: 800;
      color: #1A1A2E;
      line-height: 1.4;
      letter-spacing: -0.01em;
    }

    /* Close button */
    .ameple-toast-close {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #F3F4F6;
      border: 2px solid #1A1A2E;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 900;
      color: #1A1A2E;
      cursor: pointer;
      margin-right: 14px;
      transition: background 0.12s, transform 0.12s;
      line-height: 1;
      box-shadow: 1.5px 1.5px 0px #1A1A2E;
    }
    .ameple-toast-close:hover {
      background: #E5E7EB;
      transform: translateY(1px) translateX(1px);
      box-shadow: 0px 0px 0px #1A1A2E;
    }

    /* Progress bar */
    .ameple-toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      border-radius: 0 0 18px 18px;
      animation: ameple-toast-progress linear forwards;
    }
    .ameple-toast { position: relative; }
    .ameple-toast.success .ameple-toast-progress { background: #10B981; }
    .ameple-toast.error   .ameple-toast-progress { background: #EF4444; }
    .ameple-toast.warning .ameple-toast-progress { background: #F59E0B; }
    .ameple-toast.info    .ameple-toast-progress { background: #2563EB; }

    @keyframes ameple-toast-in {
      from { opacity: 0; transform: translateX(120%) scale(0.88); }
      to   { opacity: 1; transform: translateX(0)    scale(1); }
    }
    @keyframes ameple-toast-out {
      from { opacity: 1; transform: translateX(0)    scale(1);    max-height: 80px; margin-bottom: 0; }
      to   { opacity: 0; transform: translateX(120%) scale(0.88); max-height: 0;    margin-bottom: -12px; }
    }
    @keyframes ameple-toast-shake {
      0%, 100% { transform: translateX(0); }
      18%  { transform: translateX(-7px); }
      36%  { transform: translateX(6px); }
      54%  { transform: translateX(-4px); }
      72%  { transform: translateX(3px); }
      90%  { transform: translateX(-2px); }
    }
    @keyframes ameple-toast-progress {
      from { width: 100%; }
      to   { width: 0%; }
    }
  `;
  document.head.appendChild(style);

  // ── Build container ──────────────────────────────────────────────────────
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'ameple-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // ── Icon map ─────────────────────────────────────────────────────────────
  const ICONS = {
    success: '✓',
    error:   '✕',
    warning: '!',
    info:    'i'
  };

  // ── Active toasts tracker ────────────────────────────────────────────────
  const activeToasts = [];

  // ── Core show function ───────────────────────────────────────────────────
  function show(message, type, duration) {
    type = type || 'success';
    duration = (duration === undefined) ? 3500 : duration;

    const c = getContainer();

    // If an identical message is already visible → shake it instead of stacking
    const existing = activeToasts.find(function(t) {
      return t.type === type && t.el.querySelector('.ameple-toast-body').textContent === message;
    });
    if (existing) {
      existing.el.classList.remove('shake');
      void existing.el.offsetWidth; // reflow to restart animation
      existing.el.classList.add('shake');
      return;
    }

    const toast = document.createElement('div');
    toast.className = 'ameple-toast ' + type;

    toast.innerHTML =
      '<div class="ameple-toast-stripe"></div>' +
      '<div class="ameple-toast-icon">' + (ICONS[type] || '✓') + '</div>' +
      '<div class="ameple-toast-body">' + escapeHtml(message) + '</div>' +
      '<button class="ameple-toast-close" aria-label="Close">✕</button>' +
      (duration > 0
        ? '<div class="ameple-toast-progress" style="animation-duration:' + duration + 'ms"></div>'
        : '');

    c.appendChild(toast);

    const record = { el: toast, type: type };
    activeToasts.push(record);

    // Close on button click
    toast.querySelector('.ameple-toast-close').addEventListener('click', function () {
      dismiss(toast, record);
    });

    // Auto-dismiss
    let timer = null;
    if (duration > 0) {
      timer = setTimeout(function () { dismiss(toast, record); }, duration);
    }

    // Pause progress on hover
    toast.addEventListener('mouseenter', function () {
      toast.style.animationPlayState = 'paused';
      const bar = toast.querySelector('.ameple-toast-progress');
      if (bar) bar.style.animationPlayState = 'paused';
      if (timer) clearTimeout(timer);
    });
    toast.addEventListener('mouseleave', function () {
      if (duration > 0) {
        timer = setTimeout(function () { dismiss(toast, record); }, 1200);
      }
      const bar = toast.querySelector('.ameple-toast-progress');
      if (bar) bar.style.animationPlayState = 'running';
    });

    return toast;
  }

  function dismiss(toastEl, record) {
    if (!toastEl.parentNode) return;
    toastEl.classList.add('removing');
    toastEl.addEventListener('animationend', function () {
      if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      const idx = activeToasts.indexOf(record);
      if (idx >= 0) activeToasts.splice(idx, 1);
    }, { once: true });
  }

  function dismissAll() {
    activeToasts.slice().forEach(function (r) { dismiss(r.el, r); });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Public API ───────────────────────────────────────────────────────────
  window.AmepleToast = {
    success:    function (msg, dur) { return show(msg, 'success', dur); },
    error:      function (msg, dur) { return show(msg, 'error',   dur); },
    warning:    function (msg, dur) { return show(msg, 'warning', dur); },
    info:       function (msg, dur) { return show(msg, 'info',    dur); },
    dismissAll: dismissAll
  };

  // ── Override window.Notyf so all existing `new Notyf({...})` calls
  //    automatically use our styled system ──────────────────────────────────
  window.Notyf = function (/* options ignored */) {
    return {
      success:    function (msg) { return show(msg, 'success'); },
      error:      function (msg) { return show(msg, 'error');   },
      warning:    function (msg) { return show(msg, 'warning'); },
      open:       function (opts) { return show(opts.message || '', opts.type || 'info'); },
      dismiss:    function (toast) { if (toast && toast.el) dismiss(toast.el, toast); },
      dismissAll: dismissAll
    };
  };

  // Also expose a global `window.notyf` for sidebar.js which accesses it directly
  window.notyf = new window.Notyf();

})();
