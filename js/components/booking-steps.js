/**
 * Booking steps nav: in SPA mode calls showBookingStep(stepId) and sets .active; otherwise sets href to step pages.
 * Runs when #ux_booking_steps appears (after include).
 */
(function() {
  var stepIdFromLink = {
    'step-home': 'home',
    'step-search': 'search',
    'step-passenger': 'passenger',
    'step-ancillaries': 'baggage',
    'step-review': 'review'
  };
  var pageById = {
    'step-home': 'home.html',
    'step-search': 'search_results.html',
    'step-passenger': 'booking-passenger.html',
    'step-ancillaries': 'booking-ancillaries.html',
    'step-review': 'booking-review.html'
  };
  var ACTIVE_CLASSES = ['active', 'bg-primary-100', 'text-primary-700'];
  var INACTIVE_CLASSES = ['text-gray-500'];

  function setLinkActiveState(link, isActive) {
    if (!link) return;
    ACTIVE_CLASSES.forEach(function (cls) { link.classList.toggle(cls, isActive); });
    INACTIVE_CLASSES.forEach(function (cls) { link.classList.toggle(cls, !isActive); });
  }

  function init() {
    var nav = document.getElementById('ux_booking_steps');
    if (!nav) return false;
    var links = nav.querySelectorAll('a[id^="step-"]');
    if (links.length === 0) return false;
    var isSpa = typeof window.showBookingStep === 'function' && document.getElementById('view-booking');

    if (isSpa) {
      links.forEach(function(a) {
        var id = a.id;
        var stepId = stepIdFromLink[id];
        a.removeAttribute('href');
        a.setAttribute('href', '#');
        setLinkActiveState(a, false);
        a.addEventListener('click', function(e) {
          e.preventDefault();
          if (stepId === 'home') window.showView('view-home');
          else if (stepId === 'search') window.showView('view-results');
          else if (stepId) window.showBookingStep(stepId);
        });
      });
      var currentStep = typeof window.getCurrentBookingStep === 'function' ? window.getCurrentBookingStep() : null;
      if (currentStep) {
        var linkId = 'step-' + currentStep;
        var activeLink = nav.querySelector('a#' + linkId);
        if (activeLink) setLinkActiveState(activeLink, true);
      }
    } else {
      var currentPage = (window.location.pathname.split('/').pop() || '').split('?')[0];
      links.forEach(function(a) {
        var id = a.id;
        var page = pageById[id];
        if (page) {
          a.href = page;
          setLinkActiveState(a, currentPage === page);
        }
      });
    }
    try { window.dispatchEvent(new CustomEvent('booking-steps-ready')); } catch (e) {}
    return true;
  }

  function setActiveStep(stepId) {
    var nav = document.getElementById('ux_booking_steps');
    if (!nav) return;
    var activeStage = ['baggage', 'seats', 'meals', 'others'].indexOf(stepId) !== -1 ? 'baggage' : stepId;
    nav.querySelectorAll('a[id^="step-"]').forEach(function(a) {
      setLinkActiveState(a, stepIdFromLink[a.id] === activeStage);
    });
  }

  function tryInit() {
    if (init()) return;
    var observer = new MutationObserver(function() {
      if (init()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

  window.BookingSteps = { setActiveStep: setActiveStep };
})();
