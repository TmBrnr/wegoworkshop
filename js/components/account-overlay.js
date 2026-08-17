/**
 * Account overlay: show/hide #ux_account vs #ux_login by login state.
 * When #ux_account is clicked, show overlay with user profile. Depends on auth-demo.js.
 */
(function() {
  var overlay = null;
  var bound = false;
  var lastFocusedElement = null;

  function getOverlay() {
    return document.getElementById('account-overlay');
  }

  function getAccountLink() {
    return document.getElementById('ux_account');
  }

  function getLoginLink() {
    return document.getElementById('ux_login');
  }

  /** Show account link and hide login link when logged in; opposite when logged out. */
  function updateHeaderAuthVisibility() {
    var accountEl = getAccountLink();
    var loginEl = getLoginLink();
    if (!accountEl || !loginEl) return;
    var loggedIn = typeof isLoggedIn === 'function' && isLoggedIn();
    accountEl.classList.toggle('header-account-hidden', !loggedIn);
    accountEl.setAttribute('aria-expanded', 'false');
    loginEl.classList.toggle('header-login-hidden', loggedIn);
  }

  function maskCardNumber(num) {
    if (!num || typeof num !== 'string') return '–';
    var digits = num.replace(/\D/g, '');
    if (digits.length < 4) return '–';
    return '**** **** **** ' + digits.slice(-4);
  }

  function populateProfile() {
    var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    var nameEl = document.getElementById('account-profile-name');
    var phoneEl = document.getElementById('account-profile-phone');
    var emailEl = document.getElementById('account-profile-email');
    var passportEl = document.getElementById('account-profile-passport');
    var cardNumberEl = document.getElementById('account-profile-card-number');
    var cardNameEl = document.getElementById('account-profile-card-name');
    var expiryEl = document.getElementById('account-profile-expiry');
    var addressEl = document.getElementById('account-profile-address');
    var initialsEl = document.getElementById('account-profile-initials');
    var demoUsers = typeof getDemoUsers === 'function' ? getDemoUsers() : [];
    var demoMatch = user && demoUsers.find(function(item) { return item.externalId === user.externalId; });
    var displayName = user && user.name ? user.name : (demoMatch && demoMatch.label ? demoMatch.label : 'Traveler');
    if (initialsEl) initialsEl.textContent = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(function(part) { return part.charAt(0); }).join('').toUpperCase() || 'TR';
    if (nameEl) nameEl.textContent = displayName;
    if (phoneEl) phoneEl.textContent = user && user.phone ? user.phone : '–';
    if (emailEl) emailEl.textContent = user && user.email ? user.email : '–';
    if (passportEl) passportEl.textContent = user && user.passport ? user.passport : '–';
    if (cardNumberEl) cardNumberEl.textContent = user && user.cardNumber ? maskCardNumber(user.cardNumber) : '–';
    if (cardNameEl) cardNameEl.textContent = user && user.cardName ? user.cardName : '–';
    if (expiryEl) expiryEl.textContent = user && user.expiry ? user.expiry : '–';
    if (addressEl) addressEl.textContent = user && user.address ? user.address : '–';
  }

  function open() {
    overlay = getOverlay();
    if (!overlay || !overlay.classList.contains('hidden')) return;
    lastFocusedElement = document.activeElement;
    populateProfile();
    overlay.classList.remove('hidden');
    requestAnimationFrame(function() { overlay.classList.add('is-open'); });
    overlay.setAttribute('aria-hidden', 'false');
    var trigger = getAccountLink();
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    var closeButton = overlay.querySelector('.account-close');
    if (closeButton) closeButton.focus();
  }

  function close() {
    overlay = overlay || getOverlay();
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    var trigger = getAccountLink();
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    window.setTimeout(function() { overlay.classList.add('hidden'); }, 280);
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
  }

  function bind() {
    overlay = getOverlay();
    if (!overlay || bound) return;
    bound = true;

    var logoutBtn = document.getElementById('account-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        if (typeof logout === 'function') logout();
        close();
        updateHeaderAuthVisibility();
      });
    }

    var closeBtn = overlay.querySelector('.account-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    var backdrop = overlay.querySelector('.account-backdrop');
    if (backdrop) backdrop.addEventListener('click', close);

  }

  /**
   * Reset session: logout, restore notifications and hero carousel to demo state, clear booking/search storage, then go to SPA home.
   */
  function resetSession() {
    if (typeof logout === 'function') logout();
    try {
      sessionStorage.removeItem('wego_notifications_initialized');
      sessionStorage.setItem('wego_hero_carousel_reset', '1');
    } catch (err) {}
    if (window.Notifications) {
      if (typeof window.Notifications.reset === 'function') window.Notifications.reset();
      if (typeof window.Notifications.renderList === 'function') window.Notifications.renderList();
    }
    try {
      window.StorageManager.remove('search_params');
      window.StorageManager.remove('booking_state');
    } catch (err) {}
    if (window.Braze2 && typeof window.Braze2.changeUser === 'function') {
      window.Braze2.changeUser('');
    }
    if (window.BrazePanel && typeof window.BrazePanel.reset === 'function') {
      window.BrazePanel.reset();
    }
    updateHeaderAuthVisibility();
    window.location.href = 'index.html';
  }

  document.addEventListener('click', function(e) {
    if (e.target.closest('#ux_account')) {
      e.preventDefault();
      bind();
      open();
    } else if (e.target.closest('#ux_reset')) {
      e.preventDefault();
      resetSession();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var o = getOverlay();
      if (o && !o.classList.contains('hidden')) close();
    }
  });

  window.addEventListener('login-overlay-logged-in', function(event) {
    var detail = event.detail;
    if (detail && detail.success === true) {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show('Login successful');
      }
      if (window.BrazePanel && typeof window.BrazePanel.open === 'function') {
        window.BrazePanel.open();
      }
    }
    updateHeaderAuthVisibility();
  });

  function tryInit() {
    updateHeaderAuthVisibility();
    if (getOverlay()) bind();
  }

  function observeForHeader() {
    tryInit();
    var observer = new MutationObserver(function() {
      if (getAccountLink()) {
        tryInit();
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeForHeader);
  } else {
    observeForHeader();
  }

  window.AccountOverlay = {
    open: open,
    close: close,
    updateHeaderAuthVisibility: updateHeaderAuthVisibility,
    resetSession: resetSession
  };
})();
