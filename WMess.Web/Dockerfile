# syntax=docker/dockerfile:1
# Сборка образа WMess.Web (BFF + SPA). Контекст сборки — корень репозитория.

# --- Этап 1: сборка клиентского SPA (Vite) ---
FROM node:22-alpine AS client
WORKDIR /repo/WMess.Client
COPY WMess.Client/package.json WMess.Client/package-lock.json ./
RUN npm ci
# OpenAPI-спека, из которой генерируются типы клиента (generate-api).
COPY WMess.Web/WMess.Web.json /repo/WMess.Web/WMess.Web.json
COPY WMess.Api/WMess.Api.json /repo/WMess.Api/WMess.Api.json
COPY WMess.Client/ ./
# build:docker = generate-api + vite build (без tsc).
RUN npm run build:docker

# --- Этап 2: сборка BFF (.NET) ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY WMess.Web/WMess.Web.csproj WMess.Web/
RUN dotnet restore WMess.Web/WMess.Web.csproj
COPY WMess.Web/ WMess.Web/
# PublishBuildSpa=false — SPA уже собран на этапе 1, не запускаем npm внутри .NET SDK.
RUN dotnet publish WMess.Web/WMess.Web.csproj -c Release -o /app/publish -p:PublishBuildSpa=false

# --- Этап 3: рантайм ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
COPY --from=client /repo/WMess.Client/dist ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "WMess.Web.dll"]
