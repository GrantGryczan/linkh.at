const DEFAULT_WEIGHT = 1;

/**
 * Matches any valid percent encoding that can't be produced by
 * `encodeURIComponent`.
 */
const USELESS_PERCENT_ENCODING =
  /%(?:2[17-9ade]|3\d|[46][1-9a-f]|5[\daf]|7[\dae])/i;

function error(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function normalizeUrl(url: string): string {
  return new URL(url).href;
}

export default {
  fetch(request): Response {
    // These URLs can get very long, leading to potential interoperability
    // issues. Section 3 of RFC 9112 recommends supporting at least 8000 bytes
    // of the request line, so that seems like a sufficient URL size limit.
    if (request.url.length > 8000) {
      return error(413, "The request URL must not exceed 8000 characters");
    }

    const requestUrl = new URL(request.url);

    // Let people strip off the end of the URL to reach the homepage.
    if (requestUrl.searchParams.size === 0) {
      return new Response(null, {
        status: 308,
        headers: { Location: "/" },
      });
    }

    // This service is intended for randomized redirects, not deterministic
    // redirects. Deterministic redirect services (especially link shorteners)
    // are far more likely to be abused for phishing.
    if (requestUrl.searchParams.size < 2) {
      return error(400, "At least 2 locations are required");
    }

    // Prevent phishers from obfuscating locations with excessive percent
    // encoding, like `%65%78%61%6D%70%6C%65%2E%63%6F%6D` instead of
    // `example.com`.
    if (USELESS_PERCENT_ENCODING.test(requestUrl.search)) {
      return error(
        400,
        "The URL query must not be excessively percent-encoded",
      );
    }

    let totalWeight = 0;

    const weightsByUrl = new Map<string, number>();

    for (const [location, weightString] of requestUrl.searchParams) {
      // Omitting `https://` saves characters towards the URL size limit.
      const rawUrl = "https://" + location;

      let url: string;
      try {
        // Normalize the URL to catch more duplicates and ensure the final
        // `Location` header is well-formed.
        url = normalizeUrl(rawUrl);
      } catch {
        return error(
          400,
          "Each location must be a valid URL (omitting 'https://')",
        );
      }

      // Requiring normalized URLs makes the service more future-proof since
      // JavaScript's URL parser accepts some URLs that are technically invalid,
      // such as `https:////example.com`.
      if (rawUrl !== url) {
        return error(
          400,
          "Each location must be a normalized URL (omitting 'https://')",
        );
      }

      let weight: number;

      if (weightString === "") {
        weight = DEFAULT_WEIGHT;
      } else if (/^[1-9]\d{0,2}$/.test(weightString)) {
        weight = Number.parseInt(weightString);
      } else {
        // Weights must be limited integers to make phishers less likely to
        // abuse them by setting one location with >99.9% weight, which would
        // approximate a deterministic redirect.
        return error(
          400,
          "Each weight must be an integer 1 to 999 if set (no leading zeros)",
        );
      }

      // Duplicates usually result from user error and would bypass the minimum
      // location count requirement.
      if (weightsByUrl.has(url)) {
        return error(400, "Each location must not be duplicated");
      }

      weightsByUrl.set(url, weight);
      totalWeight += weight;
    }

    let remainingWeight = Math.floor(Math.random() * totalWeight);

    for (const [url, weight] of weightsByUrl) {
      if (remainingWeight >= weight) {
        remainingWeight -= weight;
        continue;
      }

      return new Response(null, {
        status: 307,
        headers: {
          Location: url,
        },
      });
    }

    return error(500, "Internal error: entered unreachable code");
  },
} satisfies ExportedHandler<Env>;
