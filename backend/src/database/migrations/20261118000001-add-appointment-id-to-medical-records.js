'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('medical_records', 'appointment_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'appointments',
        key: 'appointment_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('medical_records', ['appointment_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('medical_records', ['appointment_id']);
    await queryInterface.removeColumn('medical_records', 'appointment_id');
  },
};
