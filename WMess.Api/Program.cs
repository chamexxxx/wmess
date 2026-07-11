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
using WMess.Api.Models;
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
        document.Info.Description = "API РґР»СЏ СЃРёСЃС‚РµРјС‹ СѓРїСЂР°РІР»РµРЅРёСЏ СЃРѕРѕР±С‰РµРЅРёСЏРјРё WMess";
        return Task.CompletedTask;
    });
});

// Configure Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 6;

    // Р›РѕРіРёРЅ (UserName) СѓРЅРёРєР°Р»РµРЅ Рё РѕРіСЂР°РЅРёС‡РµРЅ Р»Р°С‚РёРЅРёС†РµР№, С†РёС„СЂР°РјРё, РґРµС„РёСЃРѕРј Рё РїРѕРґС‡С‘СЂРєРёРІР°РЅРёРµРј.
    options.User.RequireUniqueEmail = true;
    options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
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

    // SignalR РїРµСЂРµРґР°С‘С‚ С‚РѕРєРµРЅ С‡РµСЂРµР· query string (?access_token=...) РґР»СЏ WebSocket/SSE,
    // РіРґРµ Р±СЂР°СѓР·РµСЂ РЅРµ РјРѕР¶РµС‚ РІС‹СЃС‚Р°РІРёС‚СЊ Р·Р°РіРѕР»РѕРІРѕРє Authorization. РџСЂРѕРєРёРґС‹РІР°РµРј РµРіРѕ РЅР° /hubs.
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

// Register Library Access Service (РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РІС‹С‡РёСЃР»РµРЅРёСЏ РїСЂР°РІ РЅР° СЌР»РµРјРµРЅС‚ Р±РёР±Р»РёРѕС‚РµРєРё)
builder.Services.AddScoped<ILibraryAccessService, LibraryAccessService>();
builder.Services.AddScoped<IScheduleService, ScheduleService>();
builder.Services.AddScoped<ITasksChangeNotifier, TasksChangeNotifier>();
builder.Services.AddScoped<ICalendarChangeNotifier, CalendarChangeNotifier>();

// Register Chat Access Service (РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РІС‹С‡РёСЃР»РµРЅРёСЏ РїСЂР°РІ РЅР° С‡Р°С‚)
builder.Services.AddScoped<IChatAccessService, ChatAccessService>();

// Register Transcription Service (Р·Р°РіР»СѓС€РєР° РїРѕРґ Р±СѓРґСѓС‰РёР№ Whisper)
builder.Services.AddScoped<ITranscriptionService, StubTranscriptionService>();

// Register Task Resolver (Р·Р°РіР»СѓС€РєР° РїРѕРґ #{РЅРѕРјРµСЂ} Р·Р°РґР°С‡)
builder.Services.AddScoped<ITaskResolver, StubTaskResolver>();
// Register Authorization Handlers
builder.Services.AddScoped<IAuthorizationHandler, TeamMemberHandler>();
builder.Services.AddScoped<IAuthorizationHandler, TeamManageHandler>();
builder.Services.AddScoped<IAuthorizationHandler, TeamDeleteHandler>();
builder.Services.AddScoped<IAuthorizationHandler, TeamChangeRoleHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ProjectAccessHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ProjectManageHandler>();

