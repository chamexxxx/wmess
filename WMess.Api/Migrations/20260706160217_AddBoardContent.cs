using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMess.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBoardContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BoardContents",
                columns: table => new
                {
                    LibraryItemId = table.Column<int>(type: "integer", nullable: false),
                    YjsState = table.Column<byte[]>(type: "bytea", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BoardContents", x => x.LibraryItemId);
                    table.ForeignKey(
                        name: "FK_BoardContents_LibraryItems_LibraryItemId",
                        column: x => x.LibraryItemId,
                        principalTable: "LibraryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BoardContents");
        }
    }
}
