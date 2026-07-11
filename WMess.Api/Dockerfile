# syntax=docker/dockerfile:1
# Сборка образа WMess.Api. Контекст сборки — корень репозитория.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY WMess.Api/WMess.Api.csproj WMess.Api/
RUN dotnet restore WMess.Api/WMess.Api.csproj
COPY WMess.Api/ WMess.Api/
RUN dotnet publish WMess.Api/WMess.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
# Вложения чата хранятся на диске (ContentRootPath/uploads) — монтируется volume'ом.
RUN mkdir -p /app/uploads
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "WMess.Api.dll"]
