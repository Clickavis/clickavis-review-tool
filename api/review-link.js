// ============================================================
// ClickAvis — Générateur de lien d'avis Google
// Fichier : api/review-link.js  (fonction serverless Vercel)
// Remplace ENTIÈREMENT le contenu de ton fichier existant.
// La clé API reste côté serveur (variable GOOGLE_PLACES_API_KEY).
// ============================================================

export default async function handler(req, res) {
  // --- CORS : autorise ta page Shopify (clickavis.com) à appeler cette fonction ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // --- Lecture du paramètre q (nom du commerce, idéalement avec la ville) ---
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.status(400).json({
      error: "Paramètre 'q' manquant. Exemple : /api/review-link?q=Starbucks%20Montreal"
    });
    return;
  }

  // --- Clé API (jamais exposée au navigateur) ---
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Clé API non configurée sur le serveur." });
    return;
  }

  try {
    // --- Appel à Google Places API (New) : recherche textuelle ---
    const googleRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // On ne demande que les champs nécessaires (limite les coûts)
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress"
      },
      body: JSON.stringify({
        textQuery: q,
        languageCode: "fr", // résultats en français
        regionCode: "CA"    // priorité aux commerces du Canada
      })
    });

    const data = await googleRes.json();

    if (!googleRes.ok) {
      res.status(googleRes.status).json({ error: "Erreur de Google Places.", details: data });
      return;
    }

    // --- Transformation : max 5 résultats, chacun avec son lien d'avis direct ---
    const results = (data.places || []).slice(0, 5).map(function (p) {
      return {
        placeId: p.id,
        name: p.displayName && p.displayName.text ? p.displayName.text : "",
        address: p.formattedAddress || "",
        reviewLink: "https://search.google.com/local/writereview?placeid=" + p.id
      };
    });

    res.status(200).json({ results: results });
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur inattendue. Réessayez dans un instant." });
  }
}
