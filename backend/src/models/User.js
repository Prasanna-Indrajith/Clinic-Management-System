'use strict';

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');

const BCRYPT_SALT_ROUNDS = 10;

class User extends Model {
  /**
   * Compare candidate password against stored bcrypt hash.
   * @param {string} candidatePassword
   * @returns {Promise<boolean>}
   */
  async comparePassword(candidatePassword) {
    if (!this.password_hash || !candidatePassword) return false;
    return bcrypt.compare(candidatePassword, this.password_hash);
  }

  /**
   * Never serialize password_hash to JSON
   */
  toJSON() {
    const values = { ...this.get() };
    delete values.password_hash;
    return values;
  }
}

User.init(
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'doctor', 'receptionist', 'patient'),
      allowNull: false,
      defaultValue: 'patient',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password_hash')) {
          // If a plain text password was set into password_hash, hash it
          if (!user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
            user.password_hash = await bcrypt.hash(user.password_hash, BCRYPT_SALT_ROUNDS);
          }
        }
      },
    },
  }
);

module.exports = User;
