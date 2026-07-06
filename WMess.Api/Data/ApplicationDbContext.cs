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
    public DbSet<LibraryItem> LibraryItems { get; set; }
    public DbSet<DocumentContent> DocumentContents { get; set; }
    public DbSet<BoardContent> BoardContents { get; set; }
    public DbSet<LibraryFolder> LibraryFolders { get; set; }
    public DbSet<LibraryPermission> LibraryPermissions { get; set; }

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

        // Конфигурация связи LibraryFolder -> Project
        builder.Entity<LibraryFolder>()
            .HasOne(df => df.Project)
            .WithMany()
            .HasForeignKey(df => df.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация иерархии папок (самоссылающаяся связь)
        builder.Entity<LibraryFolder>()
            .HasOne(df => df.ParentFolder)
            .WithMany(df => df.SubFolders)
            .HasForeignKey(df => df.ParentFolderId)
            .OnDelete(DeleteBehavior.Restrict);

        // Конфигурация связи LibraryItem -> Project
        builder.Entity<LibraryItem>()
            .HasOne(d => d.Project)
            .WithMany()
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи LibraryItem -> LibraryFolder
        builder.Entity<LibraryItem>()
            .HasOne(d => d.Folder)
            .WithMany(f => f.Items)
            .HasForeignKey(d => d.FolderId)
            .OnDelete(DeleteBehavior.SetNull);

        // Конфигурация связи LibraryItem -> Creator (IdentityUser)
        builder.Entity<LibraryItem>()
            .HasOne(d => d.Creator)
            .WithMany()
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.Cascade);

        // Контент типа Document (1:1, PK = FK); удаляется вместе с элементом
        builder.Entity<DocumentContent>()
            .HasOne(c => c.Item)
            .WithOne(i => i.DocumentContent)
            .HasForeignKey<DocumentContent>(c => c.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Контент типа Board (1:1, PK = FK); удаляется вместе с элементом
        builder.Entity<BoardContent>()
            .HasOne(c => c.Item)
            .WithOne(i => i.BoardContent)
            .HasForeignKey<BoardContent>(c => c.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи LibraryPermission -> LibraryItem
        builder.Entity<LibraryPermission>()
            .HasOne(dp => dp.Item)
            .WithMany(d => d.Permissions)
            .HasForeignKey(dp => dp.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Конфигурация связи LibraryPermission -> User
        builder.Entity<LibraryPermission>()
            .HasOne(dp => dp.User)
            .WithMany()
            .HasForeignKey(dp => dp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Уникальный индекс для предотвращения дублирования прав
        builder.Entity<LibraryPermission>()
            .HasIndex(dp => new { dp.LibraryItemId, dp.UserId })
            .IsUnique();
    }
}