// Register SignalR (MessagePack вЂ” РґР»СЏ СЌС„С„РµРєС‚РёРІРЅРѕР№ РїРµСЂРµРґР°С‡Рё Р±РёРЅР°СЂРЅС‹С… Yjs-Р°РїРґРµР№С‚РѕРІ)
builder.Services.AddSignalR(options =>
{
    // РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РІС‹Р·РѕРІС‹ РѕРґРЅРѕРіРѕ РєР»РёРµРЅС‚Р° РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ СЃС‚СЂРѕРіРѕ РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕ (Р»РёРјРёС‚ = 1).
    // SaveLibraryItemState РїРёС€РµС‚ СЃРЅР°РїС€РѕС‚ РІ Р‘Р” (РјРµРґР»РµРЅРЅРѕ) Рё РїСЂРё СЌС‚РѕРј Р»РёРјРёС‚Рµ Р±Р»РѕРєРёСЂСѓРµС‚ РїРѕС‚РѕРє
    // РёРЅРєСЂРµРјРµРЅС‚Р°Р»СЊРЅС‹С… SendUpdate/SendAwareness вЂ” Сѓ РґСЂСѓРіРёС… СѓС‡Р°СЃС‚РЅРёРєРѕРІ РїСЂР°РІРєРё РїРѕСЏРІР»СЏСЋС‚СЃСЏ
    // СЂС‹РІРєР°РјРё/СЃ Р·Р°РґРµСЂР¶РєРѕР№. Р Р°Р·СЂРµС€Р°РµРј РЅРµСЃРєРѕР»СЊРєРѕ РїР°СЂР°Р»Р»РµР»СЊРЅС‹С… РІС‹Р·РѕРІРѕРІ, С‡С‚РѕР±С‹ Р·Р°РїРёСЃСЊ СЃРЅР°РїС€РѕС‚Р°
    // РЅРµ РІСЃС‚Р°РІР°Р»Р° В«РІ РіРѕР»РѕРІСѓ РѕС‡РµСЂРµРґРёВ». РљР°Р¶РґС‹Р№ РІС‹Р·РѕРІ С…Р°Р±Р° РїРѕР»СѓС‡Р°РµС‚ СЃРІРѕР№ DI-scope (Рё СЃРІРѕР№
    // DbContext), РїРѕСЌС‚РѕРјСѓ РїР°СЂР°Р»Р»РµР»РёР·Рј Р±РµР·РѕРїР°СЃРµРЅ.
    options.MaximumParallelInvocationsPerClient = 8;

    // Р”РµС„РѕР»С‚РЅС‹Р№ Р»РёРјРёС‚ РІС…РѕРґСЏС‰РµРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ вЂ” 32 РљР‘. SaveLibraryItemState С€Р»С‘С‚ РїРѕР»РЅС‹Р№ Yjs-СЃРЅР°РїС€РѕС‚
    // СЃРѕСЃС‚РѕСЏРЅРёСЏ (encodeStateAsUpdate), РєРѕС‚РѕСЂС‹Р№ РЅР° РґРѕСЃРєРµ СЃ РЅРµСЃРєРѕР»СЊРєРёРјРё С„РёРіСѓСЂР°РјРё Р»РµРіРєРѕ РїСЂРµРІС‹С€Р°РµС‚
    // 32 РљР‘; СЃРµСЂРІРµСЂ С‚РѕРіРґР° Р·Р°РєСЂС‹РІР°РµС‚ СЃРѕРµРґРёРЅРµРЅРёРµ СЃ РѕС€РёР±РєРѕР№, Р° РЅР° СЂРµРєРѕРЅРЅРµРєС‚Рµ Yjs СЂРµ-СЃРёРЅРєР°РµС‚ РІСЃС‘
    // СЂР°Р·РѕРј вЂ” РѕС‚СЃСЋРґР° РѕР±СЂС‹РІС‹ РІ РєРѕРЅСЃРѕР»Рё Рё В«РїР°С‡РєРёВ» РїСЂР°РІРѕРє Сѓ РґСЂСѓРіРёС… СѓС‡Р°СЃС‚РЅРёРєРѕРІ. РџРѕРґРЅРёРјР°РµРј Р»РёРјРёС‚.
    options.MaximumReceiveMessageSize = 20 * 1024 * 1024;
}).AddMessagePackProtocol();

// Register Controllers
builder.Services.AddControllers(options =>
{
    options.Conventions.Add(new RouteTokenTransformerConvention(new LowercaseRouteTransformer()));
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

// ReadFromJsonAsync РІ РєРѕРЅС‚СЂРѕР»Р»РµСЂР°С… РёСЃРїРѕР»СЊР·СѓРµС‚ HttpJsonOptions, Р° РЅРµ Mvc JsonOptions
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
var app = builder.Build();

if (builder.Configuration.GetValue("AutoMigrate", false)
    || app.Environment.IsEnvironment("Docker")
    || app.Environment.IsEnvironment("DockerLocal"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.WithTitle("WMess API");
    });
}
if (!app.Environment.IsEnvironment("Docker") && !app.Environment.IsEnvironment("DockerLocal"))
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

// Map Controllers
app.MapControllers();

// Map SignalR Hubs
app.MapHub<WMess.Api.Hubs.DocumentHub>("/hubs/document");
app.MapHub<WMess.Api.Hubs.BoardHub>("/hubs/board");
app.MapHub<WMess.Api.Hubs.TableHub>("/hubs/table");
app.MapHub<WMess.Api.Hubs.LibraryHub>("/hubs/library");
app.MapHub<WMess.Api.Hubs.ChatHub>("/hubs/chat");
app.MapHub<WMess.Api.Hubs.TasksHub>("/hubs/tasks");
app.MapHub<WMess.Api.Hubs.CalendarHub>("/hubs/calendar");
app.Run();