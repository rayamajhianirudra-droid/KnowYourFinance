# ---------- Stage 1: build the jar ----------
# This stage has Maven and the full JDK. None of it ends up in the final
# image, so the image people run stays small.
FROM maven:3.9-eclipse-temurin-26 AS build
WORKDIR /build

# Copy only pom.xml first and download the dependencies. Docker caches
# each step, so as long as pom.xml has not changed this slow download is
# skipped on every later build, even when the Java code changes.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Tests run in CI. Skipping them here keeps image builds fast and avoids
# needing Docker inside Docker for the integration test.
RUN mvn -B -q package -DskipTests

# ---------- Stage 2: run it ----------
# A JRE is enough to run the app. No compiler, no Maven.
FROM eclipse-temurin:21-jre
WORKDIR /app

# Run as an ordinary user instead of root, so a bug in the app cannot
# touch the rest of the container.
RUN useradd --system --uid 1001 kyf
COPY --from=build /build/target/*.jar app.jar
USER kyf

EXPOSE 8080

# MaxRAMPercentage lets the JVM size its memory from the container limit
# instead of the whole host, which avoids surprise out-of-memory kills.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC"

# Docker marks the container unhealthy if the API stops answering.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
