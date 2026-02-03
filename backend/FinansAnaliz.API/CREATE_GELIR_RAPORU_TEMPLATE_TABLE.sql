-- Gelir Raporları şablonları tablosu (6'lı hesaplar)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GelirRaporuTemplates]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[GelirRaporuTemplates] (
        [Id] int NOT NULL IDENTITY(1,1),
        [CompanyId] int NOT NULL,
        [UserId] nvarchar(450) NOT NULL,
        [TemplateName] nvarchar(200) NOT NULL,
        [GroupsJson] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_GelirRaporuTemplates] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_GelirRaporuTemplates_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_GelirRaporuTemplates_Companies_CompanyId] FOREIGN KEY ([CompanyId]) REFERENCES [dbo].[Companies] ([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_GelirRaporuTemplates_CompanyId] ON [dbo].[GelirRaporuTemplates] ([CompanyId]);
    CREATE INDEX [IX_GelirRaporuTemplates_UserId] ON [dbo].[GelirRaporuTemplates] ([UserId]);
    CREATE UNIQUE INDEX [IX_GelirRaporuTemplates_CompanyId_TemplateName] ON [dbo].[GelirRaporuTemplates] ([CompanyId], [TemplateName]);
END
GO
