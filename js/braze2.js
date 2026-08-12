/**
 * Braze2: single module for Braze Web SDK init, content cards, banners, events, attributes, user, profile.
 * Requires Braze Web SDK to be loaded first (e.g. Braze CDN snippet).
 * Load: Braze CDN → braze2.js. Auto-initializes when script runs if SDK is available.
 */
(function (global) {
  'use strict';

  var MAX_EVENTS_STORED = 10;
  var localAttributes = {};
  var localEvents = [];
  var contentCardsSubscriptions = [];
  var bannersSubscriptions = [];
  var isInitialized = false;
  var sdk = null;
  var lastExternalId = '';
  var cachedDeviceId = null;

  var CONFIG_STORAGE_KEY = 'braze_sdk_config';
  var DEFAULT_CONFIG = {
    apiKey: '91530c80-6e0b-4f8d-84c1-0d3d6b174451',
    options: {
      baseUrl: 'sdk.iad-03.braze.com',
      enableLogging: true,
      allowUserSuppliedJavascript: true,
      automaticallyShowInAppMessages: true
    }
  };

  function getStoredConfig() {
    try {
      var raw = global.localStorage.getItem(CONFIG_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function getRuntimeConfig() {
    var env = global.__ENV__ || global.__BRAZE_CONFIG__ || {};
    return {
      apiKey: env.NEXT_PUBLIC_BRAZE_SDK_KEY || env.BRAZE_SDK_KEY || env.apiKey || '',
      baseUrl: env.NEXT_PUBLIC_BRAZE_SDK_ENDPOINT || env.BRAZE_SDK_ENDPOINT || env.baseUrl || ''
    };
  }

  function getConfig() {
    var stored = getStoredConfig() || {};
    var runtime = getRuntimeConfig();
    var apiKey = stored.apiKey || runtime.apiKey || DEFAULT_CONFIG.apiKey;
    var baseUrl = stored.baseUrl || runtime.baseUrl || DEFAULT_CONFIG.options.baseUrl;
    return {
      apiKey: apiKey,
      baseUrl: baseUrl,
      source: stored.apiKey || stored.baseUrl ? 'debug override' : (runtime.apiKey || runtime.baseUrl ? 'runtime environment' : 'built-in default'),
      options: Object.assign({}, DEFAULT_CONFIG.options, { baseUrl: baseUrl })
    };
  }

  function setConfig(config) {
    var value = {
      apiKey: config && config.apiKey ? String(config.apiKey).trim() : '',
      baseUrl: config && config.baseUrl ? String(config.baseUrl).trim().replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
    };
    global.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(value));
    return value;
  }

  function clearConfig() {
    global.localStorage.removeItem(CONFIG_STORAGE_KEY);
    return getConfig();
  }

  function getBraze() {
    if (sdk) return sdk;
    if (typeof global.braze !== 'undefined') return global.braze;
    if (typeof global.appboy !== 'undefined') return global.appboy;
    return null;
  }

  /**
   * Initialize the Braze Web SDK.
   * @param {string} [apiKey] - API key (defaults to built-in config).
   * @param {object} [options] - Optional config: baseUrl (required), enableLogging, allowUserSuppliedJavascript, etc.
   * @returns {boolean} True if initialization was successful.
   */
  function initialize(apiKey, options) {
    var braze = getBraze();
    if (!braze || typeof braze.initialize !== 'function') {
      window.AppLogger.warn('[SDK]', 'Braze2: SDK not loaded. Include the Braze Web SDK script before braze2.js.');
      return false;
    }
    var resolvedConfig = getConfig();
    var key = apiKey != null ? apiKey : resolvedConfig.apiKey;
    var opts = options != null ? options : resolvedConfig.options;
    if (!opts.baseUrl && key) {
      window.AppLogger.warn('[SDK]', 'Braze2: baseUrl is required in options (e.g. sdk.iad-05.braze.com).');
    }
    try {
      braze.initialize(key, opts);
      if (opts.automaticallyShowInAppMessages !== false && typeof braze.automaticallyShowInAppMessages === 'function') {
        braze.automaticallyShowInAppMessages();
      }
      if (typeof braze.openSession === 'function') {
        braze.openSession();
      }
      sdk = braze;
      isInitialized = true;
      if (typeof braze.getDeviceId === 'function') {
        braze.getDeviceId(function (devId) {
          if (devId) cachedDeviceId = devId;
        });
      }
      return true;
    } catch (e) {
      window.AppLogger.warn('[SDK]', 'Braze2: initialize failed', e);
      return false;
    }
  }

  /**
   * Change to an identified user (external user id). Call when user logs in.
   * @param {string} userId - External user ID.
   * @returns {boolean}
   */
  function changeUser(userId) {
    var braze = getBraze();
    if (!braze || typeof braze.changeUser !== 'function') return false;
    try {
      lastExternalId = userId != null ? String(userId) : '';
      braze.changeUser(lastExternalId);
      return true;
    } catch (e) {
      window.AppLogger.warn('[SDK]', 'Braze2: changeUser failed', e);
      return false;
    }
  }

  /**
   * Get the device ID.
   * @returns {string} Device ID.
   */
  function getDeviceId() {
    var braze = getBraze();
    if (!braze || typeof braze.getDeviceId !== 'function') return null;
    return braze.getDeviceId();
  }

  /**
   * Track a custom event with optional properties.
   * @param {string} eventName - Event name.
   * @param {object} [properties] - Optional key-value event properties.
   */
  function trackEvent(eventName, properties) {
    var braze = getBraze();
    if (braze && typeof braze.logCustomEvent === 'function') {
      try {
        braze.logCustomEvent(eventName, properties || {});
        var event = {
          name: eventName,
          properties: properties && typeof properties === 'object' ? properties : {},
          timestamp: new Date().toISOString()
        };
        localEvents.unshift(event);
        if (localEvents.length > MAX_EVENTS_STORED) localEvents.length = MAX_EVENTS_STORED;
        return;
      } catch (e) {
        window.AppLogger.warn('[SDK]', 'Braze2: logCustomEvent failed', e);
      }
    }
    var event = {
      name: eventName,
      properties: properties && typeof properties === 'object' ? properties : {},
      timestamp: new Date().toISOString()
    };
    localEvents.unshift(event);
    if (localEvents.length > MAX_EVENTS_STORED) localEvents.length = MAX_EVENTS_STORED;
  }

  /**
   * Update a custom user attribute.
   * @param {string} key - Attribute key.
   * @param {*} value - Attribute value (string, number, boolean, or array of strings).
   */
  function updateUserAttribute(key, value) {
    var braze = getBraze();
    if (braze && typeof braze.User !== 'undefined' && typeof braze.User.setCustomUserAttribute === 'function') {
      try {
        braze.User.setCustomUserAttribute(key, value);
      } catch (e) {
        window.AppLogger.warn('[SDK]', 'Braze2: setCustomUserAttribute failed', e);
      }
    }
    if (key != null && key !== '') {
      localAttributes[String(key)] = value;
    }
  }

  /**
   * Get user profile: deviceId, externalId, attributes (local cache), events (local cache).
   * If callback is provided, calls back with profile (deviceId may be filled asynchronously).
   * @param {function} [callback] - Optional callback(profile).
   * @returns {object} Profile { deviceId, externalId, attributes, events } (sync; deviceId may be null until SDK reports it).
   */
  function getUserProfile(callback) {
    var braze = getBraze();
    var attrs = {};
    for (var k in localAttributes) {
      if (Object.prototype.hasOwnProperty.call(localAttributes, k)) {
        attrs[k] = localAttributes[k];
      }
    }
    var profile = {
      deviceId: cachedDeviceId,
      externalId: lastExternalId,
      attributes: attrs,
      events: localEvents.slice(0, MAX_EVENTS_STORED)
    };
    if (typeof callback === 'function') {
      if (cachedDeviceId != null) {
        callback(profile);
      } else if (braze && typeof braze.getDeviceId === 'function') {
        braze.getDeviceId(function (devId) {
          if (devId) cachedDeviceId = devId;
          profile.deviceId = cachedDeviceId;
          callback(profile);
        });
      } else {
        callback(profile);
      }
    }
    return profile;
  }

  /**
   * Subscribe to content card updates. Callback receives the content cards payload.
   * @param {function} callback - Function(cardsPayload) called when content cards are updated.
   * @returns {function} Unsubscribe function.
   */
  function subscribeToContentCardsUpdates(callback) {
    var braze = getBraze();
    if (!braze || typeof braze.subscribeToContentCardsUpdates !== 'function') {
      window.AppLogger.warn('[SDK]', 'Braze2: subscribeToContentCardsUpdates not available.');
      return function () { };
    }
    try {
      braze.subscribeToContentCardsUpdates(callback);
      contentCardsSubscriptions.push(callback);
      return function unsubscribe() {
        var i = contentCardsSubscriptions.indexOf(callback);
        if (i !== -1) contentCardsSubscriptions.splice(i, 1);
      };
    } catch (e) {
      window.AppLogger.warn('[SDK]', 'Braze2: subscribeToContentCardsUpdates failed', e);
      return function () { };
    }
  }

  /**
   * Subscribe to banner updates. Callback receives the banners payload.
   * @param {function} callback - Function(bannersPayload) called when banners are updated.
   * @returns {function} Unsubscribe function.
   */
  function subscribeToBannersUpdates(callback) {
    var braze = getBraze();
    if (!braze || typeof braze.subscribeToBannersUpdates !== 'function') {
      window.AppLogger.warn('[SDK]', 'Braze2: subscribeToBannersUpdates not available.');
      return function () { };
    }
    try {
      braze.subscribeToBannersUpdates(callback);
      bannersSubscriptions.push(callback);
      return function unsubscribe() {
        var i = bannersSubscriptions.indexOf(callback);
        if (i !== -1) bannersSubscriptions.splice(i, 1);
      };
    } catch (e) {
      window.AppLogger.warn('[SDK]', 'Braze2: subscribeToBannersUpdates failed', e);
      return function () { };
    }
  }

  if (typeof global.Braze2 !== 'undefined') {
    return;
  }

  global.Braze2 = {
    initialize: initialize,
    changeUser: changeUser,
    trackEvent: trackEvent,
    updateUserAttribute: updateUserAttribute,
    getUserProfile: getUserProfile,
    subscribeToContentCardsUpdates: subscribeToContentCardsUpdates,
    subscribeToBannersUpdates: subscribeToBannersUpdates,
    getDeviceId: getDeviceId,
    getBraze: getBraze,
    getConfig: getConfig,
    setConfig: setConfig,
    clearConfig: clearConfig,
    isInitialized: function () { return isInitialized; }
  };

  function tryAutoInit() {
    var b = getBraze();
    if (b && typeof b.initialize === 'function' && !isInitialized) {
      initialize();
    }
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', tryAutoInit);
  } else {
    tryAutoInit();
  }
})(typeof window !== 'undefined' ? window : this);
