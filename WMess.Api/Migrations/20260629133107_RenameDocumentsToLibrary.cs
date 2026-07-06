using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WMess.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameDocumentsToLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Переименование документной модели в библиотечную с сохранением данных.
            // В Postgres FK ссылаются на таблицы по OID, поэтому RENAME TABLE их не ломает.

            // 1. Таблицы
            migrationBuilder.RenameTable(name: "Documents", newName: "LibraryItems");
            migrationBuilder.RenameTable(name: "DocumentFolders", newName: "LibraryFolders");
            migrationBuilder.RenameTable(name: "DocumentPermissions", newName: "LibraryPermissions");

            // 2. Колонка DocumentId -> LibraryItemId в правах
            migrationBuilder.RenameColumn(
                name: "DocumentId",
                table: "LibraryPermissions",
                newName: "LibraryItemId");

            // 3. Тип элемента. Все существующие записи — документы (0). Бэкфилл через DEFAULT,
            //    затем дефолт снимаем, чтобы схема совпадала с моделью (там DB-дефолта нет).
            migrationBuilder.AddColumn<int>(
                name: "Type",
                table: "LibraryItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);
            migrationBuilder.Sql(@"ALTER TABLE ""LibraryItems"" ALTER COLUMN ""Type"" DROP DEFAULT;");

            // 4. Контент документов выносим в отдельную 1:1 таблицу
            migrationBuilder.CreateTable(
                name: "DocumentContents",
                columns: table => new
                {
                    LibraryItemId = table.Column<int>(type: "integer", nullable: false),
                    YjsState = table.Column<byte[]>(type: "bytea", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentContents", x => x.LibraryItemId);
                    table.ForeignKey(
                        name: "FK_DocumentContents_LibraryItems_LibraryItemId",
                        column: x => x.LibraryItemId,
                        principalTable: "LibraryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // 5. Переносим Yjs-снапшоты в DocumentContents (только непустые)
            migrationBuilder.Sql(@"
                INSERT INTO ""DocumentContents"" (""LibraryItemId"", ""YjsState"")
                SELECT ""Id"", ""YjsState"" FROM ""LibraryItems"" WHERE ""YjsState"" IS NOT NULL;");

            // 6. Удаляем колонку контента из базовой таблицы
            migrationBuilder.DropColumn(name: "YjsState", table: "LibraryItems");

            // 7. Индексы под имена, ожидаемые EF
            migrationBuilder.RenameIndex(name: "IX_Documents_CreatedBy", table: "LibraryItems", newName: "IX_LibraryItems_CreatedBy");
            migrationBuilder.RenameIndex(name: "IX_Documents_FolderId", table: "LibraryItems", newName: "IX_LibraryItems_FolderId");
            migrationBuilder.RenameIndex(name: "IX_Documents_ProjectId", table: "LibraryItems", newName: "IX_LibraryItems_ProjectId");
            migrationBuilder.RenameIndex(name: "IX_DocumentFolders_ParentFolderId", table: "LibraryFolders", newName: "IX_LibraryFolders_ParentFolderId");
            migrationBuilder.RenameIndex(name: "IX_DocumentFolders_ProjectId", table: "LibraryFolders", newName: "IX_LibraryFolders_ProjectId");
            migrationBuilder.RenameIndex(name: "IX_DocumentPermissions_DocumentId_UserId", table: "LibraryPermissions", newName: "IX_LibraryPermissions_LibraryItemId_UserId");
            migrationBuilder.RenameIndex(name: "IX_DocumentPermissions_UserId", table: "LibraryPermissions", newName: "IX_LibraryPermissions_UserId");

            // 8. PK/FK-ограничения под имена, ожидаемые EF
            migrationBuilder.Sql(@"
                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""PK_Documents"" TO ""PK_LibraryItems"";
                ALTER TABLE ""LibraryFolders"" RENAME CONSTRAINT ""PK_DocumentFolders"" TO ""PK_LibraryFolders"";
                ALTER TABLE ""LibraryPermissions"" RENAME CONSTRAINT ""PK_DocumentPermissions"" TO ""PK_LibraryPermissions"";

                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""FK_Documents_AspNetUsers_CreatedBy"" TO ""FK_LibraryItems_AspNetUsers_CreatedBy"";
                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""FK_Documents_DocumentFolders_FolderId"" TO ""FK_LibraryItems_LibraryFolders_FolderId"";
                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""FK_Documents_Projects_ProjectId"" TO ""FK_LibraryItems_Projects_ProjectId"";

                ALTER TABLE ""LibraryFolders"" RENAME CONSTRAINT ""FK_DocumentFolders_DocumentFolders_ParentFolderId"" TO ""FK_LibraryFolders_LibraryFolders_ParentFolderId"";
                ALTER TABLE ""LibraryFolders"" RENAME CONSTRAINT ""FK_DocumentFolders_Projects_ProjectId"" TO ""FK_LibraryFolders_Projects_ProjectId"";

                ALTER TABLE ""LibraryPermissions"" RENAME CONSTRAINT ""FK_DocumentPermissions_AspNetUsers_UserId"" TO ""FK_LibraryPermissions_AspNetUsers_UserId"";
                ALTER TABLE ""LibraryPermissions"" RENAME CONSTRAINT ""FK_DocumentPermissions_Documents_DocumentId"" TO ""FK_LibraryPermissions_LibraryItems_LibraryItemId"";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // 1. Возвращаем колонку контента и переносим снапшоты обратно
            migrationBuilder.AddColumn<byte[]>(
                name: "YjsState",
                table: "LibraryItems",
                type: "bytea",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE ""LibraryItems"" AS i
                SET ""YjsState"" = c.""YjsState""
                FROM ""DocumentContents"" AS c
                WHERE i.""Id"" = c.""LibraryItemId"";");

            migrationBuilder.DropTable(name: "DocumentContents");

            // 2. Убираем тип элемента
            migrationBuilder.DropColumn(name: "Type", table: "LibraryItems");

            // 3. Колонка прав обратно
            migrationBuilder.RenameColumn(
                name: "LibraryItemId",
                table: "LibraryPermissions",
                newName: "DocumentId");

            // 4. Индексы обратно
            migrationBuilder.RenameIndex(name: "IX_LibraryItems_CreatedBy", table: "LibraryItems", newName: "IX_Documents_CreatedBy");
            migrationBuilder.RenameIndex(name: "IX_LibraryItems_FolderId", table: "LibraryItems", newName: "IX_Documents_FolderId");
            migrationBuilder.RenameIndex(name: "IX_LibraryItems_ProjectId", table: "LibraryItems", newName: "IX_Documents_ProjectId");
            migrationBuilder.RenameIndex(name: "IX_LibraryFolders_ParentFolderId", table: "LibraryFolders", newName: "IX_DocumentFolders_ParentFolderId");
            migrationBuilder.RenameIndex(name: "IX_LibraryFolders_ProjectId", table: "LibraryFolders", newName: "IX_DocumentFolders_ProjectId");
            migrationBuilder.RenameIndex(name: "IX_LibraryPermissions_LibraryItemId_UserId", table: "LibraryPermissions", newName: "IX_DocumentPermissions_DocumentId_UserId");
            migrationBuilder.RenameIndex(name: "IX_LibraryPermissions_UserId", table: "LibraryPermissions", newName: "IX_DocumentPermissions_UserId");

            // 5. PK/FK-ограничения обратно (таблицы ещё называются Library*)
            migrationBuilder.Sql(@"
                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""PK_LibraryItems"" TO ""PK_Documents"";
                ALTER TABLE ""LibraryFolders"" RENAME CONSTRAINT ""PK_LibraryFolders"" TO ""PK_DocumentFolders"";
                ALTER TABLE ""LibraryPermissions"" RENAME CONSTRAINT ""PK_LibraryPermissions"" TO ""PK_DocumentPermissions"";

                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""FK_LibraryItems_AspNetUsers_CreatedBy"" TO ""FK_Documents_AspNetUsers_CreatedBy"";
                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""FK_LibraryItems_LibraryFolders_FolderId"" TO ""FK_Documents_DocumentFolders_FolderId"";
                ALTER TABLE ""LibraryItems"" RENAME CONSTRAINT ""FK_LibraryItems_Projects_ProjectId"" TO ""FK_Documents_Projects_ProjectId"";

                ALTER TABLE ""LibraryFolders"" RENAME CONSTRAINT ""FK_LibraryFolders_LibraryFolders_ParentFolderId"" TO ""FK_DocumentFolders_DocumentFolders_ParentFolderId"";
                ALTER TABLE ""LibraryFolders"" RENAME CONSTRAINT ""FK_LibraryFolders_Projects_ProjectId"" TO ""FK_DocumentFolders_Projects_ProjectId"";

                ALTER TABLE ""LibraryPermissions"" RENAME CONSTRAINT ""FK_LibraryPermissions_AspNetUsers_UserId"" TO ""FK_DocumentPermissions_AspNetUsers_UserId"";
                ALTER TABLE ""LibraryPermissions"" RENAME CONSTRAINT ""FK_LibraryPermissions_LibraryItems_LibraryItemId"" TO ""FK_DocumentPermissions_Documents_DocumentId"";");

            // 6. Таблицы обратно
            migrationBuilder.RenameTable(name: "LibraryItems", newName: "Documents");
            migrationBuilder.RenameTable(name: "LibraryFolders", newName: "DocumentFolders");
            migrationBuilder.RenameTable(name: "LibraryPermissions", newName: "DocumentPermissions");
        }
    }
}
