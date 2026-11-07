function error(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export default {
  fetch(request): Response {
    // This is an easy way to limit CPU usage costs per request, as section 3 of
    // RFC 9112 recommends supporting at least 8000 bytes of the request line.
    if (request.url.length > 8000) {
      return error(413, "The request URL must not exceed 8000 characters");
    }

    const { searchParams } = new URL(request.url);

    // This service is intended for randomized redirects, not deterministic
    // redirects. Deterministic redirect services (especially link shorteners)
    // are far more likely to be abused for phishing.
    if (searchParams.size < 2) {
      return error(400, "At least 2 locations are required");
    }

    let totalWeight = 0;

    const seenUrls = new Set<string>();

    for (const [location, weightString] of searchParams) {
      try {
        // Normalize the URL first to catch more duplicates.
        const normalizedUrl = new URL("https://" + location).href;

        // Duplicates usually result from user error and would bypass the
        // minimum location count requirement.
        if (seenUrls.has(normalizedUrl)) {
          return error(400, "Each location must not be duplicated");
        }

        seenUrls.add(normalizedUrl);
      } catch {
        return error(
          400,
          "Each location must be a valid URL (without 'https://')",
        );
      }

      // Weights must be limited integers to make phishers less likely to abuse
      // them by setting one location with >99.9% weight, which would
      // approximate a deterministic redirect.
      if (!/^[1-9]\d{0,2}$/.test(weightString)) {
        return error(
          400,
          "Each weight must be an integer 1 to 999 (no leading zeros)",
        );
      }

      totalWeight += Number.parseInt(weightString);
    }

    let remainingWeight = Math.floor(Math.random() * totalWeight);

    for (const [location, weightString] of searchParams) {
      const weight = Number.parseInt(weightString);

      if (remainingWeight >= weight) {
        remainingWeight -= weight;
        continue;
      }

      // Normalize the URL to ensure the `Location` header is well-formed.
      const normalizedUrl = new URL("https://" + location).href;

      return new Response(null, {
        status: 307,
        headers: {
          Location: normalizedUrl,
        },
      });
    }

    return error(500, "Internal error: entered unreachable code");
  },
} satisfies ExportedHandler<Env>;
