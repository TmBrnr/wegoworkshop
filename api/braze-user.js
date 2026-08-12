module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Braze-Rest-Key, X-Braze-Rest-Endpoint');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  var externalId = req.query && req.query.external_id ? String(req.query.external_id).trim() : '';
  if (!externalId) {
    return res.status(400).json({ error: 'Missing required query parameter: external_id' });
  }

  var temporaryApiKey = req.headers['x-braze-rest-key'];
  var temporaryRestEndpoint = req.headers['x-braze-rest-endpoint'];
  var brazeApiKey = temporaryApiKey ? String(temporaryApiKey).trim() : process.env.BRAZE_API_KEY;
  var brazeRestEndpoint = temporaryRestEndpoint ? String(temporaryRestEndpoint).trim() : process.env.BRAZE_REST_ENDPOINT;

  if (temporaryRestEndpoint) {
    try {
      var restUrl = new URL(/^https?:\/\//i.test(brazeRestEndpoint) ? brazeRestEndpoint : 'https://' + brazeRestEndpoint);
      if (!/(^|\.)braze\.(com|eu)$/i.test(restUrl.hostname)) {
        return res.status(400).json({ error: 'REST endpoint must use a braze.com or braze.eu host' });
      }
      brazeRestEndpoint = restUrl.origin;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Braze REST endpoint' });
    }
  }

  if (!brazeApiKey || !brazeRestEndpoint) {
    return res.status(503).json({
      error: 'Braze REST profile lookup is not configured',
      code: 'BRAZE_PROFILE_LOOKUP_UNAVAILABLE'
    });
  }

  var endpoint = String(brazeRestEndpoint).replace(/\/+$/, '') + '/users/export/ids';

  try {
    var kyModule = await import('ky');
    var ky = kyModule.default;

    var result = await ky.post(endpoint, {
      headers: {
        Authorization: 'Bearer ' + brazeApiKey
      },
      json: {
        external_ids: [externalId],
        fields_to_export: ['first_name', 'last_name', 'email', 'phone', 'custom_attributes']
      },
      retry: { limit: 0 }
    }).json();

    var users = result && Array.isArray(result.users) ? result.users : [];
    var user = users.length ? users[0] : null;

    if (!user) {
      return res.status(404).json({ error: 'User not found', external_id: externalId });
    }

    var payload = {
      externalId: externalId,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      name: [user.first_name, user.last_name].filter(Boolean).join(' ').trim(),
      email: user.email || '',
      phone: user.phone || '',
      customAttributes: user.custom_attributes && typeof user.custom_attributes === 'object'
        ? user.custom_attributes
        : {}
    };

    return res.status(200).json(payload);
  } catch (error) {
    var statusCode = error && error.response && error.response.status ? error.response.status : 500;
    var message = 'Failed to fetch user profile from Braze';

    if (error && error.message) {
      message = error.message;
    }

    return res.status(statusCode).json({ error: message });
  }
};
