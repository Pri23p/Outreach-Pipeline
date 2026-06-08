import { ApiError } from "../exceptions.js";

export class BaseHttpClient {
  constructor({ logger, timeoutMs, retryAttempts, retryBackoffMs }) {
    this.logger = logger;
    this.timeoutMs = timeoutMs;
    this.retryAttempts = retryAttempts;
    this.retryBackoffMs = retryBackoffMs;
  }

  async requestJson(method, url, { headers = {}, params = null, jsonBody = null, allowedStatuses = [200] } = {}) {
    const fullUrl = new URL(url);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
          fullUrl.searchParams.set(key, String(value));
        }
      }
    }

    let lastError = null;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(fullUrl, {
          method,
          headers,
          body: jsonBody == null ? undefined : JSON.stringify(jsonBody),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await response.json()
          : await response.text();

        if (allowedStatuses.includes(response.status)) {
          return payload;
        }

        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < this.retryAttempts) {
          await this.sleepForRetry(attempt, response);
          continue;
        }

        throw new ApiError(`${method} ${fullUrl} failed with HTTP ${response.status}`, {
          statusCode: response.status,
          payload,
        });
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof ApiError) {
          throw error;
        }

        lastError = new ApiError(`${method} ${fullUrl} request failed: ${error.message}`);
        if (attempt < this.retryAttempts) {
          await this.sleepForRetry(attempt);
          continue;
        }
      }
    }

    throw lastError ?? new ApiError(`Request failed without a response: ${method} ${url}`);
  }

  async sleepForRetry(attempt, response = null) {
    const retryAfter = response?.headers?.get?.("retry-after");
    const delay = retryAfter ? Number(retryAfter) * 1000 : this.retryBackoffMs * attempt;
    this.logger.warn(`Retrying after ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
