export function createLogger(scope = "outreach_pipeline") {
  const log = (level, message) => {
    console[level](`${level.toUpperCase()} ${scope}: ${message}`);
  };

  return {
    child(name) {
      return createLogger(`${scope}.${name}`);
    },
    info(message) {
      log("log", message);
    },
    warn(message) {
      log("warn", message);
    },
    error(message) {
      log("error", message);
    },
  };
}
