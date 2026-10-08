'use strict';

const winston = require('winston');
const path = require('path');

const fs = require('fs');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaEntries = Object.entries(meta).filter(
    ([key]) => key !== 'service' && key !== 'splat'
  );
  let metaStr = '';
  if (metaEntries.length > 0) {
    try {
      const metaObj = {};
      for (let i = 0; i < metaEntries.length; i += 1) {
        metaObj[metaEntries[i][0]] = metaEntries[i][1];
      }
      metaStr = ' ' + JSON.stringify(metaObj);
    } catch {
      // ignore circular references
    }
  }
  return `${ts} [${level}]: ${stack || message}${metaStr}`;
});

/**
 * Determine the canonical logs directory.
 * If running in the monorepo workspace (root package.json or root logs/ exists),
 * use the workspace root logs/ directory so that opening logs/app.log at the project
 * root reflects live, real-time events.
 * Falls back to process.cwd()/logs for containerized / isolated deployments.
 */
function resolveLogDir() {
  if (process.env.LOG_DIR) {
    return path.resolve(process.env.LOG_DIR);
  }
  if (process.env.LOG_FILE) {
    return path.dirname(path.resolve(process.env.LOG_FILE));
  }

  const workspaceRoot = path.resolve(__dirname, '../../..');
  const workspacePkg = path.join(workspaceRoot, 'package.json');
  const workspaceLogs = path.join(workspaceRoot, 'logs');

  if (fs.existsSync(workspacePkg) || fs.existsSync(workspaceLogs)) {
    return workspaceLogs;
  }

  return path.resolve(process.cwd(), 'logs');
}

const logDir = resolveLogDir();
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // ignore directory creation error
  }
}

const appLogPath = process.env.LOG_FILE
  ? path.resolve(process.env.LOG_FILE)
  : path.join(logDir, 'app.log');

const errorLogPath = path.join(logDir, 'error.log');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true }), json()),
  defaultMeta: { service: 'clinic-tracker' },
  transports: [
    new winston.transports.File({
      filename: appLogPath,
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: errorLogPath,
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// In development, also log to console with color
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat),
    })
  );
}

module.exports = logger;
