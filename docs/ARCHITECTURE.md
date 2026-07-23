# Architecture (V1)

## Layers

```text
TCP
  → Protocol (Teltonika / Codec 8)
    → Mapper (avlMapper)
      → Services (auth, ingest)
        → Repositories
          → MongoDB Atlas
```

## Rules

1. **Decoder** never knows MongoDB.
2. **Models** never know Teltonika packets.
3. **Mapper** translates between them.
4. **Services** never call `Model.find()` / `create()` / `insertMany()` — only repositories.
5. **Dashboard schemas** are copied as-is — never redesigned.
6. **ACK** only after successful Mongo insert.

## Connection state machine

```text
WAIT_IMEI → AUTHED → RECEIVING_AVL
     ↓ reject / error
   CLOSED
```

## Key modules

| Path | Role |
|------|------|
| `src/tcp/` | `net` server, buffer, registry, handler |
| `src/protocols/teltonika/` | IMEI, frames, CRC, Codec 8, ACK |
| `src/mappers/avlMapper.js` | Codec objects → AvlRecord shape |
| `src/services/` | Auth + ingest orchestration |
| `src/db/` | Connection, models, repositories |

## Future features

Documented in [ROADMAP.md](./ROADMAP.md). Do not create empty folders until implementing them.
