-- GiderRaporuTemplates Tablosunu Oluştur
-- Bu script'i SQL Server Management Studio veya başka bir SQL client ile çalıştırın

USE [FinansAnaliz]
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GiderRaporuTemplates]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[GiderRaporuTemplates] (
        [Id] int IDENTITY(1,1) NOT NULL,
        [CompanyId] int NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [TemplateName] nvarchar(200) NOT NULL,
        [GroupsJson] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_GiderRaporuTemplates] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_GiderRaporuTemplates_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_GiderRaporuTemplates_Companies_CompanyId] FOREIGN KEY ([CompanyId]) REFERENCES [dbo].[Companies] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_GiderRaporuTemplates_CompanyId] ON [dbo].[GiderRaporuTemplates] ([CompanyId]);
    CREATE INDEX [IX_GiderRaporuTemplates_UserId] ON [dbo].[GiderRaporuTemplates] ([UserId]);
    CREATE UNIQUE INDEX [IX_GiderRaporuTemplates_CompanyId_TemplateName] ON [dbo].[GiderRaporuTemplates] ([CompanyId], [TemplateName]);
    
    PRINT 'GiderRaporuTemplates tablosu başarıyla oluşturuldu!'
END
ELSE
BEGIN
    PRINT 'GiderRaporuTemplates tablosu zaten mevcut.'
END
GO
