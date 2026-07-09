using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMess.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageReplyMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReplyMode",
                table: "Messages",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReplyMode",
                table: "Messages");
        }
    }
}
