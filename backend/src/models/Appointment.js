'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Appointment extends Model {}

Appointment.init(
  {
    appointment_id: {
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
      onDelete: 'RESTRICT',
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
    date_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'scheduled',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
    underscored: true,
    timestamps: true,
  }
);

module.exports = Appointment;
