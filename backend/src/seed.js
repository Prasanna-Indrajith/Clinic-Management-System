'use strict';

require('dotenv').config();
const { sequelize, User, Patient, Doctor, Appointment, MedicalRecord } = require('./models');
const logger = require('./config/logger');

async function seed() {
  try {
    logger.info('Connecting to database and syncing schema...');
    await sequelize.sync({ force: false });

    // 1. Seed Users
    logger.info('Seeding users...');
    const [_adminUser] = await User.findOrCreate({
      where: { email: 'admin@clinic.local' },
      defaults: {
        name: 'System Administrator',
        email: 'admin@clinic.local',
        password_hash: 'AdminPass123!',
        role: 'admin',
      },
    });

    const [doc1User] = await User.findOrCreate({
      where: { email: 'dr.smith@clinic.local' },
      defaults: {
        name: 'Dr. Jane Smith',
        email: 'dr.smith@clinic.local',
        password_hash: 'DoctorPass123!',
        role: 'doctor',
      },
    });

    const [doc2User] = await User.findOrCreate({
      where: { email: 'dr.house@clinic.local' },
      defaults: {
        name: 'Dr. Gregory House',
        email: 'dr.house@clinic.local',
        password_hash: 'DoctorPass123!',
        role: 'doctor',
      },
    });

    const [_receptionistUser] = await User.findOrCreate({
      where: { email: 'receptionist@clinic.local' },
      defaults: {
        name: 'Sarah Connor',
        email: 'receptionist@clinic.local',
        password_hash: 'ReceptionPass123!',
        role: 'receptionist',
      },
    });

    // 2. Seed Doctors
    logger.info('Seeding doctor profiles...');
    const [doc1] = await Doctor.findOrCreate({
      where: { email: 'dr.smith@clinic.local' },
      defaults: {
        name: 'Dr. Jane Smith',
        specialization: 'Cardiology',
        contact: '555-0101',
        email: 'dr.smith@clinic.local',
        user_id: doc1User.user_id,
      },
    });

    const [doc2] = await Doctor.findOrCreate({
      where: { email: 'dr.house@clinic.local' },
      defaults: {
        name: 'Dr. Gregory House',
        specialization: 'Diagnostics',
        contact: '555-0102',
        email: 'dr.house@clinic.local',
        user_id: doc2User.user_id,
      },
    });

    // 3. Seed Patients
    logger.info('Seeding patients...');
    const [patient1] = await Patient.findOrCreate({
      where: { contact: '555-1001' },
      defaults: {
        name: 'Alice Johnson',
        dob: '1988-04-12',
        contact: '555-1001',
        address: '742 Evergreen Terrace, Springfield',
        notes: 'Hypertension monitoring; Penicillin allergy.',
      },
    });

    const [patient2] = await Patient.findOrCreate({
      where: { contact: '555-1002' },
      defaults: {
        name: 'Robert Davis',
        dob: '1975-11-23',
        contact: '555-1002',
        address: '124 Conch Street, Bikini Bottom',
        notes: 'Annual cardiology checkup; recovering from minor arrhythmia.',
      },
    });

    const [patient3] = await Patient.findOrCreate({
      where: { contact: '555-1003' },
      defaults: {
        name: 'Emily Watson',
        dob: '1995-08-30',
        contact: '555-1003',
        address: '221B Baker Street, London',
        notes: 'Migraine evaluations and seasonal allergy treatment.',
      },
    });

    // 4. Seed Appointments
    logger.info('Seeding appointments...');
    const today = new Date();
    const todayMorning = new Date(today);
    todayMorning.setHours(9, 30, 0, 0);

    const todayAfternoon = new Date(today);
    todayAfternoon.setHours(14, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);

    await Appointment.findOrCreate({
      where: {
        patient_id: patient1.patient_id,
        doctor_id: doc1.doctor_id,
        date_time: todayMorning,
      },
      defaults: {
        patient_id: patient1.patient_id,
        doctor_id: doc1.doctor_id,
        date_time: todayMorning,
        status: 'scheduled',
      },
    });

    await Appointment.findOrCreate({
      where: {
        patient_id: patient2.patient_id,
        doctor_id: doc1.doctor_id,
        date_time: todayAfternoon,
      },
      defaults: {
        patient_id: patient2.patient_id,
        doctor_id: doc1.doctor_id,
        date_time: todayAfternoon,
        status: 'completed',
      },
    });

    await Appointment.findOrCreate({
      where: {
        patient_id: patient3.patient_id,
        doctor_id: doc2.doctor_id,
        date_time: tomorrow,
      },
      defaults: {
        patient_id: patient3.patient_id,
        doctor_id: doc2.doctor_id,
        date_time: tomorrow,
        status: 'scheduled',
      },
    });

    // 5. Seed Medical Records
    logger.info('Seeding medical records...');
    await MedicalRecord.findOrCreate({
      where: {
        patient_id: patient2.patient_id,
        doctor_id: doc1.doctor_id,
      },
      defaults: {
        patient_id: patient2.patient_id,
        doctor_id: doc1.doctor_id,
        diagnosis: 'Mild Sinus Bradycardia',
        prescription: 'Prescribed lifestyle adjustments and 30-minute daily cardio.',
        notes: 'Follow up in 3 months if fatigue persists.',
      },
    });

    logger.info('Database seeded successfully!');
    logger.info('--- Seed Data Ready for Dev Testing ---');
    logger.info('Admin Account:        admin@clinic.local / AdminPass123!');
    logger.info('Doctor Account (1):   dr.smith@clinic.local / DoctorPass123!');
    logger.info('Doctor Account (2):   dr.house@clinic.local / DoctorPass123!');
    logger.info('Receptionist Account: receptionist@clinic.local / ReceptionPass123!');
    logger.info('--------------------------------------');

    process.exit(0);
  } catch (err) {
    logger.error('Failed to seed database', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

seed();
