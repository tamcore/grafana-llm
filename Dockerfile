FROM grafana/grafana:11.4.0

COPY dist/ /var/lib/grafana/plugins/tamcore-llmanalysis-app/
