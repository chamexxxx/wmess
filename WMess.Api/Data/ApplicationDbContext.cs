using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Models;

namespace WMess.Api.Data;

public class ApplicationDbContext : IdentityDbContext<IdentityUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Team> Teams { get; set; }
    public DbSet<Project> Projects { get; set; }
    public DbSet<TeamUser> TeamUsers { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<Document> Documents { get; set; }
    public DbSet<DocumentFolder> DocumentFolders { get; set; }
    public DbSet<DocumentPermission> DocumentPermissions { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Конфигурация связи многие-ко-многим между Team и IdentityUser через TeamUser
        builder.Entity<TeamUser>()
            .HasKey(tu => new { tu.TeamId, tu.UserId });

        builder.Entity<TeamUser>()
            .HasOne(tu => tu.Team)
            .WithMany(t => t.TeamUsers)
            .HasForeignKey(tu => tu.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamUser>()
            .HasOne(tu => tu.User)
            .WithMany()
            .HasForeignKey(tu => tu.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи Project -> Team
        builder.Entity<Project>()
            .HasOne(p => p.Team)
            .WithMany(t => t.Projects)
            .HasForeignKey(p => p.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи DocumentFolder -> Project
        builder.Entity<DocumentFolder>()
            .HasOne(df => df.Project)
            .WithMany()
            .HasForeignKey(df => df.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация иерархии папок (самоссылающаяся связь)
        builder.Entity<DocumentFolder>()
            .HasOne(df => df.ParentFolder)
            .WithMany(df => df.SubFolders)
            .HasForeignKey(df => df.ParentFolderId)
            .OnDelete(DeleteBehavior.Restrict);

        // Конфигурация связи Document -> Project
        builder.Entity<Document>()
            .HasOne(d => d.Project)
            .WithMany()
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи Document -> DocumentFolder
        builder.Entity<Document>()
            .HasOne(d => d.Folder)
            .WithMany(f => f.Documents)
            .HasForeignKey(d => d.FolderId)
            .OnDelete(DeleteBehavior.SetNull);

        // Конфигурация связи Document -> Creator (IdentityUser)
        builder.Entity<Document>()
            .HasOne(d => d.Creator)
            .WithMany()
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи DocumentPermission -> Document
        builder.Entity<DocumentPermission>()
            .HasOne(dp => dp.Document)
            .WithMany(d => d.Permissions)
            .HasForeignKey(dp => dp.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи DocumentPermission -> User
        builder.Entity<DocumentPermission>()
            .HasOne(dp => dp.User)
            .WithMany()
            .HasForeignKey(dp => dp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Уникальный индекс для предотвращения дублирования прав
        builder.Entity<DocumentPermission>()
            .HasIndex(dp => new { dp.DocumentId, dp.UserId })
            .IsUnique();
    }
}
