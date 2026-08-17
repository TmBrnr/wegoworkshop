/**
 * Mock data for travel booking demo - Southeast Asia focus
 */

const TRAVEL_CITIES = [
  { id: 'SIN', name: 'Singapore', country: 'Singapore', airport: 'Changi' },
  { id: 'KUL', name: 'Kuala Lumpur', country: 'Malaysia', airport: 'KLIA' },
  { id: 'BKK', name: 'Bangkok', country: 'Thailand', airport: 'Suvarnabhumi' },
  { id: 'CGK', name: 'Jakarta', country: 'Indonesia', airport: 'Soekarno-Hatta' },
  { id: 'MNL', name: 'Manila', country: 'Philippines', airport: 'Ninoy Aquino' },
  { id: 'SGN', name: 'Ho Chi Minh City', country: 'Vietnam', airport: 'Tan Son Nhat' },
  { id: 'HAN', name: 'Hanoi', country: 'Vietnam', airport: 'Noi Bai' },
  { id: 'RGN', name: 'Yangon', country: 'Myanmar', airport: 'Mingaladon' },
  { id: 'PNH', name: 'Phnom Penh', country: 'Cambodia', airport: 'Phnom Penh' },
  { id: 'VTE', name: 'Vientiane', country: 'Laos', airport: 'Wattay' },
  { id: 'DAD', name: 'Da Nang', country: 'Vietnam', airport: 'Da Nang' },
  { id: 'CEB', name: 'Cebu', country: 'Philippines', airport: 'Mactan-Cebu' },
];

const AIRLINES = [
  { id: 'SQ', name: 'Singapore Airlines', code: 'SQ' },
  { id: 'MH', name: 'Malaysia Airlines', code: 'MH' },
  { id: 'TG', name: 'Thai Airways', code: 'TG' },
  { id: 'GA', name: 'Garuda Indonesia', code: 'GA' },
  { id: 'PR', name: 'Philippine Airlines', code: 'PR' },
  { id: 'VN', name: 'Vietnam Airlines', code: 'VN' },
  { id: 'AK', name: 'AirAsia', code: 'AK' },
  { id: 'QZ', name: 'Indonesia AirAsia', code: 'QZ' },
  { id: 'FD', name: 'Thai AirAsia', code: 'FD' },
  { id: 'Z2', name: 'Philippines AirAsia', code: 'Z2' },
  { id: 'TR', name: 'Scoot', code: 'TR' },
  { id: '3K', name: 'Jetstar Asia', code: '3K' },
  { id: 'BI', name: 'Royal Brunei Airlines', code: 'BI' },
  { id: 'UB', name: 'Myanmar National Airlines', code: 'UB' },
];

const FLIGHT_CLASSES = [
  { id: 'economy', name: 'Economy' },
  { id: 'premium_economy', name: 'Premium Economy' },
  { id: 'business', name: 'Business' },
  { id: 'first', name: 'First' },
];

const BAGGAGE_OPTIONS = [
  {
    id: 'basic',
    name: 'Basic',
    checkIn: '1 x 20KG',
    carryOn: '1 x 5KG',
    cancelFee: 100,
    changeFee: 250,
    freeChanges: 0,
    price: 20,
  },
  {
    id: 'flex',
    name: 'Flex',
    checkIn: '1 x 30KG',
    carryOn: '1 x 7KG',
    cancelFee: 100,
    changeFee: 150,
    freeChanges: 1,
    price: 38,
  },
  {
    id: 'premium',
    name: 'Premium',
    checkIn: '1 x 40KG',
    carryOn: '2 x 7KG',
    cancelFee: 100,
    changeFee: 100,
    freeChanges: 2,
    price: 55,
  },
];

const MEAL_OPTIONS = [
  { id: 'normal', name: 'Normal Meal', icon: 'fa-solid fa-burger', description: 'Protein dish with vegetables and carbohydrates.', price: 14 },
  { id: 'vegetarian', name: 'Vegetarian', icon: 'fa-solid fa-leaf', description: 'Plant-based meal option', price: 14 },
  { id: 'gluten_free', name: 'Gluten Free', icon: 'fa-solid fa-wheat-awn-circle-exclamation', description: 'Gluten-free meal', price: 16 },
  { id: 'kosher_halal', name: 'Kosher / Halal', icon: 'fa-solid fa-mosque', description: 'Prepared to dietary requirements', price: 16 },
];

const ANCILLARY_OPTIONS = [
  { id: 'travel_insurance', name: 'Travel Insurance', icon: 'fa-solid fa-user-shield', description: 'Cover for trip cancellation and medical', price: 24 },
  { id: 'lounge_access', name: 'Lounge Access', icon: 'fa-solid fa-couch', description: 'Airport lounge access before your flight', price: 35 },
  { id: 'onboard_wifi', name: 'Onboard Internet', icon: 'fa-solid fa-wifi', description: 'Wi-Fi for the duration of your flight', price: 12 },
  { id: 'priority_service', name: 'Priority Service', icon: 'fa-solid fa-bell-concierge', description: 'Priority boarding and baggage', price: 18 },
];

/**
 * Generate mock flights for a given search (from, to, date, class, passengers)
 */
function generateMockFlights(params) {
  const { from, to, departDate, returnDate, class: flightClass, passengers = 1 } = params;
  const fromCity = TRAVEL_CITIES.find(c => c.id === from || c.name === from) || TRAVEL_CITIES[0];
  const toCity = TRAVEL_CITIES.find(c => c.id === to || c.name === to) || TRAVEL_CITIES[1];
  const flights = [];
  const numResults = 6;
  const airlinesToUse = AIRLINES.slice(0, 8);

  for (let i = 0; i < numResults; i++) {
    const airline = airlinesToUse[i % airlinesToUse.length];
    const departTime = 6 + (i * 2) + (i % 3);
    const duration = 90 + (i * 25) + (i % 4) * 15;
    const basePrice = 120 + (i * 45) + (flightClass === 'business' ? 200 : flightClass === 'first' ? 500 : 0);
    const price = Math.round(basePrice * (passengers || 1));

    flights.push({
      id: `flight-${fromCity.id}-${toCity.id}-${airline.id}-${i}-${Date.now()}`,
      airlineId: airline.id,
      airlineName: airline.name,
      airlineCode: airline.code,
      from: fromCity.id,
      fromName: fromCity.name,
      fromAirport: fromCity.airport,
      to: toCity.id,
      toName: toCity.name,
      toAirport: toCity.airport,
      departDate,
      returnDate,
      departTime: `${String(departTime).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      arrivalTime: (() => {
        const [h, m] = [departTime + Math.floor(duration / 60), (duration % 60) + (i % 2 === 0 ? 0 : 30)];
        return `${String(h > 24 ? h - 24 : h).padStart(2, '0')}:${String(m > 59 ? m - 60 : m).padStart(2, '0')}`;
      })(),
      durationMinutes: duration,
      duration: `${Math.floor(duration / 60)}h ${duration % 60}m`,
      planeType: ['B737', 'A320', 'A321', 'B787', 'A330'][i % 5],
      class: flightClass,
      passengers: passengers || 1,
      price,
      priceFormatted: `$${price}`,
    });
  }

  return flights;
}

/**
 * Generate a random booking code (e.g. YVRG2345)
 */
function generateBookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get airline by id
 */
function getAirlineById(id) {
  return AIRLINES.find(a => a.id === id || a.code === id) || { id: id, name: id, code: id };
}

/**
 * Get city by id
 */
function getCityById(id) {
  return TRAVEL_CITIES.find(c => c.id === id || c.name === id) || { id: id, name: id, airport: id, country: '' };
}
