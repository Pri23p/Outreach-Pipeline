export class PipelineError extends Error {
  constructor(message) {
    super(message);
    this.name = "PipelineError";
  }
}

export class ConfigurationError extends PipelineError {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ApiError extends PipelineError {
  constructor(message, { statusCode = null, payload = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export class UserAborted extends PipelineError {
  constructor(message) {
    super(message);
    this.name = "UserAborted";
  }
}
