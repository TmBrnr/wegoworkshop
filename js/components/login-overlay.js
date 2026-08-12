/**
 * Login overlay component: open/close, demo user login, invoke from #ux_login or programmatically.
 * Depends on auth-demo.js. Dispatches 'login-overlay-logged-in' with user detail on login.
 */
(function() {
  var overlay = null;
  var bound = false;
  var isLoading = false;
  var customCloseEnabled = true;
  var lastFocusedElement = null;

  function setCustomCloseEnabled(enabled) {
    customCloseEnabled = enabled !== false;
    var closeBtn = document.querySelector('.login-overlay-close');
    if (closeBtn) closeBtn.classList.toggle('hidden', !customCloseEnabled);
    return customCloseEnabled;
  }

  function canCustomClose() {
    return customCloseEnabled;
  }

  function getOverlay() {
    return document.getElementById('login-overlay');
  }

  function setLoading(nextLoading) {
    isLoading = nextLoading === true;
    var loadingEl = document.getElementById('demo-user-loading');
    if (loadingEl) loadingEl.classList.toggle('hidden', !isLoading);

    var buttons = document.querySelectorAll('.demo-user-login-btn');
    buttons.forEach(function(btn) {
      btn.disabled = isLoading;
      btn.classList.toggle('opacity-60', isLoading);
      btn.classList.toggle('cursor-not-allowed', isLoading);
    });
  }

  function clearError() {
    var errorEl = document.getElementById('demo-user-error');
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function showError(message) {
    var errorEl = document.getElementById('demo-user-error');
    if (!errorEl) return;
    errorEl.textContent = message || 'Unable to load Braze profile.';
    errorEl.classList.remove('hidden');
  }

  function buildUserRow(user) {
    var externalId = user && user.externalId ? String(user.externalId) : '';
    var label = user && user.label ? String(user.label) : externalId;

    var row = document.createElement('div');
    row.className = 'demo-traveler-card';

    var avatar = document.createElement('span');
    avatar.className = 'demo-traveler-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (label || externalId || 'Traveler').split(/\s+/).filter(Boolean).slice(0, 2).map(function(part) { return part.charAt(0); }).join('').toUpperCase();

    var left = document.createElement('div');
    left.className = 'demo-traveler-copy';

    var nameEl = document.createElement('strong');
    nameEl.textContent = label || 'Demo traveler';

    var externalEl = document.createElement('span');
    externalEl.textContent = 'Traveler ID: ' + (externalId || 'unknown');

    left.appendChild(nameEl);
    left.appendChild(externalEl);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-user-login-btn';
    btn.setAttribute('data-external-id', externalId);
    btn.setAttribute('aria-label', 'Continue as ' + (label || externalId || 'demo traveler'));
    btn.innerHTML = '<span>Continue</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';

    row.appendChild(avatar);
    row.appendChild(left);
    row.appendChild(btn);
    return row;
  }

  function populateDemoUserList() {
    var listEl = document.getElementById('demo-user-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    var users = typeof getDemoUsers === 'function' ? getDemoUsers() : [];
    if (!users || !users.length) {
      var empty = document.createElement('p');
      empty.className = 'text-sm text-gray-500';
      empty.textContent = 'No demo users configured.';
      listEl.appendChild(empty);
      return;
    }

    users.forEach(function(user) {
      listEl.appendChild(buildUserRow(user));
    });
  }

  function open() {
    overlay = getOverlay();
    if (!overlay) return;
    // Keep login modal independent from Flowbite backdrop because this overlay
    // is nested inside the header stacking context.
    lastFocusedElement = document.activeElement;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    populateDemoUserList();
    setLoading(false);
    clearError();
    var firstLogin = overlay.querySelector('.demo-user-login-btn');
    if (firstLogin) firstLogin.focus();
  }

  function close() {
    overlay = overlay || getOverlay();
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
  }

  function bind() {
    overlay = getOverlay();
    if (!overlay || bound) return;
    bound = true;
    populateDemoUserList();
    setLoading(false);
    clearError();

    document.addEventListener('click', function(e) {
      var loginBtn = e.target.closest('.demo-user-login-btn');
      if (!loginBtn) return;
      if (isLoading) return;
      var externalId = loginBtn.getAttribute('data-external-id') || '';
      if (!externalId) return;

      setLoading(true);
      clearError();
      if (typeof loginAsDemo !== 'function') {
        setLoading(false);
        return;
      }

      loginAsDemo(externalId, function(err, user) {
        var success = !err;
        if (err) {
          if (window.AppLogger && typeof window.AppLogger.warn === 'function') {
            window.AppLogger.warn('[AUTH]', 'Login completed but Braze profile fetch failed', err);
          }
          showError('Login succeeded, but we could not load Braze attributes. Please try again.');
        } else {
          clearError();
          close();
        }

        try {
          window.dispatchEvent(new CustomEvent('login-overlay-logged-in', { detail: { user: user || null, success: success } }));
        } catch (dispatchErr) {}

        setLoading(false);
      });
    });

    document.addEventListener('click', function(e) {
      if (!customCloseEnabled || !overlay || overlay.classList.contains('hidden')) return;
      if (e.target.closest('.login-overlay-close') || e.target === overlay) close();
    });

    document.addEventListener('keydown', function onEscape(e) {
      if (customCloseEnabled && e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) close();
    });
  }

  document.addEventListener('click', function(e) {
    if (e.target.id === 'ux_login' || e.target.closest('#ux_login')) {
      e.preventDefault();
      bind();
      open();
    }
  });

  function tryBind() {
    if (getOverlay()) {
      bind();
      return true;
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      tryBind();
      var observer = new MutationObserver(function() {
        if (tryBind()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    tryBind();
    var observer = new MutationObserver(function() {
      if (tryBind()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.LoginOverlay = { open: open, close: close, setCustomCloseEnabled: setCustomCloseEnabled, canCustomClose: canCustomClose };
})();
