using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WMess.Api.Models;

namespace WMess.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
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
    public DbSet<TableContent> TableContents { get; set; }
    public DbSet<FileContent> FileContents { get; set; }
    public DbSet<LinkContent> LinkContents { get; set; }
    public DbSet<LibraryFolder> LibraryFolders { get; set; }
    public DbSet<TaskItem> Tasks { get; set; }
    public DbSet<TaskGroup> TaskGroups { get; set; }
    public DbSet<TaskBoardColumn> TaskBoardColumns { get; set; }
    public DbSet<TaskComment> TaskComments { get; set; }
    public DbSet<TaskLabelDefinition> TaskLabelDefinitions { get; set; }
    public DbSet<TaskLabelAssignment> TaskLabelAssignments { get; set; }
    public DbSet<TaskAssignment> TaskAssignments { get; set; }
    public DbSet<TeamScheduleSettings> TeamScheduleSettings { get; set; }
    public DbSet<TeamHoliday> TeamHolidays { get; set; }

    public DbSet<Chat> Chats { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<Attachment> Attachments { get; set; }
    public DbSet<Reaction> Reactions { get; set; }
    public DbSet<PinnedMessage> PinnedMessages { get; set; }
    public DbSet<ChatMember> ChatMembers { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

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

        builder.Entity<Project>()
            .HasOne(p => p.Team)
            .WithMany(t => t.Projects)
            .HasForeignKey(p => p.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<LibraryFolder>()
            .HasOne(df => df.Project)
            .WithMany()
            .HasForeignKey(df => df.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<LibraryFolder>()
            .HasOne(df => df.ParentFolder)
            .WithMany(df => df.SubFolders)
            .HasForeignKey(df => df.ParentFolderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<LibraryItem>()
            .HasOne(d => d.Project)
            .WithMany()
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<LibraryItem>()
            .HasOne(d => d.Folder)
            .WithMany(f => f.Items)
            .HasForeignKey(d => d.FolderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<LibraryItem>()
            .HasOne(d => d.Creator)
            .WithMany()
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<DocumentContent>()
            .HasOne(c => c.Item)
            .WithOne(i => i.DocumentContent)
            .HasForeignKey<DocumentContent>(c => c.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<BoardContent>()
            .HasOne(c => c.Item)
            .WithOne(i => i.BoardContent)
            .HasForeignKey<BoardContent>(c => c.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TableContent>()
            .HasOne(c => c.Item)
            .WithOne(i => i.TableContent)
            .HasForeignKey<TableContent>(c => c.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Контент типа File (1:1, PK = FK); удаляется вместе с элементом
        builder.Entity<FileContent>()
            .HasOne(c => c.Item)
            .WithOne(i => i.FileContent)
            .HasForeignKey<FileContent>(c => c.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Контент типа Link (1:1, PK = FK); удаляется вместе с элементом
        builder.Entity<LinkContent>()
            .HasOne(c => c.Item)
            .WithOne(i => i.LinkContent)
            .HasForeignKey<LinkContent>(c => c.LibraryItemId)
            .OnDelete(DeleteBehavior.Cascade);

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

        // Message -> Author (ApplicationUser)
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

        builder.Entity<TaskBoardColumn>()
            .HasOne(c => c.Team)
            .WithMany(t => t.TaskBoardColumns)
            .HasForeignKey(c => c.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskGroup>()
            .HasOne(g => g.Team)
            .WithMany(t => t.TaskGroups)
            .HasForeignKey(g => g.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskItem>()
            .HasOne(t => t.Group)
            .WithMany(g => g.Tasks)
            .HasForeignKey(t => t.GroupId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<TaskItem>()
            .HasOne(t => t.Column)
            .WithMany(c => c.Tasks)
            .HasForeignKey(t => t.ColumnId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<TaskItem>()
            .HasOne(t => t.Project)
            .WithMany()
            .HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskItem>()
            .HasOne(t => t.Team)
            .WithMany()
            .HasForeignKey(t => t.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskItem>()
            .HasOne(t => t.CreatedBy)
            .WithMany()
            .HasForeignKey(t => t.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<TaskItem>()
            .HasOne(t => t.PrimaryAssignee)
            .WithMany()
            .HasForeignKey(t => t.PrimaryAssigneeId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<TaskItem>()
            .HasIndex(t => new { t.GroupId, t.ColumnId, t.SortOrder });

        builder.Entity<TaskAssignment>()
            .HasKey(ta => new { ta.TaskId, ta.UserId });

        builder.Entity<TaskAssignment>()
            .HasOne(ta => ta.Task)
            .WithMany(t => t.Assignments)
            .HasForeignKey(ta => ta.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskAssignment>()
            .HasOne(ta => ta.User)
            .WithMany()
            .HasForeignKey(ta => ta.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskComment>()
            .HasOne(tc => tc.Task)
            .WithMany(t => t.Comments)
            .HasForeignKey(tc => tc.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskComment>()
            .HasOne(tc => tc.User)
            .WithMany()
            .HasForeignKey(tc => tc.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<TaskLabelDefinition>()
            .HasOne(l => l.Team)
            .WithMany()
            .HasForeignKey(l => l.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskLabelAssignment>()
            .HasKey(la => new { la.TaskId, la.LabelId });

        builder.Entity<TaskLabelAssignment>()
            .HasOne(la => la.Task)
            .WithMany(t => t.LabelAssignments)
            .HasForeignKey(la => la.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TaskLabelAssignment>()
            .HasOne(la => la.Label)
            .WithMany(l => l.Assignments)
            .HasForeignKey(la => la.LabelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamScheduleSettings>()
            .HasKey(s => s.TeamId);

        builder.Entity<TeamScheduleSettings>()
            .HasOne(s => s.Team)
            .WithOne(t => t.ScheduleSettings)
            .HasForeignKey<TeamScheduleSettings>(s => s.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamHoliday>()
            .HasOne(h => h.Team)
            .WithMany()
            .HasForeignKey(h => h.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamHoliday>()
            .HasIndex(h => new { h.TeamId, h.Date })
            .IsUnique();
    }
}
