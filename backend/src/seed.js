'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { sequelize, User, Patient, Doctor, Appointment, MedicalRecord, AuditLog } = require('./models');
const logger = require('./config/logger');

async function seed() {
  try {
    logger.info('Connecting to database and syncing schema...');
    await sequelize.sync({ alter: true });

    // 1. Seed System Users (Sri Lankan clinic team & demo accounts)
    logger.info('Seeding users (Sri Lankan clinic staff and patient accounts)...');
    
    const usersData = [
      {
        email: 'admin@clinic.local',
        defaults: {
          name: 'Pasan Jayasuriya (System Admin)',
          email: 'admin@clinic.local',
          password_hash: 'AdminPass123!',
          role: 'admin',
        },
      },
      {
        email: 'receptionist@clinic.local',
        defaults: {
          name: 'Kumari Dissanayake (Front Desk)',
          email: 'receptionist@clinic.local',
          password_hash: 'ReceptionPass123!',
          role: 'receptionist',
        },
      },
      {
        email: 'dr.smith@clinic.local',
        defaults: {
          name: 'Dr. Sanduni Perera',
          email: 'dr.smith@clinic.local',
          password_hash: 'DoctorPass123!',
          role: 'doctor',
        },
      },
      {
        email: 'dr.house@clinic.local',
        defaults: {
          name: 'Dr. Nuwan Jayawardena',
          email: 'dr.house@clinic.local',
          password_hash: 'DoctorPass123!',
          role: 'doctor',
        },
      },
      {
        email: 'dr.desilva@clinic.local',
        defaults: {
          name: 'Dr. Chamari De Silva',
          email: 'dr.desilva@clinic.local',
          password_hash: 'DoctorPass123!',
          role: 'doctor',
        },
      },
      {
        email: 'dr.wickramasinghe@clinic.local',
        defaults: {
          name: 'Dr. Dilani Wickramasinghe',
          email: 'dr.wickramasinghe@clinic.local',
          password_hash: 'DoctorPass123!',
          role: 'doctor',
        },
      },
      {
        email: 'dr.fernando@clinic.local',
        defaults: {
          name: 'Dr. Anura Fernando',
          email: 'dr.fernando@clinic.local',
          password_hash: 'DoctorPass123!',
          role: 'doctor',
        },
      },
      {
        email: 'patient@clinic.local',
        defaults: {
          name: 'Ruwan Bandara',
          email: 'patient@clinic.local',
          password_hash: 'PatientPass123!',
          role: 'patient',
        },
      },
    ];

    const userMap = {};
    for (const u of usersData) {
      const [user, created] = await User.findOrCreate({
        where: { email: u.email },
        defaults: u.defaults,
      });
      if (!created && user.name !== u.defaults.name) {
        await user.update({ name: u.defaults.name, role: u.defaults.role });
      }
      userMap[u.email] = user;
    }

    // 2. Seed Doctor Profiles (Authentic Sri Lankan medical specialists)
    logger.info('Seeding doctor profiles...');
    const doctorsData = [
      {
        name: 'Dr. Sanduni Perera',
        specialization: 'Consultant Cardiologist',
        contact: '077-234-5678',
        email: 'dr.smith@clinic.local',
        user_id: userMap['dr.smith@clinic.local'].user_id,
      },
      {
        name: 'Dr. Nuwan Jayawardena',
        specialization: 'Consultant General Physician',
        contact: '071-890-1234',
        email: 'dr.house@clinic.local',
        user_id: userMap['dr.house@clinic.local'].user_id,
      },
      {
        name: 'Dr. Chamari De Silva',
        specialization: 'Consultant Pediatrician',
        contact: '076-345-6789',
        email: 'dr.desilva@clinic.local',
        user_id: userMap['dr.desilva@clinic.local'].user_id,
      },
      {
        name: 'Dr. Dilani Wickramasinghe',
        specialization: 'Consultant Dermatologist',
        contact: '078-456-7890',
        email: 'dr.wickramasinghe@clinic.local',
        user_id: userMap['dr.wickramasinghe@clinic.local'].user_id,
      },
      {
        name: 'Dr. Anura Fernando',
        specialization: 'Orthopedic Surgeon',
        contact: '072-567-8901',
        email: 'dr.fernando@clinic.local',
        user_id: userMap['dr.fernando@clinic.local'].user_id,
      },
    ];

    const doctors = [];
    for (const docData of doctorsData) {
      const [doc, created] = await Doctor.findOrCreate({
        where: { email: docData.email },
        defaults: docData,
      });
      if (!created) {
        await doc.update({
          name: docData.name,
          specialization: docData.specialization,
          contact: docData.contact,
          user_id: docData.user_id,
        });
      }
      doctors.push(doc);
    }

    // 3. Clear existing appointments and medical records to generate a fresh full-month dataset
    logger.info('Preparing clean slate for full-month appointments and medical records...');
    await MedicalRecord.destroy({ where: {} });
    await Appointment.destroy({ where: {} });
    await Patient.destroy({ where: {} });

    // 4. Seed Patients (Authentic Sri Lankan names, locations, and medical backgrounds)
    logger.info('Seeding 12 Sri Lankan patients...');
    const patientsData = [
      {
        name: 'Ruwan Bandara',
        dob: '1985-06-14',
        contact: '077-987-6543',
        address: '42/1 Galle Road, Bambalapitiya, Colombo 04',
        notes: 'Type 2 Diabetes Mellitus; on Metformin 500mg bd. Regular FBS/HbA1c monitoring.',
        user_id: userMap['patient@clinic.local'].user_id,
      },
      {
        name: 'Kaveesha Senanayake',
        dob: '1992-11-03',
        contact: '071-234-5671',
        address: '118 Kandy Road, Kiribathgoda',
        notes: 'Mild bronchial asthma triggered by dust and cold weather; carries Salbutamol inhaler.',
      },
      {
        name: 'Malini Dissanayake',
        dob: '1958-03-22',
        contact: '011-282-4567',
        address: '74 Temple Road, Nugegoda',
        notes: 'Essential hypertension for 12 years; bilateral knee osteoarthritis. Nil known drug allergies.',
      },
      {
        name: 'Dinesh Weerasinghe',
        dob: '1980-09-17',
        contact: '076-789-0123',
        address: '25 Ward Place, Cinnamon Gardens, Colombo 07',
        notes: 'Chronic dyspepsia and acid reflux; non-smoker. Routine ECG and upper endoscopy normal.',
      },
      {
        name: 'Sanduni Fernando',
        dob: '1998-01-29',
        contact: '078-345-6712',
        address: '89 Main Street, Negombo',
        notes: 'Allergic rhinitis and eczema; Penicillin allergy (causes severe urticarial rash).',
      },
      {
        name: 'Priyantha Kumara',
        dob: '1974-07-08',
        contact: '077-456-7823',
        address: '104 High Level Road, Maharagama',
        notes: 'Hyperlipidemia on Atorvastatin 20mg nocte; post-PTCA annual cardiology surveillance.',
      },
      {
        name: 'Fatima Rizvi',
        dob: '2001-05-12',
        contact: '075-678-9034',
        address: '32 Havelock Road, Havelock Town, Colombo 05',
        notes: 'Frequent tension headaches and migraine episodes associated with screen fatigue.',
      },
      {
        name: 'Nimal Perera',
        dob: '1965-12-05',
        contact: '072-123-9876',
        address: '57 Station Road, Dehiwala',
        notes: 'Hypertension and mild sinus bradycardia under observation; routine stress test unremarkable.',
      },
      {
        name: 'Thilini Rajapaksha',
        dob: '2016-08-19',
        contact: '071-987-1234',
        address: '210 Nawala Road, Rajagiriya',
        notes: 'Pediatric patient; routine immunization up to date. Seasonal viral wheeze history.',
      },
      {
        name: 'Suresh Thambirajah',
        dob: '1983-04-16',
        contact: '077-321-6549',
        address: '63 Baseline Road, Dematagoda, Colombo 09',
        notes: 'Lumbar disc prolapse; undergoing conservative physical therapy. Avoids heavy lifting.',
      },
      {
        name: 'Chathurika Mendis',
        dob: '1990-10-25',
        contact: '076-543-2109',
        address: '15/B Peradeniya Road, Kandy',
        notes: 'Contact dermatitis flare-ups on hands; patch test planned.',
      },
      {
        name: 'Mahesh Cooray',
        dob: '1978-02-14',
        contact: '011-258-9631',
        address: '18 Flower Road, Colombo 07',
        notes: 'Executive wellness evaluation; borderline hyperuricemia, dietary lifestyle counseling.',
      },
    ];

    const patients = [];
    for (const pData of patientsData) {
      const patient = await Patient.create(pData);
      patients.push(patient);
    }

    // 5. Generate a full month of realistic appointment dataset
    logger.info('Generating month-long appointment schedule (50-80 appointments across current month)...');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const timeSlots = [
      { hour: 8, minute: 30 },
      { hour: 9, minute: 30 },
      { hour: 10, minute: 45 },
      { hour: 11, minute: 45 },
      { hour: 14, minute: 0 },
      { hour: 15, minute: 15 },
      { hour: 16, minute: 30 },
    ];

    const clinicalContexts = [
      {
        diagnosis: 'Acute Febrile Illness - Dengue Surveillance (NS1 Positive)',
        prescription: 'Paracetamol 500mg 2 tabs 6 hourly prn. Oral Rehydration Salts (Jeewani) 1L daily. Avoid NSAIDs.',
        notes: 'Daily Full Blood Count (FBC) monitoring. Advised to report immediately if abdominal pain, mucosal bleeding, or severe lethargy occurs.',
        remarks: 'Emergency dengue surveillance review; platelet count checked.',
      },
      {
        diagnosis: 'Type 2 Diabetes Mellitus with Mild Diabetic Sensory Neuropathy',
        prescription: 'Metformin 500mg bd with meals, Sitagliptin 50mg mane, Methylcobalamin 500mcg daily.',
        notes: 'HbA1c is 7.2%. Foot examination shows intact monofilament sensation. Advised diabetic footwear and annual retinal screening.',
        remarks: 'Diabetic follow-up & HbA1c review.',
      },
      {
        diagnosis: 'Essential Hypertension - Stage 2, Good Glycemic Control',
        prescription: 'Losartan Potassium 50mg mane, Amlodipine 5mg mane, Atorvastatin 20mg nocte.',
        notes: 'BP recorded at 138/84 mmHg (improved from 158/96). Ambulatory BP diary reviewed. Recheck lipid profile and serum creatinine in 3 months.',
        remarks: 'Hypertension evaluation and ECG review.',
      },
      {
        diagnosis: 'Acute Viral Bronchiolitis with Mild Wheezing',
        prescription: 'Salbutamol syrup 2mg/5ml (2.5ml tds for 3 days), Normal saline nasal drops, Steam inhalation.',
        notes: 'Chest auscultation revealed bilateral scattered rhonchi without subcostal retractions. SpO2 98% on room air. Review in 48 hours.',
        remarks: 'Pediatric respiratory follow-up.',
      },
      {
        diagnosis: 'Chronic Atopic Dermatitis Flare with Secondary Xerosis',
        prescription: 'Mometasone furoate 0.1% cream apply thin layer nocte for 7 days, Aqueous cream moisturizer liberal use, Cetirizine 10mg nocte.',
        notes: 'Skin patch test shows sensitivity to commercial harsh soaps. Advised soap-free cleansers and soft cotton clothing.',
        remarks: 'Dermatology consultation for skin eczema flare.',
      },
      {
        diagnosis: 'Bilateral Knee Osteoarthritis (Kellgren-Lawrence Grade 2)',
        prescription: 'Paracetamol 1g tds prn, Glucosamine Sulfate 1500mg daily, Topical Diclofenac gel bd.',
        notes: 'Referred to clinic physiotherapist for quadriceps strengthening exercises and weight management advice. Avoid deep squatting.',
        remarks: 'Orthopedic knee joint evaluation.',
      },
      {
        diagnosis: 'Non-Ulcer Dyspepsia (GERD with Functional Gastritis)',
        prescription: 'Omeprazole 20mg mane 30 minutes before breakfast for 14 days, Domperidone 10mg tds ac, Gaviscon suspension 10ml sos.',
        notes: 'Symptoms exacerbated by spicy/oily food and tea on empty stomach. Dietary modifications discussed.',
        remarks: 'Gastritis and acid reflux consultation.',
      },
      {
        diagnosis: 'Migraine with Visual Aura (Frequent Episodes)',
        prescription: 'Sumatriptan 50mg at onset of attack, Propranolol 40mg bd for prophylaxis.',
        notes: 'Headache diary provided. Advised regular sleep routine, hydration, and reduction in screen time.',
        remarks: 'Neurological migraine checkup.',
      },
      {
        diagnosis: 'Primary Hyperlipidemia (Elevated LDL-C 168 mg/dL)',
        prescription: 'Atorvastatin 20mg nocte, Omega-3 fatty acid capsule 1000mg daily.',
        notes: 'Dietary consultation: reduce saturated fats, coconut milk intake, and fried snacks. Retest lipid profile in 12 weeks.',
        remarks: 'Lipid profile review and cardiovascular screening.',
      },
      {
        diagnosis: 'Perennial Allergic Rhinitis with Seasonal Exacerbation',
        prescription: 'Fluticasone furoate nasal spray 1 spray each nostril daily, Levocetirizine 5mg nocte.',
        notes: 'Avoid dust exposure and pollen during early morning garden walks. Nasal saline rinse recommended.',
        remarks: 'Allergy consultation and nasal airway review.',
      },
    ];

    const cancellationReasons = [
      'Patient phoned clinic reception to reschedule due to heavy rain in Colombo.',
      'Doctor called for urgent emergency hospital ward round.',
      'Patient feeling improved; deferred consultation to next month.',
      'Rescheduled due to sudden family commitment in Kandy.',
      'Patient requested postponement due to overseas work travel.',
    ];

    let appointmentCount = 0;
    let medicalRecordCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateForDay = new Date(currentYear, currentMonth, day);
      const dayOfWeek = dateForDay.getDay(); // 0 is Sunday, 6 is Saturday

      // Determine number of appointments for this day
      let dailySlots = [];
      if (dayOfWeek === 0) {
        // Sunday: 1 morning appointment
        dailySlots = [timeSlots[1]];
      } else if (dayOfWeek === 6) {
        // Saturday: 2 morning appointments
        dailySlots = [timeSlots[0], timeSlots[2]];
      } else {
        // Weekdays: 3 or 4 appointments
        const count = ((day % 2) === 0) ? 4 : 3;
        dailySlots = [timeSlots[0], timeSlots[2], timeSlots[4], timeSlots[6]].slice(0, count);
      }

      for (let sIdx = 0; sIdx < dailySlots.length; sIdx++) {
        const slot = dailySlots[sIdx];
        const apptDate = new Date(currentYear, currentMonth, day, slot.hour, slot.minute, 0, 0);

        // Select doctor and patient cyclically
        const doctorIndex = (day + sIdx) % doctors.length;
        const patientIndex = (day * 2 + sIdx * 3) % patients.length;
        const selectedDoctor = doctors[doctorIndex];
        const selectedPatient = patients[patientIndex];

        // Determine status based on current time
        let status = 'scheduled';
        let remarks = null;

        if (day < currentDay) {
          // Past days: ~85% completed, ~15% cancelled
          const isCancelled = ((day + sIdx) % 7 === 0);
          if (isCancelled) {
            status = 'cancelled';
            remarks = cancellationReasons[(day + sIdx) % cancellationReasons.length];
          } else {
            status = 'completed';
            remarks = 'Consultation successfully completed. Vital signs recorded and treatment issued.';
          }
        } else if (day === currentDay) {
          // Today: morning completed, afternoon scheduled
          if (slot.hour < now.getHours() || (slot.hour === now.getHours() && slot.minute <= now.getMinutes())) {
            status = 'completed';
            remarks = 'Morning consultation attended on time.';
          } else {
            status = 'scheduled';
            remarks = 'Checked in at reception; awaiting doctor.';
          }
        } else {
          // Future days: scheduled
          status = 'scheduled';
          remarks = 'Pre-booked clinical appointment.';
        }

        await Appointment.create({
          patient_id: selectedPatient.patient_id,
          doctor_id: selectedDoctor.doctor_id,
          date_time: apptDate,
          status,
          remarks,
        });
        appointmentCount++;

        // If completed, create a corresponding Sri Lankan medical record
        if (status === 'completed') {
          const context = clinicalContexts[(day + sIdx) % clinicalContexts.length];
          const recordDateStr = apptDate.toISOString().split('T')[0];

          await MedicalRecord.create({
            patient_id: selectedPatient.patient_id,
            doctor_id: selectedDoctor.doctor_id,
            diagnosis: context.diagnosis,
            prescription: context.prescription,
            notes: context.notes,
            record_date: recordDateStr,
          });
          medicalRecordCount++;
        }
      }
    }

    logger.info(`Successfully created ${appointmentCount} appointments across current month (${medicalRecordCount} with completed clinical records).`);

    // 6. Seed Realistic Audit Logs
    logger.info('Seeding clinic system audit logs...');
    const auditLogsData = [
      {
        user_id: userMap['admin@clinic.local'].user_id,
        action: 'LOGIN',
        entity: 'User',
        entity_id: String(userMap['admin@clinic.local'].user_id),
        ip_address: '192.168.1.10',
        details: 'System administrator login from Colombo Clinic Head Office',
      },
      {
        user_id: userMap['receptionist@clinic.local'].user_id,
        action: 'CREATE',
        entity: 'Patient',
        entity_id: String(patients[0].patient_id),
        ip_address: '192.168.1.15',
        details: `Registered new patient: ${patients[0].name}`,
      },
      {
        user_id: userMap['dr.smith@clinic.local'].user_id,
        action: 'UPDATE',
        entity: 'MedicalRecord',
        entity_id: '1',
        ip_address: '192.168.1.22',
        details: 'Doctor added clinical diagnosis & electronic prescription',
      },
      {
        user_id: userMap['receptionist@clinic.local'].user_id,
        action: 'EXPORT',
        entity: 'Reports',
        entity_id: 'all',
        ip_address: '192.168.1.15',
        details: 'Exported monthly clinic appointment summary CSV',
      },
    ];

    for (const log of auditLogsData) {
      await AuditLog.create(log);
    }

    logger.info('Database seeded successfully with full Sri Lankan context!');
    logger.info('===============================================================');
    logger.info('       SRI LANKAN CLINIC MANAGEMENT SYSTEM SEED DATA           ');
    logger.info('===============================================================');
    logger.info('Admin Account:        admin@clinic.local          / AdminPass123!     (Pasan Jayasuriya)');
    logger.info('Receptionist Account: receptionist@clinic.local   / ReceptionPass123! (Kumari Dissanayake)');
    logger.info('Doctor (Cardiology):  dr.smith@clinic.local       / DoctorPass123!    (Dr. Sanduni Perera)');
    logger.info('Doctor (Physician):   dr.house@clinic.local       / DoctorPass123!    (Dr. Nuwan Jayawardena)');
    logger.info('Doctor (Pediatrics):  dr.desilva@clinic.local     / DoctorPass123!    (Dr. Chamari De Silva)');
    logger.info('Doctor (Dermatology): dr.wickramasinghe@clinic.local / DoctorPass123! (Dr. Dilani Wickramasinghe)');
    logger.info('Doctor (Orthopedic):  dr.fernando@clinic.local    / DoctorPass123!    (Dr. Anura Fernando)');
    logger.info('Patient Account:      patient@clinic.local        / PatientPass123!   (Ruwan Bandara)');
    logger.info('---------------------------------------------------------------');
    logger.info(`Total Appointments:  ${appointmentCount} (Spanning full month 1-${daysInMonth})`);
    logger.info(`Completed Records:   ${medicalRecordCount} (Full medical diagnoses & prescriptions)`);
    logger.info(`Registered Patients: ${patients.length} (Sri Lankan addresses & profiles)`);
    logger.info('===============================================================');

    process.exit(0);
  } catch (err) {
    logger.error('Failed to seed database', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

seed();
