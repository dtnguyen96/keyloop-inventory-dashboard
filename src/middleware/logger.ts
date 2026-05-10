import pinoHttp from 'pino-http';
import { LOG_LEVEL } from '../config.js';

/**
 * Configured pino-http middleware instance.
 * Logs every incoming request with method, path, status code, and response time.
 * Uses pretty-printing in development and structured JSON in production.
 */
export const httpLogger = pinoHttp({
  level: LOG_LEVEL,
  // Avoid logging sensitive request body data at default log level
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      };
    },
  },
});
