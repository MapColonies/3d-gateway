{{/*
Expand the name of the chart.
*/}}
{{- define "gateway.name" -}}
{{- default .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "gateway.fullname" -}}
{{- $name := default .Chart.Name }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "gateway.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "gateway.labels" -}}
helm.sh/chart: {{ include "gateway.chart" . }}
{{ include "gateway.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "gateway.selectorLabels" -}}
app.kubernetes.io/name: {{ include "gateway.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Returns the environment from the chart's values if exists or from global, defaults to development
*/}}
{{- define "gateway.environment" -}}
{{- if .Values.environment }}
    {{- .Values.environment -}}
{{- else -}}
    {{- .Values.global.environment | default "development" -}}
{{- end -}}
{{- end -}}

{{/*
Returns the cloud provider name from the chart's values if exists or from global, defaults to minikube
*/}}
{{- define "gateway.cloudProviderFlavor" -}}
{{- if .Values.cloudProvider.flavor }}
    {{- .Values.cloudProvider.flavor -}}
{{- else -}}
    {{- .Values.global.cloudProvider.flavor | default "minikube" -}}
{{- end -}}
{{- end -}}

{{/*
Returns the tag of the chart.
*/}}
{{- define "gateway.tag" -}}
{{- default (printf "v%s" .Chart.AppVersion) .Values.image.tag }}
{{- end }}

{{/*
Returns the cloud provider docker registry url from the chart's values if exists or from global
*/}}
{{- define "gateway.cloudProviderDockerRegistryUrl" -}}
{{- if .Values.cloudProvider.dockerRegistryUrl }}
    {{- printf "%s/" .Values.cloudProvider.dockerRegistryUrl -}}
{{- else -}}
    {{- printf "%s/" .Values.global.cloudProvider.dockerRegistryUrl -}}
{{- end -}}
{{- end -}}

{{/*
Returns the cloud provider image pull secret name from the chart's values if exists or from global
*/}}
{{- define "gateway.cloudProviderImagePullSecretName" -}}
{{- if .Values.cloudProvider.imagePullSecretName }}
    {{- .Values.cloudProvider.imagePullSecretName -}}
{{- else if .Values.global.cloudProvider.imagePullSecretName -}}
    {{- .Values.global.cloudProvider.imagePullSecretName -}}
{{- end -}}
{{- end -}}
