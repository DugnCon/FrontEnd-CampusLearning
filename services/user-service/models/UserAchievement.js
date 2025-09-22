/*-----------------------------------------------------------------
* File: UserAchievement.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is part of the user backend service.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Achievement = require('./Achievement');

const UserAchievement = sequelize.define('UserAchievement', {
  UserAchievementID: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  UserID: {
    type: DataTypes.BIGINT,
    references: {
      model: User,
      key: 'UserID'
    }
  },
  AchievementID: {
    type: DataTypes.INTEGER,
    references: {
      model: Achievement,
      key: 'AchievementID'
    }
  },
  EarnedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  Progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'UserAchievements',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['UserID', 'AchievementID']
    }
  ]
});

// Define associations
UserAchievement.belongsTo(User, { foreignKey: 'UserID' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'AchievementID' });
User.hasMany(UserAchievement, { foreignKey: 'UserID' });
Achievement.hasMany(UserAchievement, { foreignKey: 'AchievementID' });

module.exports = UserAchievement; 
