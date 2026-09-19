'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const dialect = process.env.DB_DIALECT || 'postgres';
const isSqlite = isTest || dialect === 'sqlite';

const defaultPort = dialect === 'postgres' ? 5432 : 3306;
const defaultUser = dialect === 'postgres' ? 'postgres' : 'root';

const dialectOptions = {};
if (dialect === 'postgres' && process.env.DB_SSL === 'true') {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false,
  };
}

const sequelize = isSqlite
  ? new Sequelize({
      dialect: 'sqlite',
      storage: process.env.DB_STORAGE || ':memory:',
      logging: false,
      define: {
        underscored: true,
        timestamps: true,
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'clinic_tracker',
      process.env.DB_USER || defaultUser,
      process.env.DB_PASS || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || defaultPort,
        dialect,
        dialectOptions,
        logging: process.env.NODE_ENV === 'development' ? (msg) => console.warn(msg) : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        define: {
          underscored: true,
          timestamps: true,
        },
      }
    );

module.exports = sequelize;
