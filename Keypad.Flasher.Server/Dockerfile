# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
RUN apt-get update
RUN apt-get install curl -y
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin bash
USER $APP_UID
WORKDIR /app
COPY ["Keypad.Firmware/arduino-cli.yaml", "Keypad.Firmware/"]
RUN arduino-cli core update-index --config-file /app/Keypad.Firmware/arduino-cli.yaml
RUN arduino-cli core install CH55xDuino:mcs51 --config-file /app/Keypad.Firmware/arduino-cli.yaml
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS with-deps
RUN apt-get update
RUN apt-get install curl -y
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash
RUN apt-get -y install nodejs

FROM with-deps AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Keypad.Flasher.Server/Keypad.Flasher.Server.csproj", "Keypad.Flasher.Server/"]
COPY ["Keypad.Flasher.Client/Keypad.Flasher.Client.esproj", "Keypad.Flasher.Client/"]
RUN dotnet restore "./Keypad.Flasher.Server/Keypad.Flasher.Server.csproj"
COPY . .
WORKDIR "/src/Keypad.Flasher.Server"
RUN dotnet build "./Keypad.Flasher.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Keypad.Flasher.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
COPY ["Keypad.Firmware", "Keypad.Firmware"]
ENV Settings__FirmwarePath=/app/Keypad.Firmware
ENTRYPOINT ["dotnet", "Keypad.Flasher.Server.dll"]
