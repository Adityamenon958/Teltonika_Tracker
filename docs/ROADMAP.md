# Roadmap

V1 ships **TCP core only**. Create folders/modules below **only when implementing** that feature.

## When to introduce future folders

| Folder | Introduce when |
|--------|----------------|
| `src/api/` | REST API for devices/records |
| `src/websocket/` | Live streaming to Dashboard/clients |
| `src/cache/` | Redis caching / pub-sub |
| `src/commands/` | OTA / GPRS configuration commands |
| `src/monitoring/` | Health HTTP endpoint, connection stats API |

## Planned features (not V1)

- Additional Teltonika codecs (8 Extended, 16) under `protocols/teltonika/codecs/`
- Additional GPS protocols under `protocols/<name>/`
- Live device online/offline (builds on `ConnectionRegistry`)
- Connection statistics & logging dashboard
- Unit + integration test expansion
- Docker image + Compose
- Kubernetes deployment
- PM2 cluster / multi-VM horizontal scale
- CI (GitHub Actions lint + test)

## Implementation phases (V1) — reference

1. Scaffold + config + logger  
2. Mongo + Dashboard schemas + repositories  
3. TCP server + buffer + registry  
4. Teltonika IMEI + Codec 8 + ACK  
5. Mapper + validation + services  
6. Errors + PM2 + Azure docs  
7. Codec 8 + IMEI unit tests  
