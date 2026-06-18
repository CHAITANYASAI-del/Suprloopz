import pino from 'pino';
import { config } from './env.js';

export const logger = pino({
  level: config.isProd ? 'info' : 'debug',
  transport: config.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.secret'],
});
