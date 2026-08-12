/**
 * Braze panel: fixed left overlay with User Profile, Attributes, and Events.
 * Use BrazePanel.updateProfile(), BrazePanel.updateAttributes(), BrazePanel.addEvent().
 */
(function() {
  var drawerInstance = null;

  function getProfile() {
    if (typeof window.getCurrentUser === 'function') {
      return window.getCurrentUser() || {};
    }
    return {};
  }

  function saveProfile(profile) {
    try {
      window.StorageManager.set('braze_profile', profile || {});
    } catch (e) {}
  }

  function getAttributes() {
    try {
      var parsed = window.StorageManager.get('braze_attributes', null);
      if (parsed && typeof parsed === 'object') {
        return Object.assign({}, parsed);
      }
    } catch (e) {}
    return {};
  }

  function saveAttributes(attrs) {
    try {
      window.StorageManager.set('braze_attributes', attrs || {});
    } catch (e) {}
  }

  function getEvents() {
    try {
      return window.StorageManager.get('braze_events', []);
    } catch (e) {
      return [];
    }
  }

  function saveEvents(events) {
    try {
      window.StorageManager.set('braze_events', events || []);
    } catch (e) {}
  }

  function getOverlay() {
    return document.getElementById('braze-panel-overlay');
  }

  function getBackdrop() {
    return document.querySelector('.braze-panel-backdrop');
  }

  function isOpen() {
    var overlay = getOverlay();
    if (!overlay) return false;
    return !overlay.classList.contains('-translate-x-full');
  }

  function getTrigger() {
    return document.getElementById('ux_braze');
  }

  function render() {
    var profile = getProfile();
    var attrs = getAttributes();
    var events = getEvents();

    var externalIdEl = document.getElementById('braze-profile-external-id');
    var brazeIdEl = document.getElementById('braze-profile-braze-id');
    var nameEl = document.getElementById('braze-profile-name');
    var emailEl = document.getElementById('braze-profile-email');
    var phoneEl = document.getElementById('braze-profile-phone');
    if (externalIdEl) externalIdEl.textContent = profile.externalId != null ? profile.externalId : '–';
    if (brazeIdEl) brazeIdEl.textContent = profile.deviceId != null ? profile.deviceId : '–';
    if (nameEl) nameEl.textContent = profile.name != null ? profile.name : '–';
    if (emailEl) emailEl.textContent = profile.email != null ? profile.email : '–';
    if (phoneEl) phoneEl.textContent = profile.phone != null ? profile.phone : '–';

    var attrListEl = document.getElementById('braze-attr-list');
    if (attrListEl) {
      attrListEl.innerHTML = '';
      var keys = Object.keys(attrs || {}).sort();
      if (!keys.length) {
        var emptyDt = document.createElement('dt');
        emptyDt.className = 'text-gray-500';
        emptyDt.textContent = 'No attributes';
        var emptyDd = document.createElement('dd');
        emptyDd.className = 'text-gray-900';
        emptyDd.textContent = '–';
        attrListEl.appendChild(emptyDt);
        attrListEl.appendChild(emptyDd);
      } else {
        keys.forEach(function(key) {
          var dt = document.createElement('dt');
          dt.className = 'text-gray-500';
          dt.textContent = key;

          var dd = document.createElement('dd');
          dd.className = 'text-gray-900';
          var value = attrs[key];
          dd.textContent = value != null ? String(value) : '–';

          attrListEl.appendChild(dt);
          attrListEl.appendChild(dd);
        });
      }
    }

    var customCloseToggle = document.getElementById('braze-debug-custom-close');
    if (customCloseToggle && window.LoginOverlay && typeof window.LoginOverlay.canCustomClose === 'function') {
      customCloseToggle.checked = window.LoginOverlay.canCustomClose();
    }

    if (window.Braze2 && typeof window.Braze2.getConfig === 'function') {
      var sdkConfig = window.Braze2.getConfig();
      var sdkKeyInput = document.getElementById('braze-debug-sdk-key');
      var sdkEndpointInput = document.getElementById('braze-debug-sdk-endpoint');
      var configSource = document.getElementById('braze-debug-config-source');
      if (sdkKeyInput && document.activeElement !== sdkKeyInput) sdkKeyInput.value = sdkConfig.apiKey || '';
      if (sdkEndpointInput && document.activeElement !== sdkEndpointInput) sdkEndpointInput.value = sdkConfig.baseUrl || '';
      if (configSource) configSource.textContent = 'Loaded from: ' + sdkConfig.source + '. Changes reload the page.';
    }

    var listEl = document.getElementById('braze-events-list');
    if (listEl) {
      listEl.innerHTML = '';
      var slice = events.slice().reverse();
      slice.forEach(function(ev) {
        var li = document.createElement('li');
        li.className = 'rounded-lg border border-gray-200 bg-gray-50 p-3';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'block font-semibold text-gray-900';
        nameSpan.textContent = ev.name || '(unnamed)';
        var timeSpan = document.createElement('span');
        timeSpan.className = 'mt-1 block text-xs text-gray-500';
        timeSpan.textContent = ev.timestamp || '–';
        var propsEl = document.createElement('pre');
        propsEl.className = 'mt-2 overflow-x-auto rounded bg-white p-2 text-xs text-gray-700';
        propsEl.textContent = typeof ev.properties === 'object' && ev.properties !== null
          ? JSON.stringify(ev.properties, null, 2)
          : '{}';
        li.appendChild(nameSpan);
        li.appendChild(timeSpan);
        li.appendChild(propsEl);
        listEl.appendChild(li);
      });
    }
  }

  function open() {
    var overlay = getOverlay();
    var trigger = getTrigger();
    var backdrop = getBackdrop();
    if (overlay) {
      if (!drawerInstance && typeof Drawer === 'function') {
        drawerInstance = new Drawer(overlay, { placement: 'left', backdrop: false });
      }
      render();
      if (drawerInstance) drawerInstance.show();
      else overlay.classList.remove('-translate-x-full');
      if (backdrop) backdrop.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  }

  function close() {
    var overlay = getOverlay();
    var trigger = getTrigger();
    var backdrop = getBackdrop();
    if (overlay) {
      if (drawerInstance) drawerInstance.hide();
      else overlay.classList.add('-translate-x-full');
      if (backdrop) backdrop.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  }

  function toggle() {
    var overlay = getOverlay();
    if (overlay && !overlay.classList.contains('-translate-x-full')) {
      close();
    } else {
      open();
    }
  }

  /**
   * Update user profile. Pass an object with any of: externalId, brazeId, name, email, phone.
   */
  function updateProfile(profile) {
    var current = getProfile();
    if (profile && typeof profile === 'object') {
      if (profile.externalId !== undefined) current.externalId = profile.externalId;
      if (profile.brazeId !== undefined) current.brazeId = profile.brazeId;
      if (profile.deviceId !== undefined) current.deviceId = profile.deviceId;
      if (profile.name !== undefined) current.name = profile.name;
      if (profile.email !== undefined) current.email = profile.email;
      if (profile.phone !== undefined) current.phone = profile.phone;
    }
    saveProfile(current);
    if (isOpen()) render();
    return current;
  }

  /**
   * Update attributes. Pass an object with any key-value pair.
   */
  function updateAttributes(attrs) {
    var current = getAttributes();
    if (attrs && typeof attrs === 'object') {
      Object.keys(attrs).forEach(function(key) {
        current[key] = attrs[key];
      });
    }
    saveAttributes(current);
    if (isOpen()) render();
    return current;
  }

  /**
   * Reset panel state: clear braze_profile, braze_attributes, braze_events from storage and re-render.
   */
  function reset() {
    try {
      window.StorageManager.remove('braze_profile');
      window.StorageManager.remove('braze_attributes');
      window.StorageManager.remove('braze_events');
    } catch (e) {}
    render();
  }

  /**
   * Add an event. eventName (string), eventProperties (object, key-value pairs). Timestamp in ISO 8601 is added automatically.
   */
  function addEvent(eventName, eventProperties) {
    var events = getEvents();
    var props = eventProperties && typeof eventProperties === 'object' ? eventProperties : {};
    events.push({
      name: eventName != null ? String(eventName) : '',
      properties: props,
      timestamp: new Date().toISOString()
    });
    saveEvents(events);
    if (isOpen()) render();
    return events[events.length - 1];
  }

  document.addEventListener('click', function(e) {
    if (e.target.closest('#ux_braze')) {
      e.preventDefault();
      toggle();
    } else if (e.target.closest('#braze-debug-open-login')) {
      if (window.LoginOverlay) window.LoginOverlay.open();
    } else if (e.target.closest('#braze-debug-close-login')) {
      if (window.LoginOverlay) window.LoginOverlay.close();
    } else if (e.target.closest('#braze-debug-save-config')) {
      var keyInput = document.getElementById('braze-debug-sdk-key');
      var endpointInput = document.getElementById('braze-debug-sdk-endpoint');
      var key = keyInput ? keyInput.value.trim() : '';
      var endpoint = endpointInput ? endpointInput.value.trim() : '';
      if (!key || !endpoint) {
        if (window.Toast) window.Toast.show('SDK key and endpoint are required.', 'error');
        return;
      }
      window.Braze2.setConfig({ apiKey: key, baseUrl: endpoint });
      window.location.reload();
    } else if (e.target.closest('#braze-debug-reset-config')) {
      if (window.Braze2) window.Braze2.clearConfig();
      window.location.reload();
    } else if (e.target.closest('#braze-debug-log-event')) {
      addEvent('braze_debug_event', { source: 'debug_menu' });
      render();
    } else if (e.target.closest('.braze-panel-close') || e.target.closest('.braze-panel-backdrop')) {
      close();
    }
  });

  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'braze-debug-custom-close' && window.LoginOverlay) {
      window.LoginOverlay.setCustomCloseEnabled(e.target.checked);
      addEvent('login_custom_close_changed', { enabled: e.target.checked });
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var overlay = getOverlay();
      if (overlay && !overlay.classList.contains('-translate-x-full')) close();
    }
  });

  window.BrazePanel = {
    open: open,
    close: close,
    getProfile: getProfile,
    updateProfile: updateProfile,
    getAttributes: getAttributes,
    updateAttributes: updateAttributes,
    getEvents: getEvents,
    addEvent: addEvent,
    render: render,
    reset: reset
  };
})();
