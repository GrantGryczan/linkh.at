function error(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export default {
  async fetch(request): Promise<Response> {
    if (request.url.length > 8000) {
      return error(413, "The request URL must not exceed 8000 characters");
    }

    const { searchParams } = new URL(request.url);

    if (searchParams.size < 2) {
      return error(400, "At least 2 locations are required");
    }

    let totalWeight = 0;

    const seenUrls = new Set<string>();

    for (const [location, weightString] of searchParams) {
      try {
        const normalizedUrl = new URL("https://" + location).href;

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

      const normalizedUrl = new URL("https://" + location).href;

      return new Response(null, {
        status: 307,
        headers: {
          Location: normalizedUrl,
        },
      });
    }

    return error(500, "Server error: No location matched");
  },
} satisfies ExportedHandler<Env>;
