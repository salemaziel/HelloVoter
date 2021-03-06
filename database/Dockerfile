FROM node:erbium as build

RUN curl -Lo /opt/jmxterm.jar https://github.com/jiaqi/jmxterm/releases/download/v1.0.1/jmxterm-1.0.1-uber.jar \
  && mkdir -p /plugins \
  && curl -Lo /plugins/spatial.jar https://github.com/neo4j-contrib/spatial/releases/download/0.26.2-neo4j-3.5.2/neo4j-spatial-0.26.2-neo4j-3.5.2-server-plugin.jar \
  && curl -Lo /plugins/apoc.jar https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/3.5.0.11/apoc-3.5.0.11-all.jar \
  && chmod 644 /opt/*jar /plugins/*jar

FROM neo4j:3.5

RUN mkdir -p /jmx /plugins /opt \
  && echo "monitor readonly" > /jmx/access \
  && echo "monitor Neo4j" > /jmx/password \
  && chown neo4j:neo4j /jmx/* \
  && chmod 400 /jmx/*

COPY --from=build /opt/*jar /opt/
COPY --from=build /plugins/*jar /plugins/

EXPOSE 9999

ENV NEO4J_apoc_export_file_enabled=true
ENV NEO4J_dbms_security_procedures_unrestricted=apoc.*
ENV NEO4J_dbms_tx__log_rotation_retention__policy=false
ENV NEO4J_dbms_tx__log_rotation_size=1m
ENV NEO4J_dbms_jvm_additional="-Dcom.sun.management.jmxremote.authenticate=true -Dcom.sun.management.jmxremote.ssl=false -Dcom.sun.management.jmxremote.password.file=/jmx/password -Dcom.sun.management.jmxremote.access.file=/jmx/access -Dcom.sun.management.jmxremote.port=9999"
