# ===============================
# Backend Dockerfile (Spring Boot)
# Java 21 – Multi-stage
# ===============================

# -------- BUILD STAGE --------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /build

# Copier les fichiers backend
COPY backend/pom.xml backend/pom.xml
COPY backend/src backend/src

# Build du JAR
RUN mvn -f backend/pom.xml -B -DskipTests package

# -------- RUNTIME STAGE --------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copier le jar généré
COPY --from=build /build/backend/target/backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8085
ENTRYPOINT ["java","-jar","/app/app.jar"]
