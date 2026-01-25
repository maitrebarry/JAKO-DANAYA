# ===============================
# Backend Dockerfile (Spring Boot)
# Java 21 – Multi-stage
# ===============================

# -------- BUILD STAGE --------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /build

# Copier tous les fichiers
COPY . .

# Build du JAR (supprime "backend/" du chemin)
RUN mvn -B -DskipTests package

# -------- RUNTIME STAGE --------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copier le jar généré (vérifie le nom exact)
COPY --from=build /build/target/backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8085
ENTRYPOINT ["java","-jar","/app/app.jar"]