using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMess.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLinkContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LinkContents",
                columns: table => new
                {
                    LibraryItemId = table.Column<int>(type: "integer", nullable: false),
                    Url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LinkContents", x => x.LibraryItemId);
                    table.ForeignKey(
                        name: "FK_LinkContents_LibraryItems_LibraryItemId",
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
                name: "LinkContents");
        }
    }
}
