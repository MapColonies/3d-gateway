{{/*
Copyright VMware, Inc.
SPDX-License-Identifier: APACHE-2.0
*/}}

{{/* vim: set filetype=mustache: */}}
{{/*
Renders a value that contains template perhaps with scope if the scope is present.
Usage:
{{ include "common.tplvalues.render" ( dict "value" .Values.path.to.the.Value "context" $ ) }}
{{ include "common.tplvalues.render" ( dict "value" .Values.path.to.the.Value "context" $ "scope" $app ) }}
*/}}
{{- define "common.tplvalues.render" -}}
{{- $value := typeIs "string" .value | ternary .value (.value | toYaml) }}
{{- if contains "{{" (toJson .value) }}
  {{- if .scope }}
      {{- tpl (cat "{{- with $.RelativeScope -}}" $value "{{- end }}") (merge (dict "RelativeScope" .scope) .context) }}
  {{- else }}
    {{- tpl $value .context }}
  {{- end }}
{{- else }}
    {{- $value }}
{{- end }}
{{- end -}}

{{/*
Merge a list of values that contains template after rendering them.
Merge precedence is consistent with http://masterminds.github.io/sprig/dicts.html#merge-mustmerge
Usage:
{{ include "common.tplvalues.merge" ( dict "values" (list .Values.path.to.the.Value1 .Values.path.to.the.Value2) "context" $ ) }}
*/}}
{{- define "common.tplvalues.merge" -}}
{{- $dst := dict -}}
{{- range .values -}}
{{- $dst = include "common.tplvalues.render" (dict "value" . "context" $.context "scope" $.scope) | fromYaml | merge $dst -}}
{{- end -}}
{{ $dst | toYaml }}
{{- end -}}
{{/*
End of usage example
*/}}

{{/*
Common definitions
*/}}
{{- define "merged.ca" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ca .Values.global.ca ) "context" . ) }}
{{- end -}}

{{- define "merged.podAnnotations" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.podAnnotations .Values.global.podAnnotations ) "context" . ) }}
{{- end -}}

{{- define "merged.extraVolumes" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.extraVolumes .Values.global.extraVolumes ) "context" . ) }}
{{- end -}}

{{- define "merged.sidecars" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.sidecars .Values.global.sidecars ) "context" . ) }}
{{- end -}}

{{- define "merged.extraVolumeMounts" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.extraVolumeMounts .Values.global.extraVolumeMounts ) "context" . ) }}
{{- end -}}

{{- define "merged.metrics" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.env.metrics .Values.global.metrics ) "context" . ) }}
{{- end -}}

{{- define "merged.tracing" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.env.tracing .Values.global.tracing ) "context" . ) }}
{{- end -}}

{{/*
Custom definitions
*/}}
{{- define "merged.providers" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.providers .Values.global.providers ) "context" . ) }}
{{- end -}}

{{- define "merged.NFS" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.NFS .Values.global.NFS ) "context" . ) }}
{{- end -}}

{{- define "merged.S3" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.S3 .Values.global.S3 ) "context" . ) }}
{{- end -}}
