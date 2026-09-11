'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class MedicalRecord extends Model {}

MedicalRecord.init(
  {
    record_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'patients',
        key: 'patient_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'doctors',
        key: 'doctor_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    prescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    record_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'MedicalRecord',
    tableName: 'medical_records',
    underscored: true,
    timestamps: true,
  }
);

module.exports = MedicalRecord;
