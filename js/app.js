/**
 * SPA app: view switching and booking step logic.
 * Depends: Braze2, getBookingState, setBookingState, resetBookingState, setSearchParams, getSearchParams,
 * generateMockFlights, getCityById, getAirlineById, FLIGHT_CLASSES, BAGGAGE_OPTIONS, MEAL_OPTIONS, ANCILLARY_OPTIONS.
 */
(function () {
  'use strict';

  var VIEW_IDS = ['view-home', 'view-results', 'view-booking', 'view-complete'];
  var STEP_ORDER = ['passenger', 'baggage', 'seats', 'meals', 'others', 'review', 'payment'];
  var currentBookingStep = null;
  var viewedStages = {};
  var paymentSubmitting = false;
  var journeyId = window.sessionStorage.getItem('wego_journey_id') || ('journey_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
  window.sessionStorage.setItem('wego_journey_id', journeyId);
  var recordLocator = window.sessionStorage.getItem('wego_record_locator') || ('W' + Math.random().toString(36).slice(2, 7).toUpperCase());
  window.sessionStorage.setItem('wego_record_locator', recordLocator);
  var passengerId = window.sessionStorage.getItem('wego_passenger_id') || ('pax_' + Math.random().toString(36).slice(2, 10));
  window.sessionStorage.setItem('wego_passenger_id', passengerId);
  var segmentId = window.sessionStorage.getItem('wego_segment_id') || ('seg_' + Math.random().toString(36).slice(2, 10));
  window.sessionStorage.setItem('wego_segment_id', segmentId);
  var resultsFlights = [];
  var resultsSortBy = 'price';
  var resultsFilterAirline = null;
  var CONTAINER_ID = "ux_promo_sidebar";

  var BTN_PRIMARY = 'rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700';
  var BTN_SECONDARY = 'rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100';

  function eventGuid() {
    return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function deviceType() {
    return window.matchMedia && window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
  }

  function safeBrazeProperties(properties) {
    var safe = {};
    Object.keys(properties || {}).forEach(function (key) {
      var value = properties[key];
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'number') {
        if (Number.isFinite(value)) safe[key] = value;
      } else if (typeof value === 'string' || typeof value === 'boolean') safe[key] = value;
      else if (Array.isArray(value)) safe[key] = value.filter(function (item) { return ['string', 'number', 'boolean'].indexOf(typeof item) !== -1; });
      else if (value instanceof Date) safe[key] = value.toISOString();
      else safe[key] = JSON.stringify(value);
    });
    return safe;
  }

  function taxonomyContext() {
    return {
      sid: journeyId,
      e_guid: eventGuid(),
      recordlocator: recordLocator,
      passenger_id: passengerId,
      segment_id: segmentId,
      source: 'web',
      url: window.location.href,
      device_type: deviceType(),
      referrer: document.referrer || 'direct',
      cu: 'PHP'
    };
  }

  function trackJourneyEvent(name, properties, refresh) {
    var payload = safeBrazeProperties(Object.assign(taxonomyContext(), properties || {}));
    if (window.Braze2) {
      window.Braze2.trackEvent(name, payload);
      if (refresh) {
        var braze = window.Braze2.getBraze();
        if (braze && typeof braze.requestBannersRefresh === 'function') braze.requestBannersRefresh([CONTAINER_ID]);
        if (braze && typeof braze.requestContentCardsRefresh === 'function') braze.requestContentCardsRefresh();
      }
    }
    if (window.BrazePanel) window.BrazePanel.addEvent(name, payload);
  }

  function trackStageOnce(stage, name, properties) {
    if (viewedStages[stage]) return;
    viewedStages[stage] = true;
    trackJourneyEvent(name, Object.assign({ journey_stage: stage }, properties || {}), true);
  }

  function ancillaryValue(p) {
    var value = 0;
    var baggage = BAGGAGE_OPTIONS.find(function (item) { return item.id === p.baggage; });
    var meal = MEAL_OPTIONS.find(function (item) { return item.id === p.meal; });
    if (baggage && baggage.price) value += Number(baggage.price);
    if (meal && meal.price) value += Number(meal.price);
    value += p.seats.length * 12;
    p.ancillaries.forEach(function (id) {
      var item = ANCILLARY_OPTIONS.find(function (option) { return option.id === id; });
      if (item && item.price) value += Number(item.price);
    });
    return value;
  }

  function routeContext(p) {
    var originCity = getCityById(p.from);
    var destinationCity = getCityById(p.to);
    return {
      e_c_origin_iata: p.from,
      e_c_origin_city: originCity ? originCity.name : p.from,
      e_c_destination_iata: p.to,
      e_c_destination_city: destinationCity ? destinationCity.name : p.to,
      flight_type: p.returnDate ? 'round_trip' : 'one_way',
      fare_class: p.flightClass,
      adult_count: Number(p.passengers) || 1,
      child_count: 0,
      infant_count: 0,
      ta: 'flight-search/' + String(p.from).toLowerCase() + '/' + String(p.to).toLowerCase()
    };
  }

  function ancillaryProduct(category, id, name, price, quantity) {
    return {
      pid: category + '_' + id,
      na: name || id,
      ta: 'ancillary/' + category,
      ca: category,
      up: Number(price) || 0,
      usp: Number(price) || 0,
      qu: Number(quantity) || 1,
      value: (Number(price) || 0) * (Number(quantity) || 1)
    };
  }

  function seatClass(isOccupied, isSelected) {
    var base = 'seat h-9 w-9 rounded border text-xs font-semibold transition ';
    if (isOccupied) return base + 'cursor-not-allowed border-gray-300 bg-gray-200 text-gray-500';
    if (isSelected) return base + 'border-primary-600 bg-primary-600 text-white';
    return base + 'border-gray-300 bg-white text-gray-700 hover:border-primary-600 hover:bg-primary-50';
  }

  function showView(viewId) {
    VIEW_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.toggle('active', id === viewId);
      }
    });
  }

  function showBookingStep(stepId) {
    currentBookingStep = stepId;
    STEP_ORDER.forEach(function (s) {
      var el = document.getElementById('step-content-' + s);
      if (el) el.classList.toggle('active', s === stepId);
    });
    updateBookingSummary(stepId);
    renderStep(stepId);
    var params = getBookingParams();
    if (stepId === 'passenger') trackStageOnce('guest_details', 'guest_details_view', routeContext(params));
    if (stepId === 'baggage') trackStageOnce('ancillaries', 'ancillaries_view', routeContext(params));
    if (stepId === 'review') {
      var flights = generateMockFlights({ from: params.from, to: params.to, departDate: params.depart, returnDate: params.returnDate, class: params.flightClass, passengers: Number(params.passengers) || 1 });
      var flight = flights[params.flightIndex] || flights[0];
      var categories = ['baggage', 'seats', 'meal', 'extras'].filter(function (category) { return category === 'baggage' ? !!params.baggage : category === 'seats' ? !!params.seats.length : category === 'meal' ? !!params.meal : !!params.ancillaries.length; });
      trackStageOnce('booking_summary', 'cart_page_view', Object.assign(routeContext(params), { base_fare: Number(flight.price), ancillary_total: ancillaryValue(params), total_value: Number(flight.price) + ancillaryValue(params), sale_value: Number(flight.price) + ancillaryValue(params), discount_value: 0, promo_code: 'none', qu: Number(params.passengers) || 1, ancillary_categories: categories, personalized_offer: categories.length > 0, line_item_ids: [params.baggage].concat(params.seats, params.meal, params.ancillaries).filter(Boolean), line_items_json: JSON.stringify({ baggage: params.baggage || null, seats: params.seats, meal: params.meal || null, extras: params.ancillaries }) }));
    }
    if (stepId === 'payment') {
      var paymentFlights = generateMockFlights({ from: params.from, to: params.to, departDate: params.depart, returnDate: params.returnDate, class: params.flightClass, passengers: Number(params.passengers) || 1 });
      var paymentFlight = paymentFlights[params.flightIndex] || paymentFlights[0];
      trackStageOnce('payment', 'payment_page_view', Object.assign(routeContext(params), { base_fare: Number(paymentFlight.price), ancillary_total: ancillaryValue(params), total_value: Number(paymentFlight.price) + ancillaryValue(params), qu: Number(params.passengers) || 1 }));
    }
    if (window.BookingSteps && window.BookingSteps.setActiveStep) {
      window.BookingSteps.setActiveStep(stepId);
    }
  }

  function getCurrentBookingStep() {
    return currentBookingStep;
  }

  function getBookingParams() {
    var params = getBookingState();
    return {
      from: params.from || 'SIN',
      to: params.to || 'KUL',
      depart: params.depart || '',
      returnDate: params.return || '',
      flightClass: params.class || 'economy',
      passengers: params.passengers || '1',
      flightIndex: parseInt(params.flightIndex, 10) || 0,
      baggage: params.baggage || '',
      seats: Array.isArray(params.seats) ? params.seats.slice() : (typeof params.seats === 'string' && params.seats ? params.seats.split(',').filter(Boolean) : []),
      meal: params.meal || '',
      ancillaries: Array.isArray(params.ancillaries) ? params.ancillaries.slice() : (typeof params.ancillaries === 'string' && params.ancillaries ? params.ancillaries.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : []),
      passengerName: params.passengerName || '',
      passengerPhone: params.passengerPhone || '',
      passengerEmail: params.passengerEmail || '',
      passengerPassport: params.passengerPassport || ''
    };
  }

  function openResultsWithParams(params) {
    if (!params || !params.from || !params.to) return false;
    var today = new Date().toISOString().slice(0, 10);
    setSearchParams({
      from: params.from,
      to: params.to,
      depart: params.depart || today,
      return: params.return || '',
      class: params.class || 'economy',
      passengers: params.passengers || '1'
    });
    showView('view-results');
    renderResults();
    return true;
  }

  function parseLegacySearchHref(href) {
    if (!href || href.indexOf('search_results.html') === -1) return null;
    var queryIndex = href.indexOf('?');
    var query = queryIndex === -1 ? '' : href.slice(queryIndex + 1);
    var search = new URLSearchParams(query);
    var from = search.get('from');
    var to = search.get('to');
    if (!from || !to) return null;
    return {
      from: from,
      to: to,
      depart: search.get('depart'),
      return: search.get('return'),
      class: search.get('class'),
      passengers: search.get('passengers')
    };
  }

  function updateBookingSummary(stepId) {
    var p = getBookingParams();
    var flights = generateMockFlights({ from: p.from, to: p.to, departDate: p.depart, returnDate: p.returnDate, class: p.flightClass, passengers: parseInt(p.passengers, 10) });
    var flight = flights[p.flightIndex] || flights[0];
    var fromCity = getCityById(p.from);
    var toCity = getCityById(p.to);
    var airline = getAirlineById(flight.airlineId);
    var classLabel = FLIGHT_CLASSES.find(function (c) { return c.id === p.flightClass; });
    var classDisplay = classLabel ? classLabel.name : p.flightClass;

    var sumAirline = document.getElementById('sum-airline');
    var sumFrom = document.getElementById('sum-from');
    var sumTo = document.getElementById('sum-to');
    var sumDates = document.getElementById('sum-dates');
    var sumPassengers = document.getElementById('sum-passengers');
    var sumClass = document.getElementById('sum-class');
    if (sumAirline) sumAirline.textContent = airline.name;
    if (sumFrom) sumFrom.textContent = fromCity.name + ' (' + p.from + ')';
    if (sumTo) sumTo.textContent = toCity.name + ' (' + p.to + ')';
    if (sumDates) sumDates.textContent = (p.depart || '–') + (p.returnDate ? ' – ' + p.returnDate : '');
    if (sumPassengers) sumPassengers.textContent = p.passengers;
    if (sumClass) sumClass.textContent = classDisplay;

    var extraRows = ['row-sum-passenger', 'row-sum-baggage', 'row-sum-seats', 'row-sum-meal', 'row-sum-ancillaries'];
    extraRows.forEach(function (id) { var r = document.getElementById(id); if (r) r.style.display = 'none'; });
    if (stepId === 'review') {
      var sumPassenger = document.getElementById('sum-passenger');
      var sumBaggage = document.getElementById('sum-baggage');
      var sumSeats = document.getElementById('sum-seats');
      var sumMeal = document.getElementById('sum-meal');
      var sumAncillaries = document.getElementById('sum-ancillaries');
      if (sumPassenger) sumPassenger.textContent = p.passengerName || p.passengerEmail || '–';
      if (sumBaggage) sumBaggage.textContent = p.baggage ? (BAGGAGE_OPTIONS.find(function (b) { return b.id === p.baggage; }) || {}).name || p.baggage : '–';
      if (sumSeats) sumSeats.textContent = p.seats.length ? p.seats.join(', ') : '–';
      if (sumMeal) sumMeal.textContent = p.meal ? (MEAL_OPTIONS.find(function (m) { return m.id === p.meal; }) || {}).name || p.meal : '–';
      if (sumAncillaries) sumAncillaries.textContent = p.ancillaries.length ? p.ancillaries.join(', ') : '–';
      extraRows.forEach(function (id) { var r = document.getElementById(id); if (r) r.style.display = ''; });
    }
  }

  function renderStep(stepId) {
    var p = getBookingParams();
    var flights = generateMockFlights({ from: p.from, to: p.to, departDate: p.depart, returnDate: p.returnDate, class: p.flightClass, passengers: parseInt(p.passengers, 10) });
    var flight = flights[p.flightIndex] || flights[0];
    var fromCity = getCityById(p.from);
    var toCity = getCityById(p.to);
    var airline = getAirlineById(flight.airlineId);
    var classLabel = FLIGHT_CLASSES.find(function (c) { return c.id === p.flightClass; });
    var classDisplay = classLabel ? classLabel.name : p.flightClass;
    var numPassengers = parseInt(p.passengers, 10) || 1;

    if (stepId === 'baggage') {
      var baggageCards = document.getElementById('baggage-cards');
      if (!baggageCards) return;
      baggageCards.innerHTML = '';
      var selectedBaggage = p.baggage || '';
      function updateBaggageSelection() {
        baggageCards.querySelectorAll('.baggage-card').forEach(function (card) {
          var id = card.querySelector('.select-baggage').getAttribute('data-id');
          var selected = selectedBaggage === id;
          card.classList.toggle('selected', selected);
          card.classList.toggle('border-primary-600', selected);
          card.classList.toggle('bg-primary-50', selected);
          card.classList.toggle('border-gray-200', !selected);
          card.classList.toggle('bg-white', !selected);
          var btn = card.querySelector('.select-baggage');
          btn.className = (selected ? BTN_SECONDARY : BTN_PRIMARY) + ' select-baggage w-full';
          btn.textContent = selected ? 'SELECTED' : 'SELECT';
        });
      }
      BAGGAGE_OPTIONS.forEach(function (opt) {
        var card = document.createElement('div');
        card.className = 'baggage-card rounded-lg border p-4 shadow-sm ' + (selectedBaggage === opt.id ? 'selected border-primary-600 bg-primary-50' : 'border-gray-200 bg-white');
        card.innerHTML = '<h3 class="mb-3 text-lg font-semibold text-gray-900">' + opt.name + '</h3><ul class="mb-4 list-disc space-y-1 pl-4 text-sm text-gray-600"><li>1 x ' + opt.checkIn.split(' ').slice(1).join(' ') + ' check-in</li><li>1 x ' + opt.carryOn.split(' ').slice(1).join(' ') + ' carry-on</li><li>Cancel Fee: $' + opt.cancelFee + '</li>' + (opt.freeChanges ? '<li>' + opt.freeChanges + ' x Free Change</li>' : '') + '<li>Change Fee: $' + opt.changeFee + '</li></ul><button type="button" class="' + (selectedBaggage === opt.id ? BTN_SECONDARY : BTN_PRIMARY) + ' select-baggage w-full" data-id="' + opt.id + '">' + (selectedBaggage === opt.id ? 'SELECTED' : 'SELECT') + '</button>';
        card.querySelector('.select-baggage').addEventListener('click', function () {
          selectedBaggage = opt.id;
          setBookingState({ baggage: opt.id });
          trackJourneyEvent('item_added_to_cart', Object.assign(routeContext(getBookingParams()), ancillaryProduct('baggage', opt.id, opt.name, opt.price, 1)), false);
          updateBaggageSelection();
        });
        baggageCards.appendChild(card);
      });
      document.getElementById('baggage-prev').onclick = function () { showBookingStep('passenger'); };
      document.getElementById('baggage-next').onclick = function () {
        setBookingState({ baggage: selectedBaggage });
        showBookingStep('seats');
        window.Braze2.getBraze().requestBannersRefresh([CONTAINER_ID]);
      };
    }

    if (stepId === 'seats') {
      var seatMap = document.getElementById('seat-map');
      if (!seatMap) return;
      seatMap.innerHTML = '';
      var selectedSeats = p.seats.length ? p.seats.slice() : [];
      var rows = [12, 11, 10, 9, 8, 7, 6, 5, 4];
      var occupied = ['4A', '4B', '5C', '6D', '7A', '8B', '9C', '10D', '11A', '12B'];
      rows.forEach(function (row) {
        var rowEl = document.createElement('div');
        rowEl.className = 'seat-row mb-2 flex items-center gap-2';
        rowEl.innerHTML = '<span class="row-num w-8 text-right text-xs text-gray-500">' + row + '</span>';
        var left = document.createElement('div');
        left.className = 'seat-group flex gap-1';
        ['A', 'B'].forEach(function (col) {
          var id = row + col;
          var isOccupied = occupied.indexOf(id) !== -1;
          var isSelected = selectedSeats.indexOf(id) !== -1;
          var seat = document.createElement('button');
          seat.type = 'button';
          seat.className = seatClass(isOccupied, isSelected);
          seat.textContent = id;
          seat.dataset.seat = id;
          if (!isOccupied) {
            seat.addEventListener('click', function () {
              var idx = selectedSeats.indexOf(id);
              if (idx !== -1) selectedSeats = selectedSeats.filter(function (s) { return s !== id; });
              else if (selectedSeats.length < numPassengers) selectedSeats = selectedSeats.concat(id).sort();
              seatMap.querySelectorAll('.seat').forEach(function (s) {
                var occupiedSeat = occupied.indexOf(s.dataset.seat) !== -1;
                var selectedSeat = selectedSeats.indexOf(s.dataset.seat) !== -1;
                s.className = seatClass(occupiedSeat, selectedSeat);
              });
              setBookingState({ seats: selectedSeats.join(',') });
              trackJourneyEvent(idx !== -1 ? 'item_removed_from_cart' : 'item_added_to_cart', Object.assign(routeContext(getBookingParams()), ancillaryProduct('seat', id, 'Seat ' + id, 12, 1)), false);
            });
          }
          left.appendChild(seat);
        });
        rowEl.appendChild(left);
        var aisle = document.createElement('div');
        aisle.className = 'seat-group aisle mx-4 flex gap-1';
        ['C', 'D'].forEach(function (col) {
          var id = row + col;
          var isOccupied = occupied.indexOf(id) !== -1;
          var isSelected = selectedSeats.indexOf(id) !== -1;
          var seat = document.createElement('button');
          seat.type = 'button';
          seat.className = seatClass(isOccupied, isSelected);
          seat.textContent = id;
          seat.dataset.seat = id;
          if (!isOccupied) {
            seat.addEventListener('click', function () {
              var idx = selectedSeats.indexOf(id);
              if (idx !== -1) selectedSeats = selectedSeats.filter(function (s) { return s !== id; });
              else if (selectedSeats.length < numPassengers) selectedSeats = selectedSeats.concat(id).sort();
              seatMap.querySelectorAll('.seat').forEach(function (s) {
                var occupiedSeat = occupied.indexOf(s.dataset.seat) !== -1;
                var selectedSeat = selectedSeats.indexOf(s.dataset.seat) !== -1;
                s.className = seatClass(occupiedSeat, selectedSeat);
              });
              setBookingState({ seats: selectedSeats.join(',') });
              trackJourneyEvent(idx !== -1 ? 'item_removed_from_cart' : 'item_added_to_cart', Object.assign(routeContext(getBookingParams()), ancillaryProduct('seat', id, 'Seat ' + id, 12, 1)), false);
            });
          }
          aisle.appendChild(seat);
        });
        rowEl.appendChild(aisle);
        seatMap.appendChild(rowEl);
      });
      document.getElementById('seats-prev').onclick = function () { setBookingState({ seats: selectedSeats.join(',') }); showBookingStep('baggage'); };
      document.getElementById('seats-next').onclick = function () {
        setBookingState({ seats: selectedSeats.join(',') });
        showBookingStep('meals');
        window.Braze2.getBraze().requestBannersRefresh([CONTAINER_ID]);
      };
    }

    if (stepId === 'meals') {
      var mealCards = document.getElementById('meal-cards');
      if (!mealCards) return;
      mealCards.innerHTML = '';
      var selectedMeal = p.meal || '';
      function updateMealSelection() {
        mealCards.querySelectorAll('.meal-card').forEach(function (card) {
          var id = card.querySelector('.select-meal').getAttribute('data-id');
          var selected = selectedMeal === id;
          card.classList.toggle('selected', selected);
          card.classList.toggle('border-primary-600', selected);
          card.classList.toggle('bg-primary-50', selected);
          card.classList.toggle('border-gray-200', !selected);
          card.classList.toggle('bg-white', !selected);
          var btn = card.querySelector('.select-meal');
          btn.className = (selected ? BTN_SECONDARY : BTN_PRIMARY) + ' select-meal w-full';
          btn.textContent = selected ? 'SELECTED' : 'SELECT';
        });
      }
      MEAL_OPTIONS.forEach(function (opt) {
        var card = document.createElement('div');
        card.className = 'meal-card rounded-lg border p-4 text-center shadow-sm ' + (selectedMeal === opt.id ? 'selected border-primary-600 bg-primary-50' : 'border-gray-200 bg-white');
        card.innerHTML = '<h3 class="mb-2 text-base font-semibold text-gray-900">' + opt.name + '</h3><div class="meal-image mb-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-600" role="img" aria-label="Meal"><i class="' + opt.icon + '"></i><br> ' + opt.description + '</div><div class="meal-body"><button type="button" class="' + (selectedMeal === opt.id ? BTN_SECONDARY : BTN_PRIMARY) + ' select-meal w-full" data-id="' + opt.id + '">' + (selectedMeal === opt.id ? 'SELECTED' : 'SELECT') + '</button></div>';
        card.querySelector('.select-meal').addEventListener('click', function () {
          selectedMeal = opt.id;
          setBookingState({ meal: opt.id });
          trackJourneyEvent('item_added_to_cart', Object.assign(routeContext(getBookingParams()), ancillaryProduct('meal', opt.id, opt.name, opt.price, 1)), false);
          updateMealSelection();
        });
        mealCards.appendChild(card);
      });
      document.getElementById('meals-prev').onclick = function () { setBookingState({ meal: selectedMeal }); showBookingStep('seats'); };
      document.getElementById('meals-next').onclick = function () {
        setBookingState({ meal: selectedMeal });
        showBookingStep('others');
        window.Braze2.getBraze().requestBannersRefresh([CONTAINER_ID]);
      };
    }

    if (stepId === 'others') {
      var ancillaryCards = document.getElementById('ancillary-cards');
      if (!ancillaryCards) return;
      ancillaryCards.innerHTML = '';
      var selectedAncillaries = p.ancillaries.length ? p.ancillaries.slice() : [];
      ANCILLARY_OPTIONS.forEach(function (opt) {
        var isSelected = selectedAncillaries.indexOf(opt.id) !== -1;
        var card = document.createElement('div');
        card.className = 'ancillary-card rounded-lg border p-4 text-center shadow-sm ' + (isSelected ? 'selected border-primary-600 bg-primary-50' : 'border-gray-200 bg-white');
        card.innerHTML = '<div class="ancillary-image mb-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-600" role="img" aria-label="Option"><i class="' + opt.icon + '"></i><br>' + opt.description + '</div><div class="ancillary-body"><h3 class="mb-2 text-base font-semibold text-gray-900">' + opt.name + '</h3><button type="button" class="' + (isSelected ? BTN_SECONDARY : BTN_PRIMARY) + ' toggle-ancillary w-full" data-id="' + opt.id + '">' + (isSelected ? 'SELECTED' : 'SELECT') + '</button></div>';
        card.querySelector('.toggle-ancillary').addEventListener('click', function () {
          var idx = selectedAncillaries.indexOf(opt.id);
          if (idx !== -1) selectedAncillaries = selectedAncillaries.filter(function (id) { return id !== opt.id; });
          else selectedAncillaries = selectedAncillaries.concat(opt.id).sort();
          setBookingState({ ancillaries: selectedAncillaries.join(',') });
          var selected = selectedAncillaries.indexOf(opt.id) !== -1;
          trackJourneyEvent(selected ? 'item_added_to_cart' : 'item_removed_from_cart', Object.assign(routeContext(getBookingParams()), ancillaryProduct('extra', opt.id, opt.name, opt.price, 1)), false);
          card.classList.toggle('selected', selected);
          card.classList.toggle('border-primary-600', selected);
          card.classList.toggle('bg-primary-50', selected);
          card.classList.toggle('border-gray-200', !selected);
          card.classList.toggle('bg-white', !selected);
          var btn = card.querySelector('.toggle-ancillary');
          btn.textContent = selected ? 'SELECTED' : 'SELECT';
          btn.className = (selected ? BTN_SECONDARY : BTN_PRIMARY) + ' toggle-ancillary w-full';
        });
        ancillaryCards.appendChild(card);
      });
      document.getElementById('others-prev').onclick = function () { setBookingState({ ancillaries: selectedAncillaries.join(',') }); showBookingStep('meals'); };
      document.getElementById('others-next').onclick = function () {
        setBookingState({ ancillaries: selectedAncillaries.join(',') });
        var completed = getBookingParams();
        trackJourneyEvent('ancillaries_completed', Object.assign(routeContext(completed), { baggage: completed.baggage || 'none', seat_count: completed.seats.length, meal: completed.meal || 'none', extras: completed.ancillaries, ancillary_value: ancillaryValue(completed) }), true);
        showBookingStep('review');
      };
    }

    if (stepId === 'passenger') {
      var nameEl = document.getElementById('passenger-name');
      var phoneEl = document.getElementById('passenger-phone');
      var emailEl = document.getElementById('passenger-email');
      var passportEl = document.getElementById('passenger-passport');
      var validationMsgEl = document.getElementById('passenger-validation-message');
      if (validationMsgEl) validationMsgEl.textContent = '';
      if (p.passengerName || p.passengerEmail) {
        if (nameEl) nameEl.value = p.passengerName || '';
        if (phoneEl) phoneEl.value = p.passengerPhone || '';
        if (emailEl) emailEl.value = p.passengerEmail || '';
        if (passportEl) passportEl.value = p.passengerPassport || '';
      } else if (typeof getCurrentUser === 'function') {
        var user = getCurrentUser();
        if (user) {
          if (nameEl) nameEl.value = user.name || '';
          if (phoneEl) phoneEl.value = user.phone || '';
          if (emailEl) emailEl.value = user.email || '';
          if (passportEl) passportEl.value = user.passport || '';
        }
      }
      if (typeof isLoggedIn === 'function' && !isLoggedIn() && !(p.passengerName || p.passengerPhone || p.passengerEmail || p.passengerPassport)) {
        setTimeout(function () {
          if (window.LoginOverlay && window.LoginOverlay.open) window.LoginOverlay.open();
        }, 500);
      }
      document.getElementById('passenger-prev').onclick = function () { showView('view-results'); };
      document.getElementById('passenger-next').onclick = function () {
        var name = (nameEl && nameEl.value) ? nameEl.value.trim() : '';
        var phone = (phoneEl && phoneEl.value) ? phoneEl.value.trim() : '';
        var email = (emailEl && emailEl.value) ? emailEl.value.trim() : '';
        var passport = (passportEl && passportEl.value) ? passportEl.value.trim() : '';
        var msgEl = document.getElementById('passenger-validation-message');
        if (!name || !phone || !email) {
          if (msgEl) msgEl.textContent = 'Please fill in full name, phone number, and email.';
          return;
        }
        if (msgEl) msgEl.textContent = '';
        setBookingState({ passengerName: name, passengerPhone: phone, passengerEmail: email, passengerPassport: passport || '' });
        var normalizedEmail = email.toLowerCase();
        var nameParts = name.split(/\s+/).filter(Boolean);
        var loggedInUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        var stitchedExternalId = loggedInUser && loggedInUser.externalId ? loggedInUser.externalId : 'guest_' + normalizedEmail;
        if (window.Braze2) {
          window.Braze2.changeUser(stitchedExternalId);
          window.Braze2.updateStandardProfile({ firstName: nameParts[0] || name, lastName: nameParts.slice(1).join(' '), email: normalizedEmail, phone: phone });
          window.Braze2.updateUserAttribute('latest_journey_id', journeyId);
          window.Braze2.updateUserAttribute('latest_route', p.from + '-' + p.to);
          window.Braze2.updateUserAttribute('booking_in_progress_reference', recordLocator);
          window.Braze2.updateUserAttribute('preferred_language', navigator.language || 'en');
          window.Braze2.updateUserAttribute('country', 'PH');
          window.Braze2.updateUserAttribute('consent_source', 'booking_guest_form');
          window.Braze2.updateUserAttribute('consent_date', new Date().toISOString());
        }
        trackJourneyEvent('lead_collected', Object.assign(routeContext(p), { lead_type: 'booking_guest', form_name: 'guest_details', channel: 'web', profile_stitched: true, has_phone: true, has_email: true, has_passport: Boolean(passport), campaign: 'mock_booking_flow' }), true);
        showBookingStep('baggage');
      };
    }

    if (stepId === 'review') {
      var baggageOpt = p.baggage ? BAGGAGE_OPTIONS.find(function (o) { return o.id === p.baggage; }) : null;
      document.getElementById('review-flight-content').textContent = airline.name + ' · ' + fromCity.name + ' (' + p.from + ') → ' + toCity.name + ' (' + p.to + ') · ' + (p.depart || '–') + (p.returnDate ? ' – ' + p.returnDate : '') + ' · ' + classDisplay + ' · ' + p.passengers + ' passenger(s) · ' + flight.priceFormatted;
      document.getElementById('review-baggage-content').textContent = baggageOpt ? baggageOpt.name + ' (' + baggageOpt.checkIn + ' check-in, ' + baggageOpt.carryOn + ' carry-on)' : (p.baggage || 'Not selected');
      document.getElementById('review-seats-content').textContent = p.seats.length ? p.seats.join(', ') : 'Not selected';
      var mealOpt = p.meal ? MEAL_OPTIONS.find(function (o) { return o.id === p.meal; }) : null;
      document.getElementById('review-meals-content').textContent = mealOpt ? mealOpt.name : (p.meal || 'Not selected');
      document.getElementById('review-ancillaries-content').textContent = p.ancillaries.length ? p.ancillaries.map(function (id) {
        var o = ANCILLARY_OPTIONS.find(function (opt) { return opt.id === id; });
        return o ? o.name : id;
      }).join(', ') : 'None selected';
      var hasPassengerData = !!(p.passengerName || p.passengerEmail || p.passengerPhone || p.passengerPassport);
      var passengerSummary = hasPassengerData
        ? (p.passengerName || '–') + ' · ' + (p.passengerPhone || '–') + ' · ' + (p.passengerEmail || '–') + (p.passengerPassport ? ' · Passport: ' + p.passengerPassport : ' · Passport: –')
        : 'Not entered';
      document.getElementById('review-passenger-content').textContent = passengerSummary;

      document.getElementById('change-baggage').onclick = function (e) { e.preventDefault(); showBookingStep('baggage'); };
      document.getElementById('change-seats').onclick = function (e) { e.preventDefault(); showBookingStep('seats'); };
      document.getElementById('change-meals').onclick = function (e) { e.preventDefault(); showBookingStep('meals'); };
      document.getElementById('change-ancillaries').onclick = function (e) { e.preventDefault(); showBookingStep('others'); };
      document.getElementById('change-passenger').onclick = function (e) { e.preventDefault(); showBookingStep('passenger'); };
      document.getElementById('review-prev').onclick = function () { showBookingStep('others'); };
      document.getElementById('proceed-payment').onclick = function () {
        trackJourneyEvent('checkout_started', Object.assign(routeContext(p), { ancillary_total: ancillaryValue(p), total_value: Number(flight.price) + ancillaryValue(p), payment_collected: false, checkout_type: 'mock_payment' }), true);
        showBookingStep('payment');
      };
    }

    if (stepId === 'payment') {
      var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      var cardNumberEl = document.getElementById('card-number');
      var cardNameEl = document.getElementById('card-name');
      var expiryEl = document.getElementById('expiry');
      var addressEl = document.getElementById('address');
      if (cardNumberEl && user && user.cardNumber) cardNumberEl.value = user.cardNumber;
      if (cardNameEl) cardNameEl.value = (user && user.cardName) ? user.cardName : (p.passengerName || '');
      if (expiryEl && user && user.expiry) expiryEl.value = user.expiry;
      if (addressEl && user && user.address) addressEl.value = user.address;

      var ccvEl = document.getElementById('ccv');
      var form = document.getElementById('payment-form');
      var submitButton = form.querySelector('button[type="submit"]');
      var processingOverlay = document.getElementById('payment-processing-overlay');
      form.onsubmit = function (e) {
        e.preventDefault();
        if (paymentSubmitting) return;
        var cardDigits = String(cardNumberEl.value || '').replace(/\D/g, '');
        var expiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(String(expiryEl.value || '').trim());
        var ccvValid = /^\d{3,4}$/.test(String(ccvEl.value || '').trim());
        if (cardDigits.length < 13 || !cardNameEl.value.trim() || !expiryValid || !addressEl.value.trim() || !ccvValid) {
          if (window.Toast) window.Toast.show('Enter valid mock payment details to continue.', 'error');
          return;
        }
        paymentSubmitting = true;
        if (submitButton) submitButton.disabled = true;
        if (processingOverlay) {
          processingOverlay.classList.add('is-open');
          processingOverlay.classList.remove('hidden');
          processingOverlay.setAttribute('aria-hidden', 'false');
          document.body.style.overflow = 'hidden';
        }
        setTimeout(function () {
          var bookingState = getBookingState();
          var bookingCode = bookingState.bookingCode || recordLocator;
          var lineItemIds = [p.baggage].concat(p.seats, p.meal, p.ancillaries).filter(Boolean);
          setBookingState({ bookingCode: bookingCode });
          trackJourneyEvent('purchase', Object.assign(routeContext(p), { booking_reference: bookingCode, base_fare: Number(flight.price), ancillary_total: ancillaryValue(p), total_value: Number(flight.price) + ancillaryValue(p), sale_value: Number(flight.price) + ancillaryValue(p), qu: Number(p.passengers) || 1, line_item_ids: lineItemIds, booking_status: 'confirmed' }), true);
          if (window.Braze2) {
            window.Braze2.updateUserAttribute('latest_booking_reference', bookingCode);
            window.Braze2.updateUserAttribute('latest_booking_status', 'confirmed');
          }
          if (processingOverlay) {
            processingOverlay.classList.remove('is-open');
            processingOverlay.classList.add('hidden');
            processingOverlay.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
          }
          paymentSubmitting = false;
          if (submitButton) submitButton.disabled = false;
          showView('view-complete');
          renderComplete();
        }, 1200);
      };
      document.getElementById('payment-prev').onclick = function () { showBookingStep('review'); };
      document.getElementById('payment-cancel').onclick = function () { showBookingStep('review'); };
    }
  }

  function renderResults() {
    var params = getSearchParams();
    var from = params.from || 'SIN';
    var to = params.to || 'KUL';
    var depart = params.depart || new Date().toISOString().slice(0, 10);
    var returnDate = params.return || depart;
    var flightClass = params.class || 'economy';
    var passengers = parseInt(params.passengers, 10) || 1;
    resultsFlights = generateMockFlights({ from: from, to: to, departDate: depart, returnDate: returnDate, class: flightClass, passengers: passengers });
    resultsSortBy = 'price';
    resultsFilterAirline = null;
    renderFlightList();
    var sortBtns = document.querySelectorAll('#view-results .sort-btn');
    sortBtns.forEach(function (btn) {
      btn.onclick = function () {
        resultsSortBy = btn.getAttribute('data-sort');
        renderFlightList();
      };
    });
    var filterBtns = document.querySelectorAll('#view-results .filter-btn');
    filterBtns.forEach(function (btn) {
      btn.onclick = function () {
        var f = btn.getAttribute('data-filter');
        if (f === 'airline') resultsFilterAirline = resultsFilterAirline ? null : resultsFlights[0].airlineId;
        renderFlightList();
      };
    });
  }

  function renderFlightList() {
    var list = resultsFlights.slice();
    if (resultsFilterAirline) list = list.filter(function (f) { return f.airlineId === resultsFilterAirline; });
    if (resultsSortBy === 'price') list.sort(function (a, b) { return a.price - b.price; });
    else if (resultsSortBy === 'duration') list.sort(function (a, b) { return a.durationMinutes - b.durationMinutes; });
    var container = document.getElementById('flight-list');
    if (!container) return;
    container.innerHTML = '';
    var params = getSearchParams();
    var from = params.from || 'SIN';
    var to = params.to || 'KUL';
    var depart = params.depart || '';
    var returnDate = params.return || '';
    var flightClass = params.class || 'economy';
    var passengers = params.passengers || '1';
    list.forEach(function (f, i) {
      var originalIndex = resultsFlights.indexOf(f);
      var div = document.createElement('div');
      div.className = 'flight-card rounded-lg border border-gray-200 bg-white p-5 shadow-sm';
      div.innerHTML = '<div class="grid gap-4 xl:grid-cols-[1fr_auto]"><div class="legs space-y-4"><div class="leg grid gap-3 md:grid-cols-3"><div><div class="airline font-semibold text-gray-900">' + f.airlineName + '</div><div class="time text-xl font-semibold text-gray-900">' + f.departTime + '</div><div class="airport text-sm text-gray-600">' + f.from + ' ' + f.fromAirport + '</div></div><div class="meta text-sm text-gray-600">' + f.duration + '<br>' + f.planeType + '</div><div><div class="time text-xl font-semibold text-gray-900">' + f.arrivalTime + '</div><div class="airport text-sm text-gray-600">' + f.to + ' ' + f.toAirport + '</div></div></div><div class="leg-divider border-t border-dashed border-gray-300"></div><div class="leg grid gap-3 md:grid-cols-3"><div><div class="airline font-semibold text-gray-900">Return</div><div class="time text-xl font-semibold text-gray-900">' + f.departTime + '</div><div class="airport text-sm text-gray-600">' + f.to + '</div></div><div class="meta text-sm text-gray-600">' + f.duration + '</div><div><div class="time text-xl font-semibold text-gray-900">' + f.arrivalTime + '</div><div class="airport text-sm text-gray-600">' + f.from + '</div></div></div></div><div class="price-cell text-left xl:text-right"><div class="price mb-2 text-3xl font-bold text-primary-700">' + f.priceFormatted + '</div><button type="button" class="' + BTN_PRIMARY + ' buy-btn" data-index="' + originalIndex + '">BUY</button></div></div>';
      div.querySelector('.buy-btn').addEventListener('click', function () {
        setBookingState({ from: from, to: to, depart: depart, return: returnDate, class: flightClass, passengers: passengers, flightIndex: originalIndex });
        trackJourneyEvent('flight_selected', Object.assign(routeContext({ from: from, to: to, returnDate: returnDate, flightClass: flightClass, passengers: passengers }), { journey_stage: 'flight_search', airline: f.airlineName, flight_id: f.id || ('mock_' + originalIndex), departure_time: f.departTime, arrival_time: f.arrivalTime, base_fare: Number(f.price), up: Number(f.price), usp: Number(f.price), qu: Number(passengers) }), true);
        showView('view-booking');
        showBookingStep('passenger');
      });
      container.appendChild(div);
    });
  }

  function renderComplete() {
    var params = getBookingState();
    var bookingCode = params.bookingCode || recordLocator;
    if (!params.bookingCode) setBookingState({ bookingCode: bookingCode });
    var el = document.getElementById('booking-code');
    if (el) el.textContent = bookingCode;
    var bookingParams = getBookingParams();
    var flights = generateMockFlights({ from: bookingParams.from, to: bookingParams.to, departDate: bookingParams.depart, returnDate: bookingParams.returnDate, class: bookingParams.flightClass, passengers: Number(bookingParams.passengers) || 1 });
    var flight = flights[bookingParams.flightIndex] || flights[0];
    var details = document.getElementById('confirmation-details');
    if (details) details.textContent = bookingParams.from + ' → ' + bookingParams.to + ' · ' + (bookingParams.depart || 'Date pending') + ' · ' + bookingParams.passengers + ' traveler(s) · PHP ' + (Number(flight.price) + ancillaryValue(bookingParams)).toLocaleString();
    currentBookingStep = 'confirmed';
    if (window.BookingSteps && window.BookingSteps.setActiveStep) window.BookingSteps.setActiveStep('confirmed');
    trackStageOnce('booking_confirmation', 'booking_confirmation_view', Object.assign(routeContext(bookingParams), { booking_reference: bookingCode, base_fare: Number(flight.price), ancillary_total: ancillaryValue(bookingParams), total_value: Number(flight.price) + ancillaryValue(bookingParams), booking_status: 'confirmed' }));
    setTimeout(function () {
      if (window.Notifications && window.Notifications.addMessage) {
        var to = params.to || 'KUL';
        var toCity = getCityById(to);
        window.Notifications.addMessage('Your flight to ' + (toCity && toCity.name ? toCity.name : to) + ' is confirmed. Booking code: ' + bookingCode + '.');
      }
    }, 400);
    document.getElementById('add-to-calendar').onclick = function () {
      alert('Add to calendar: ' + bookingCode + ' – ' + (params.depart || '') + ' ' + (params.from || '') + ' to ' + (params.to || ''));
    };
    document.getElementById('download-app').onclick = function () {
      alert('Download our app from the App Store or Google Play.');
    };
    document.getElementById('subscribe-updates').onclick = function () {
      alert('Subscribe to updates – you can integrate Braze here to capture the email.');
    };
    document.getElementById('new-search-btn').onclick = function () {
      resetBookingState();
      paymentSubmitting = false;
      viewedStages = { homepage: true };
      currentBookingStep = null;
      showView('view-home');
      if (window.BookingSteps && window.BookingSteps.setActiveStep) window.BookingSteps.setActiveStep('home');
    };
  }

  window.showView = showView;
  window.showBookingStep = showBookingStep;
  window.getCurrentBookingStep = getCurrentBookingStep;

  function init() {
    trackStageOnce('homepage', 'homepage_view', { anonymous: true, page_type: 'homepage', returning_visitor: Boolean(window.sessionStorage.getItem('wego_has_visited')), acquisition_channel: document.referrer ? 'referral' : 'direct' });
    window.sessionStorage.setItem('wego_has_visited', 'true');
    var fromSelect = document.getElementById('from-city');
    var toSelect = document.getElementById('to-city');
    if (fromSelect && toSelect && typeof TRAVEL_CITIES !== 'undefined') {
      TRAVEL_CITIES.forEach(function (city) {
        fromSelect.appendChild(new Option(city.name + ' (' + city.id + ')', city.id));
        toSelect.appendChild(new Option(city.name + ' (' + city.id + ')', city.id));
      });
    }
    var today = new Date().toISOString().slice(0, 10);
    var departDate = document.getElementById('depart-date');
    var returnDate = document.getElementById('return-date');
    if (departDate) departDate.min = today;
    if (returnDate) returnDate.min = today;
    if (departDate && returnDate) {
      departDate.addEventListener('change', function () {
        returnDate.min = this.value || today;
      });
    }
    var form = document.getElementById('flight-search');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var from = document.getElementById('from-city').value;
        var to = document.getElementById('to-city').value;
        var depart = document.getElementById('depart-date').value;
        var ret = document.getElementById('return-date').value;
        var cls = document.getElementById('class').value;
        var passengers = (document.getElementById('passengers').value || '1');
        setSearchParams({ from: from, to: to, depart: depart, return: ret, class: cls, passengers: passengers });
        var searchInput = { from: from, to: to, departDate: depart, returnDate: ret || depart, class: cls, passengers: Number(passengers) };
        var searchResults = generateMockFlights(searchInput);
        var cheapestFare = searchResults.length ? Math.min.apply(null, searchResults.map(function (flight) { return Number(flight.price); })) : 0;
        trackJourneyEvent('flight_search', Object.assign(routeContext({ from: from, to: to, returnDate: ret, flightClass: cls, passengers: passengers }), { journey_stage: 'flight_search', departure_date: depart, return_date: ret || '', result_count: searchResults.length, cheapest_fare: cheapestFare }), true);
        showView('view-results');
        renderResults();
      });
    }

    var urlSearch = new URLSearchParams(window.location.search);
    var deepLinkFrom = urlSearch.get('from');
    var deepLinkTo = urlSearch.get('to');
    if (deepLinkFrom && deepLinkTo) {
      openResultsWithParams({
        from: deepLinkFrom,
        to: deepLinkTo,
        depart: urlSearch.get('depart'),
        return: urlSearch.get('return'),
        class: urlSearch.get('class'),
        passengers: urlSearch.get('passengers')
      });
    }

    document.addEventListener('click', function (e) {
      var promo = e.target.closest('.hero-carousel-cta, .promo-block a, [data-promo-id]');
      if (promo) {
        var promoContainer = promo.closest('[data-promo-id], .promo-block, .hero-carousel-slide');
        var promoTitle = promoContainer && promoContainer.querySelector ? promoContainer.querySelector('.promo-title, .hero-carousel-title') : null;
        trackJourneyEvent('promo_clicked', { journey_stage: 'homepage', promo_id: (promoContainer && promoContainer.getAttribute('data-promo-id')) || (promoTitle && promoTitle.textContent.trim()) || promo.textContent.trim(), placement: promo.closest('.hero-carousel') ? 'hero' : 'homepage_deals' }, true);
      }
      var tabBtn = e.target.closest('[role="tab"]');
      if (tabBtn && tabBtn.parentElement && tabBtn.parentElement.parentElement) {
        var allTabs = tabBtn.parentElement.parentElement.querySelectorAll('[role="tab"]');
        allTabs.forEach(function (btn) {
          btn.setAttribute('aria-selected', btn === tabBtn ? 'true' : 'false');
          btn.classList.toggle('active', btn === tabBtn);
          btn.classList.toggle('border-primary-600', btn === tabBtn);
          btn.classList.toggle('text-primary-600', btn === tabBtn);
          btn.classList.toggle('border-transparent', btn !== tabBtn);
        });
      }

      var link = e.target.closest('a');
      if (!link) return;

      var from = link.getAttribute('data-search-from');
      var to = link.getAttribute('data-search-to');
      if (from && to) {
        e.preventDefault();
        openResultsWithParams({ from: from, to: to });
        return;
      }

      var parsed = parseLegacySearchHref(link.getAttribute('href'));
      if (parsed) {
        e.preventDefault();
        openResultsWithParams(parsed);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
