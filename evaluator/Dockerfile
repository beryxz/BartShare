# ---------- Stage 1: build ----------
# Reactor build: aggregator POM resolves the bart -> bart-parser -> bart-wrapper
# SNAPSHOT chain internally, so no artifact needs to be pre-installed in ~/.m2.
FROM maven:3.9-amazoncorretto-25 AS build

WORKDIR /build

# The whole evaluator stack: aggregator pom.xml + the modules
COPY . .

# Build only bart-wrapper and its reactor dependencies (bart, bart-parser).
# The BuildKit cache mount keeps ~/.m2 warm across image builds.
RUN --mount=type=cache,target=/root/.m2 \
    mvn -pl bart-wrapper -am -B clean package

# Split the fat jar so dependencies and application code cache as separate layers.
RUN cp bart-wrapper/target/*.jar app.jar && \
    java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

# ---------- Stage 2: runtime ----------
FROM amazoncorretto:25-headless

WORKDIR /app

# Ordered least- to most-volatile; each layer overlays into /app.
COPY --from=build --chown=1000:1000 /build/extracted/dependencies/ ./
COPY --from=build --chown=1000:1000 /build/extracted/spring-boot-loader/ ./
COPY --from=build --chown=1000:1000 /build/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=1000:1000 /build/extracted/application/ ./

# uid 1000 has no /etc/passwd entry; the JVM does not need one.
USER 1000:1000

EXPOSE 8080

ENTRYPOINT ["java", "-cp", ".", "org.springframework.boot.loader.launch.JarLauncher"]
