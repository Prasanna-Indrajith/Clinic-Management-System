'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Patient extends Model {}

Patient.init(
  {
    patient_id: {
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
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    contact: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Patient',
    tableName: 'patients',
    underscored: true,
    timestamps: true,
  }
);

module.exports = Patient;
