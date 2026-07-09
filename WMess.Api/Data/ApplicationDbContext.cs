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

    public DbSet<Chat> Chats { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<Attachment> Attachments { get; set; }
    public DbSet<Reaction> Reactions { get; set; }
    public DbSet<PinnedMessage> PinnedMessages { get; set; }
    public DbSet<ChatMember> ChatMembers { get; set; }

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

        // ===== Чаты =====

        // Chat -> Team (опционально, каскадное удаление команды удаляет чат)
        builder.Entity<Chat>()
            .HasOne(c => c.Team)
            .WithMany()
            .HasForeignKey(c => c.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        // Chat -> Project (опционально)
        builder.Entity<Chat>()
            .HasOne(c => c.Project)
            .WithMany()
            .HasForeignKey(c => c.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Message -> Chat
        builder.Entity<Message>()
            .HasOne(m => m.Chat)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        // Message -> Author (IdentityUser)
        builder.Entity<Message>()
            .HasOne(m => m.Author)
            .WithMany()
            .HasForeignKey(m => m.AuthorId)
            .OnDelete(DeleteBehavior.Cascade);

        // Message -> ParentMessage (самоссылающаяся связь, ответы/треды)
        builder.Entity<Message>()
            .HasOne(m => m.ParentMessage)
            .WithMany()
            .HasForeignKey(m => m.ParentMessageId)
            .OnDelete(DeleteBehavior.Restrict);

        // Индексы ленты: Message(ChatId, CreatedAt) и Message(ParentMessageId)
        builder.Entity<Message>()
            .HasIndex(m => new { m.ChatId, m.CreatedAt });

        builder.Entity<Message>()
            .HasIndex(m => m.ParentMessageId);

        // Attachment -> Message
        builder.Entity<Attachment>()
            .HasOne(a => a.Message)
            .WithMany(m => m.Attachments)
            .HasForeignKey(a => a.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        // Reaction -> Message
        builder.Entity<Reaction>()
            .HasOne(r => r.Message)
            .WithMany(m => m.Reactions)
            .HasForeignKey(r => r.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        // Reaction -> User
        builder.Entity<Reaction>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Уникальность реакции: (MessageId, UserId, Emoji)
        builder.Entity<Reaction>()
            .HasIndex(r => new { r.MessageId, r.UserId, r.Emoji })
            .IsUnique();

        // PinnedMessage -> Chat
        builder.Entity<PinnedMessage>()
            .HasOne(p => p.Chat)
            .WithMany(c => c.PinnedMessages)
            .HasForeignKey(p => p.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        // PinnedMessage -> Message
        builder.Entity<PinnedMessage>()
            .HasOne(p => p.Message)
            .WithMany()
            .HasForeignKey(p => p.MessageId)
            .OnDelete(DeleteBehavior.Restrict);

        // PinnedMessage -> PinnedByUser
        builder.Entity<PinnedMessage>()
            .HasOne(p => p.PinnedByUser)
            .WithMany()
            .HasForeignKey(p => p.PinnedBy)
            .OnDelete(DeleteBehavior.Cascade);

        // Уникальность пина: (ChatId, MessageId)
        builder.Entity<PinnedMessage>()
            .HasIndex(p => new { p.ChatId, p.MessageId })
            .IsUnique();

        // ChatMember -> Chat
        builder.Entity<ChatMember>()
            .HasOne(cm => cm.Chat)
            .WithMany(c => c.Members)
            .HasForeignKey(cm => cm.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        // ChatMember -> User
        builder.Entity<ChatMember>()
            .HasOne(cm => cm.User)
            .WithMany()
            .HasForeignKey(cm => cm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Один участник на чат
        builder.Entity<ChatMember>()
            .HasIndex(cm => new { cm.ChatId, cm.UserId })
            .IsUnique();
    }
}