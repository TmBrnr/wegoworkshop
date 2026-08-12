/**
 * Demo auth: selected demo user profile and login state in localStorage.
 * For workshop/demo only. Use isLoggedIn(), getDemoUsers(), loginAsDemo(), logout().
 */
(function () {
  var KEY_LOGGED_IN = 'logged_in';
  var KEY_USER = 'demo_user';
  var KEY_ANON_USER = 'anon_user';

  var DEMO_USERS = [
    { externalId: 'wego9999', label: 'Auzani Test User' },
    { externalId: 'wego_rintu_testuser_001', label: 'Rintu Test User' },
    { externalId: 'wego_yangla_testuser_001', label: 'Yangla Test User' },
    { externalId: 'wego_harshita_testuser_001', label: 'Harshita Test User' },
    { externalId: 'wego_suganya_testuser_001', label: 'Suganya Test User' },
    { externalId: 'wego_yogesh_testuser_001', label: 'Yogesh Test User' },
    { externalId: 'wego_sharath_testuser_001', label: 'Sharath Test User' },
    { externalId: 'wego_sourav_testuser_001', label: 'Sourav Test User' }
  ];

  var DEFAULT_USER_PROFILE = {
    name: '',
    phone: '',
    email: '',
    passport: '',
    cardNumber: '',
    cardName: '',
    expiry: '',
    address: '',
    externalId: DEMO_USERS[0].externalId,
    deviceId: '',
    customAttributes: {}
  };

  var ANON_USER = {
    name: 'Anonymous User',
    phone: 'na',
    email: 'na',
    passport: 'na',
    cardNumber: 'na',
    cardName: 'na',
    expiry: 'na',
    address: 'na',
    externalId: 'na',
    deviceId: ''
  };

  function isLoggedIn() {
    try {
      return window.StorageManager.get(KEY_LOGGED_IN, false) === true;
    } catch (e) {
      return false;
    }
  }

  function getStoredUser() {
    try {
      return window.StorageManager.get(KEY_USER, null);
    } catch (e) {
      return null;
    }
  }

  function getDemoUsers() {
    return DEMO_USERS.map(function (u) {
      return {
        externalId: u.externalId,
        label: u.label
      };
    });
  }

  function getDemoUser() {
    var stored = getStoredUser();
    if (stored && stored.externalId) return stored;
    return Object.assign({}, DEFAULT_USER_PROFILE);
  }

  function setLoggedIn(user) {
    try {
      window.StorageManager.set(KEY_LOGGED_IN, true);
      window.StorageManager.set(KEY_USER, user || Object.assign({}, DEFAULT_USER_PROFILE));
    } catch (e) {
      window.AppLogger.warn('[AUTH]', 'Could not save to localStorage', e);
    }
  }

  var temporaryRestConfig = { apiKey: '', endpoint: '' };

  function setTemporaryRestConfig(config) {
    temporaryRestConfig.apiKey = config && config.apiKey ? String(config.apiKey).trim() : '';
    temporaryRestConfig.endpoint = config && config.endpoint ? String(config.endpoint).trim().replace(/\/$/, '') : '';
    return getTemporaryRestConfig();
  }

  function getTemporaryRestConfig() {
    return {
      apiKey: temporaryRestConfig.apiKey,
      endpoint: temporaryRestConfig.endpoint,
      configured: Boolean(temporaryRestConfig.apiKey && temporaryRestConfig.endpoint)
    };
  }

  function clearTemporaryRestConfig() {
    temporaryRestConfig.apiKey = '';
    temporaryRestConfig.endpoint = '';
    return getTemporaryRestConfig();
  }

  function fetchBrazeProfile(externalId, callback) {
    var id = externalId != null ? String(externalId).trim() : '';
    if (!id) {
      if (typeof callback === 'function') callback(new Error('externalId is required'));
      return;
    }

    var requestHeaders = { Accept: 'application/json' };
    if (temporaryRestConfig.apiKey && temporaryRestConfig.endpoint) {
      requestHeaders['X-Braze-Rest-Key'] = temporaryRestConfig.apiKey;
      requestHeaders['X-Braze-Rest-Endpoint'] = temporaryRestConfig.endpoint;
    }

    fetch('/api/braze-user?external_id=' + encodeURIComponent(id), {
      method: 'GET',
      headers: requestHeaders
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (res.status === 503 && data && data.code === 'BRAZE_PROFILE_LOOKUP_UNAVAILABLE') {
              return { profileLookupUnavailable: true };
            }
            var msg = data && data.error ? data.error : 'Unable to load Braze user profile';
            throw new Error(msg);
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (typeof callback === 'function') callback(null, data);
      })
      .catch(function (err) {
        if (typeof callback === 'function') callback(err);
      });
  }

  function normalizeUser(externalId, brazeProfile) {
    var id = externalId != null ? String(externalId) : DEFAULT_USER_PROFILE.externalId;
    var firstName = brazeProfile && brazeProfile.firstName ? String(brazeProfile.firstName) : '';
    var lastName = brazeProfile && brazeProfile.lastName ? String(brazeProfile.lastName) : '';
    var fullName = brazeProfile && brazeProfile.name ? String(brazeProfile.name) : [firstName, lastName].filter(Boolean).join(' ');
    return {
      name: fullName || '',
      phone: brazeProfile && brazeProfile.phone ? String(brazeProfile.phone) : '',
      email: brazeProfile && brazeProfile.email ? String(brazeProfile.email) : '',
      passport: '',
      cardNumber: '',
      cardName: fullName || '',
      expiry: '',
      address: '',
      externalId: id,
      deviceId: window.Braze2 && window.Braze2.getDeviceId ? (window.Braze2.getDeviceId() || '') : '',
      customAttributes: brazeProfile && brazeProfile.customAttributes && typeof brazeProfile.customAttributes === 'object'
        ? brazeProfile.customAttributes
        : {}
    };
  }

  function loginAsDemo(externalId, callback) {
    var id = externalId != null ? String(externalId).trim() : DEMO_USERS[0].externalId;
    if (!id) id = DEMO_USERS[0].externalId;

    if (window.Braze2) {
      window.Braze2.changeUser(id);
    }

    return new Promise(function (resolve) {
      fetchBrazeProfile(id, function (err, brazeProfile) {
        if (err) {
          window.AppLogger.warn('[AUTH]', 'Could not fetch Braze profile for ' + id, err);
        }

        var user = normalizeUser(id, brazeProfile || {});
        setLoggedIn(user);

        if (window.BrazePanel) {
          window.BrazePanel.updateProfile({
            externalId: user.externalId,
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            deviceId: user.deviceId || ''
          });
          window.BrazePanel.updateAttributes(user.customAttributes || {});
          window.BrazePanel.addEvent('logged-in', { externalId: user.externalId, deviceId: user.deviceId });
        }

        if (typeof callback === 'function') callback(null, user, err || null);
        resolve(user);
      });
    });
  }

  function logout() {
    try {
      window.StorageManager.remove(KEY_LOGGED_IN);
      window.StorageManager.remove(KEY_USER);
      window.StorageManager.remove(KEY_ANON_USER);
    } catch (e) { }
  }

  function getCurrentUser() {
    if (!isLoggedIn()) {
      try {
        var raw = window.StorageManager.get(KEY_ANON_USER, null);
        if (!raw) {
          var braze = window.Braze2 && window.Braze2.getBraze ? window.Braze2.getBraze() : window.braze;
          if (braze && typeof braze.getDeviceId === 'function') {
            braze.getDeviceId(function (devId) {
              if (devId) {
                ANON_USER.deviceId = devId;
                window.StorageManager.set(KEY_ANON_USER, ANON_USER);
              }
            });
          }
          return null;
        }
        return raw;
      } catch (e) {
        window.AppLogger.warn('[AUTH]', 'Could not get anonymous user id', e);
      }
    } else {
      return getStoredUser() || getDemoUser();
    }
  }

  window.isLoggedIn = isLoggedIn;
  window.getDemoUsers = getDemoUsers;
  window.getDemoUser = getDemoUser;
  window.getCurrentUser = getCurrentUser;
  window.fetchBrazeProfile = fetchBrazeProfile;
  window.BrazeRestDebug = {
    setConfig: setTemporaryRestConfig,
    getConfig: getTemporaryRestConfig,
    clearConfig: clearTemporaryRestConfig
  };
  window.loginAsDemo = loginAsDemo;
  window.setLoggedIn = setLoggedIn;
  window.logout = logout;
})();
