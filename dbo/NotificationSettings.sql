/*-----------------------------------------------------------------
* File: NotificationSettings.sql
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
CREATE TABLE [dbo].[NotificationSettings] (
    [ID]                 INT      IDENTITY (1, 1) NOT NULL,
    [UserID]             BIGINT   NOT NULL,
    [EmailNotifications] BIT      DEFAULT ((1)) NULL,
    [NewUserAlerts]      BIT      DEFAULT ((1)) NULL,
    [SystemAlerts]       BIT      DEFAULT ((1)) NULL,
    [ReportAlerts]       BIT      DEFAULT ((1)) NULL,
    [EventReminders]     BIT      DEFAULT ((1)) NULL,
    [ExamNotifications]  BIT      DEFAULT ((1)) NULL,
    [UpdatedAt]          DATETIME DEFAULT (getdate()) NULL,
    PRIMARY KEY CLUSTERED ([ID] ASC),
    FOREIGN KEY ([UserID]) REFERENCES [dbo].[Users] ([UserID])
);


GO

CREATE NONCLUSTERED INDEX [IX_NotificationSettings_UserID]
    ON [dbo].[NotificationSettings]([UserID] ASC);


GO

