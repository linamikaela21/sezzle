# sezzle

Calculadora de un solo display. El backend hace la aritmética; el frontend se comporta como un aparato.

## Stack

- Backend: Go, módulo `sezzle/backend`, `net/http` y `testing`. Sin frameworks.
- Frontend: Vite, React, TypeScript, Vitest, Testing Library, Tailwind, fuente Barlow, iconos `lucide-react`.
- Desarrollo: `docker-compose.yml`. Air recompila el API; Vite recarga el navegador con `server.watch.usePolling`.
- Producción: imagen multi-stage. El binario Go sirve el build estático y `/api` en el puerto 3000.

## Regla de TDD

No se escribe lógica de producción de la calculadora antes de ver los tests en rojo. El orden es una fase a la vez, y dentro del backend y del frontend los pasos en rojo (2a, 2c, 3a, 3c) van antes que su implementación. La cobertura del backend y del frontend tiene que superar el 95 %, con casos borde.

Ante cada prompt nuevo de este proyecto, actualizar [`promps.md`](promps.md) con esa orden antes de cerrar el trabajo.

## API

`POST /api/calculate`

```json
{ "operation": "add", "a": 200, "b": 20 }
```

Operaciones: `add`, `sub`, `mul`, `div`, `exp` (`a^b`), `sqrt` (solo `a`; `b` se ignora), `percent` (`a / 100`).

- Éxito: `200` y `{ "result": number }`.
- Error de dominio o de entrada: `400` y `{ "error": "..." }`.
- `operation` es string y `a` y `b` son números finitos. Los tres campos son obligatorios. Un tipo distinto, `null` o una clave de más es `400` con `{ "error": "invalid request" }`.

El porcentaje de calculadora (`200 + 10% = 220`) lo resuelve el frontend y después llama a `add`, `sub`, `mul` o `div`. El backend solo divide `a / 100`.

## Errores

Un solo display. Estados: `entering`, `operator`, `result`, `error`.

- Entrada local: el segundo punto decimal se ignora, los ceros a la izquierda se descartan salvo `0.`, hay un tope de 12 dígitos, otro operador reemplaza al pendiente, `±` cambia el signo, `⌫` borra un dígito, `C` borra el número en curso y `AC` borra todo.
- Error de matemática (división por cero, raíz de negativo, resultado no finito): el display muestra `Error`, el teclado queda mudo y solo `AC` recupera. El cliente lo detecta antes de la petición cuando puede, y un `400` del API entra en el mismo estado.
- Error de red: el display no pasa a `Error`. Debajo aparece `Sin conexión` y `=` reintenta.

## Puertos

- Desarrollo: app en `http://127.0.0.1:3000`, API en `http://127.0.0.1:8081`.
- Producción: app y API en `http://127.0.0.1:3000`.
