# sezzle

Calculadora de un solo display. El backend en Go resuelve la aritmética y el frontend en React se comporta como un aparato: un error de matemática deja el display en `Error`, y un fallo de red no se confunde con eso.

## Desarrollo

Desde la raíz del repo, con Docker:

```bash
docker compose up --build
```

- App (frontend): `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8081`

Ese proceso sigue en primer plano. Al editar `.tsx` o `.css` el navegador se actualiza solo (Vite, con `server.watch.usePolling` porque el bind mount de Docker no avisa bien los cambios). Al editar `.go`, Air recompila el API.

```bash
docker compose logs -f
docker compose down
```

Si solo cambian dependencias (`go.mod` o `package.json`), hace falta otro `docker compose up --build`. Un cambio de código de la calculadora no exige reconstruir la imagen.

### Tests

Con los contenedores de desarrollo en marcha:

La cobertura del backend y del frontend tiene que superar el 95 %, con casos borde (división por cero, raíz negativa, overflow, JSON inválido, tope de 12 dígitos, porcentaje y fallo de red).

```bash
docker compose exec backend go test ./... -cover
docker compose exec frontend npm test -- --coverage
```

Sin Docker, desde cada carpeta:

```bash
go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out
npm test -- --coverage
```

## API

`POST /api/calculate`

```json
{ "operation": "add", "a": 200, "b": 20 }
```

Operaciones: `add`, `sub`, `mul`, `div`, `exp` (`a^b`), `sqrt` (solo `a`; `b` se ignora), `percent` (`a / 100`).

El cuerpo tiene que ser exactamente esos tres campos, con estos tipos:

| Campo | Tipo JSON | Notas |
| --- | --- | --- |
| `operation` | string | Una de las operaciones de arriba |
| `a` | number | Finito. Obligatorio también en `sqrt` y `percent` |
| `b` | number | Finito. Obligatorio; `sqrt` y `percent` lo ignoran |

Un campo ausente, `null`, un string en `a` o `b`, un número en `operation` o una clave de más responden `400` y `{ "error": "invalid request" }`. `NaN` e `Infinity` no son JSON válido; el cliente tampoco los envía.

- Éxito: `200` y `{ "result": number }`.
- Error de dominio o de entrada: `400` y `{ "error": "..." }`.

`GET /health` responde `{ "status": "ok" }`.

### Ejemplos curl

Desarrollo (API en el puerto 8081):

```bash
curl -s -X POST http://127.0.0.1:8081/api/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","a":200,"b":20}'

curl -s -X POST http://127.0.0.1:8081/api/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"sqrt","a":9,"b":0}'

curl -s -X POST http://127.0.0.1:8081/api/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"percent","a":50,"b":0}'

curl -s -X POST http://127.0.0.1:8081/api/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"div","a":1,"b":0}'
```

La división por cero responde `400` y `{ "error": "division by zero" }`.

## Producción

Imagen única multi-stage, sin recarga en vivo. El binario Go sirve el build estático del frontend y el API bajo `/api`, en el puerto 3000.

```bash
docker compose -f docker-compose.prod.yml up --build
```

App y API: `http://127.0.0.1:3000`

```bash
curl -s -X POST http://127.0.0.1:3000/api/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"mul","a":6,"b":7}'
```

## Design Decisions

- **Un display, no un formulario.** La entrada vive en el cliente (`entering`, `operator`, `result`, `error`). El segundo punto se ignora, los ceros a la izquierda se descartan salvo `0.`, hay un tope de 12 dígitos, otro operador reemplaza al pendiente, y `AC` es la única salida de `Error`.
- **El porcentaje de calculadora no es `a / 100`.** `50%` sí llama a `percent`. `200 + 10%` llama a `add(200, 20)`; con `×` o `÷` (y también `xʸ`) el segundo número pasa a fracción (`0.1`) y después se llama a la operación binaria. El backend solo implementa `a / 100`.
- **Dos fallos distintos.** División por cero, raíz de negativo o resultado no finito muestran `Error` y enmudecen el teclado. El cliente lo detecta antes de la petición cuando puede, y un `400` entra en el mismo estado. Si la red falla, el display no cambia: debajo aparece `Sin conexión` y `=` reintenta la misma petición.
- **Dos procesos en desarrollo, uno en producción.** Vite en el puerto 3000 y Air en el 8081 permiten ver un cambio de código sin reconstruir la imagen. En producción el mismo origen sirve la UI y `/api`, así que el frontend llama a `/api/calculate` sin una URL absoluta.
- **Librería estándar en Go.** `net/http` y `testing`, sin frameworks. La cobertura se mira con `go test ./... -cover`.
