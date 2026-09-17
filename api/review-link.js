// api/review-link.js
// Fonction serverless : reçoit un nom de commerce ou un lien Google Maps,
// interroge Google Places API (New) avec la clé secrète (jamais exposée
// au navigateur), et renvoie le lien direct d'avis Google + les infos
// du commerce trouvé.

export default async function handler(req, res) {
  // Autorise les appels depuis ton domaine Shopify uniquement
  res.setHeader('Access-Control-Allow-Origin', 'https://clickavis.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const query = (req.query.q || '').toString().trim();
  if (!query) {
    return res.status(400).json({ error: 'Merci de fournir un nom de commerce ou un lien Google Maps.' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API non configurée sur le serveur.' });
  }

  try {
    let searchText = query;

    // Si c'est un lien court Google Maps, on le résout d'abord pour
    // obtenir l'URL complète (les liens courts ne sont pas exploitables
    // directement par l'API de recherche).
    if (/goo\.gl\/maps|maps\.app\.goo\.gl/i.test(query)) {
      try {
        const resolved = await fetch(query, { method: 'GET', redirect: 'follow' });
        searchText = resolved.url || query;
      } catch (e) {
        // Si la résolution échoue, on continue avec le lien original tel quel.
      }
    }

    // Appel à l'API Places (New) — Text Search.
    const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: searchText, maxResultCount: 5 }),
    });

    const placesData = await placesResponse.json();

    if (!placesResponse.ok) {
      return res.status(502).json({ error: 'Erreur de Google Places.', details: placesData });
    }

    const places = placesData.places || [];
    if (places.length === 0) {
      return res.status(404).json({ error: 'Aucun commerce trouvé. Vérifiez le nom ou le lien fourni.' });
    }

    const results = places.map((place) => ({
      placeId: place.id,
      name: place.displayName ? place.displayName.text : '',
      address: place.formattedAddress || '',
      reviewLink: `https://search.google.com/local/writereview?placeid=${place.id}`,
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur inattendue.', details: err.message });
  }
}
