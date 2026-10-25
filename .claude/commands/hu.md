---
description: Prepara el trabajo de una HU (uso: /hu HU-002). Lee la HU, resume criterios y propone un plan; no escribe código.
argument-hint: HU-0xx
---
Trabajaremos la historia $ARGUMENTS.

1. Haz primero la sincronización resumida de CLAUDE.md (rama, atraso respecto a `origin/develop`, migraciones). Si estoy atrasado o hay migraciones que no tengo, dímelo y espera.
2. Lee solo esa HU en `docs/Roses_corp_HU.csv`. Si no existe, avísame.
3. Muéstrame: la historia, los criterios como lista de verificación, las dependencias con otras HU y las dudas o contradicciones (revisa «Inconsistencias conocidas»).
4. Propón un plan separado en backend y frontend, con el contrato de la API. Indica si requiere cambios en la base de datos; si los requiere, no los hagas y dímelo para pasar por la regla de migraciones.
5. Espera mi aprobación antes de escribir código.
