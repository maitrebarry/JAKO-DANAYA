# Backend Dockerfile (multi-stage)
# Build with Maven (Java 21) then copy the jar into a small runtime image

FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /build
COPY backend/pom.xml backend/
COPY backend/src backend/src

# Build the project
RUN mvn -f backend/pom.xml -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
# Adjust the path if your artifact name differs
COPY --from=build /build/backend/target/backend-0.0.1-SNAPSHOT.jar /app/app.jar
EXPOSE 8085
ENTRYPOINT ["java","-jar","/app/app.jar"]