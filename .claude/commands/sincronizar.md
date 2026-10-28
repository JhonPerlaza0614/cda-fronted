---
description: Sincroniza el contexto del proyecto antes de trabajar (ramas, código y migraciones). No modifica nada.
---
Haz la rutina «Al iniciar cada sesión» de CLAUDE.md, solo en modo lectura:

1. `git status`, rama actual y `git fetch`. Dime cuántos commits me separan de `origin/develop` y si hay cambios sin guardar.
2. Lee la estructura actual del proyecto y dime qué módulos ya existen.
3. Lista las migraciones, su versión más alta y compárala con `origin/develop`.
4. Lee `docs/decisiones.md` si existe.

No cambies archivos, no hagas merge, no ejecutes la aplicación ni las pruebas. Termina con un resumen corto de lo que encontraste, lo que está desactualizado y qué me recomiendas hacer antes de continuar.
