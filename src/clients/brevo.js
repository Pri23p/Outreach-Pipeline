import { validateBrevoConfig } from "../config.js";
import { ApiError } from "../exceptions.js";
import { BaseHttpClient } from "./base.js";

export class BrevoClient extends BaseHttpClient {
  constructor({ config, logger }) {
    super({
      logger,
      timeoutMs: config.requestTimeoutMs,
      retryAttempts: config.retryAttempts,
      retryBackoffMs: config.retryBackoffMs,
    });
    this.config = config;
    this.sendUrl = "https://api.brevo.com/v3/smtp/email";
  }

  async sendEmail({ recipientEmail, recipientName, draft }) {
    validateBrevoConfig(this.config);

    const payload = {
      sender: {
        name: this.config.brevoSenderName,
        email: this.config.brevoSenderEmail,
      },
      to: [
        {
          email: recipientEmail,
          name: recipientName || recipientEmail,
        },
      ],
      subject: draft.subject,
      htmlContent: draft.htmlBody,
      tags: this.config.brevoTags,
    };

    if (this.config.brevoReplyTo) {
      payload.replyTo = { email: this.config.brevoReplyTo };
    }

    const response = await this.requestJson("POST", this.sendUrl, {
      headers: {
        accept: "application/json",
        "api-key": this.config.brevoApiKey,
        "content-type": "application/json",
      },
      jsonBody: payload,
      allowedStatuses: [200, 201, 202, 400, 401, 402, 403, 404, 429],
    });

    if (!response?.messageId) {
      throw new ApiError(`Brevo send failed for ${recipientEmail}`, { payload: response });
    }

    return {
      recipient: recipientEmail,
      success: true,
      messageId: response.messageId,
      error: null,
    };
  }
}
