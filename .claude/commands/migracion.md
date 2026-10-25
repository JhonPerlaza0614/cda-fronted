---
description: Propone una migración de base de datos y espera aprobación (uso: /migracion descripción del cambio).
argument-hint: descripción del cambio
---
Necesito este cambio de datos (la base la gobierna el backend, no hagas cambios aquí): $ARGUMENTS

Aplica la sección «Sincronización y migraciones» de CLAUDE.md:

1. Haz la sincronización (ramas y migraciones en mi rama y en `origin/develop`).
2. Muéstrame la propuesta completa: qué cambia y por qué (con la HU), el SQL en PostgreSQL 17, el número de versión, a qué base se aplicaría, el impacto y cómo se deshace.
3. **No crees el archivo de migración, no ejecutes nada contra ninguna base y no arranques la aplicación ni las pruebas.** Deja el SQL solo en tu respuesta.
4. Espera mi respuesta. Solo si digo «sí, crea la migración» la creas, y solo si luego digo «prueba» la pruebas, contra una base local.
