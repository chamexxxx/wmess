using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMess.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "TeamUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Role",
                table: "TeamUsers");
        }
    }
}
