using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Scalar.AspNetCore;
using System.Text;
using WMess.Api.Data;
using WMess.Api.Infrastructure;
using WMess.Api.Services;
using WMess.Api.Authorization;

var builder = WebApplication.CreateBuilder(args);
// Add services to the container.
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<OpenApiSecurityTransformer>();
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Info.Title = "WMess API";
        document.Info.Version = "v1";
        document.Info.Description = "API для системы управления сообщениями WMess";
        return Task.CompletedTask;
    });
});

// Configure Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure Identity
builder.Services.AddIdentity<IdentityUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 6;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["Secret"];

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!))
    };

    // SignalR передаёт токен через query string (?access_token=...) для WebSocket/SSE,
    // где браузер не может выставить заголовок Authorization. Прокидываем его на /hubs.
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// Configure resource-based authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.TeamMember, p => p.AddRequirements(new TeamMemberRequirement()));
    options.AddPolicy(Policies.TeamManage, p => p.AddRequirements(new TeamManageRequirement()));
    options.AddPolicy(Policies.TeamDelete, p => p.AddRequirements(new TeamDeleteRequirement()));
    options.AddPolicy(Policies.TeamChangeRole, p => p.AddRequirements(new TeamChangeRoleRequirement()));
    options.AddPolicy(Policies.ProjectAccess, p => p.AddRequirements(new ProjectAccessRequirement()));
    options.AddPolicy(Policies.ProjectManage, p => p.AddRequirements(new ProjectManageRequirement()));
});

// Register Token Service
builder.Services.AddScoped<ITokenService, TokenService>();

// Register Library Access Service (единый источник вычисления прав на элемент библиотеки)
builder.Services.AddScoped<ILibraryAccessService, LibraryAccessService>();

// Register Authorization Handlers
builder.Services.AddScoped<IAuthorizationHandler, TeamMemberHandler>();
builder.Services.AddScoped<IAuthorizationHandler, TeamManageHandler>();
builder.Services.AddScoped<IAuthorizationHandler, TeamDeleteHandler>();
builder.Services.AddScoped<IAuthorizationHandler, TeamChangeRoleHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ProjectAccessHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ProjectManageHandler>();

// Register SignalR (MessagePack — для эффективной передачи бинарных Yjs-апдейтов)
builder.Services.AddSignalR(options =>
{
    // По умолчанию вызовы одного клиента обрабатываются строго последовательно (лимит = 1).
    // SaveLibraryItemState пишет снапшот в БД (медленно) и при этом лимите блокирует поток
    // инкрементальных SendUpdate/SendAwareness — у других участников правки появляются
    // рывками/с задержкой. Разрешаем несколько параллельных вызовов, чтобы запись снапшота
    // не вставала «в голову очереди». Каждый вызов хаба получает свой DI-scope (и свой
    // DbContext), поэтому параллелизм безопасен.
    options.MaximumParallelInvocationsPerClient = 8;

    // Дефолтный лимит входящего сообщения — 32 КБ. SaveLibraryItemState шлёт полный Yjs-снапшот
    // состояния (encodeStateAsUpdate), который на доске с несколькими фигурами легко превышает
    // 32 КБ; сервер тогда закрывает соединение с ошибкой, а на реконнекте Yjs ре-синкает всё
    // разом — отсюда обрывы в консоли и «пачки» правок у других участников. Поднимаем лимит.
    options.MaximumReceiveMessageSize = 20 * 1024 * 1024;
}).AddMessagePackProtocol();

// Register Controllers
builder.Services.AddControllers(options =>
{
    options.Conventions.Add(new RouteTokenTransformerConvention(new LowercaseRouteTransformer()));
});
var app = builder.Build();
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.WithTitle("WMess API");
    });
}
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

// Map Controllers
app.MapControllers();

// Map SignalR Hubs
app.MapHub<WMess.Api.Hubs.DocumentHub>("/hubs/document");
app.MapHub<WMess.Api.Hubs.BoardHub>("/hubs/board");
app.MapHub<WMess.Api.Hubs.TableHub>("/hubs/table");
app.Run();