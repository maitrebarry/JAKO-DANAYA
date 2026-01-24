# ===============================
# Backend Dockerfile (Spring Boot)
# Multi-stage build – Java 21
# ===============================

# -------- BUILD STAGE --------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /build

# Copier uniquement ce qui est nécessaire
COPY pom.xml .
COPY src ./src

# Build du JAR
RUN mvn -B -DskipTests package

# -------- RUNTIME STAGE --------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copier le jar généré
COPY --from=build /build/target/backend-0.0.1-SNAPSHOT.jar app.jar

# Port exposé (Render utilisera $PORT)
EXPOSE 8085

# Démarrage
ENTRYPOINT ["java","-jar","/app/app.jar"]
