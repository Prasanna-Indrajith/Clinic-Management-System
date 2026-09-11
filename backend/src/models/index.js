'use strict';

const sequelize = require('../config/database');
const User = require('./User');
const Patient = require('./Patient');
const Doctor = require('./Doctor');
const Appointment = require('./Appointment');
const MedicalRecord = require('./MedicalRecord');
const AuditLog = require('./AuditLog');

// Define associations
User.hasOne(Doctor, { foreignKey: 'user_id', as: 'doctorProfile', onDelete: 'SET NULL' });
Doctor.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Patient.hasMany(Appointment, { foreignKey: 'patient_id', as: 'appointments' });
Appointment.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

Doctor.hasMany(Appointment, { foreignKey: 'doctor_id', as: 'appointments' });
Appointment.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

Patient.hasMany(MedicalRecord, { foreignKey: 'patient_id', as: 'medicalRecords' });
MedicalRecord.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

Doctor.hasMany(MedicalRecord, { foreignKey: 'doctor_id', as: 'medicalRecords' });
MedicalRecord.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  User,
  Patient,
  Doctor,
  Appointment,
  MedicalRecord,
  AuditLog,
};
