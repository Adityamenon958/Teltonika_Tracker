# Teltonika-Tracker

Standalone **TCP AVL server** for Teltonika GPS devices (starting with FMB920 / Codec 8).

This app is **independent** from the IoT Dashboard. Both share the **same MongoDB Atlas** database and collections (`Devices`, `AvlRecords`), but they are separate codebases.

## Architecture (V1)

```text
TCP → Protocol → Mapper → Services → Repositories → MongoDB
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Requirements

- Node.js 20+ (LTS recommended)
- MongoDB Atlas (same DB as Dashboard)
- PM2 (production on Azure Ubuntu VM)

## Quick start (development)

```bash
# 1. Install
npm install

# 2. Configure
copy .env.example .env.development
# Edit MONGODB_URI, TCP_PORT, etc.

# 3. Paste Dashboard schemas into:
#    src/db/models/Device.js
#    src/db/models/AvlRecord.js
# Then align src/mappers/avlMapper.js field names.

# 4. Ensure the device IMEI exists in Devices (if IMEI_AUTH_MODE=strict)

# 5. Run
npm run dev

# 6. Tests (Codec 8 + IMEI)
npm test
```

## Production (PM2)

```bash
npm ci --omit=dev
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

See [docs/DEPLOYMENT-AZURE.md](docs/DEPLOYMENT-AZURE.md).

## Important placeholders

| File | Action |
|------|--------|
| `src/db/models/Device.js` | Paste **Device Schema (from Dashboard)** |
| `src/db/models/AvlRecord.js` | Paste **AvlRecord Schema (from Dashboard)** |
| `src/mappers/avlMapper.js` | Match output to Dashboard AvlRecord fields |

Do **not** redesign Dashboard schemas.

## Project layout

```text
src/tcp/           Socket handling
src/protocols/     Teltonika + Codec 8
src/mappers/       Protocol → Dashboard shape
src/services/      Auth + ingest
src/db/            Mongo connection, models, repositories
tests/unit/        Codec 8 + IMEI tests
docs/              Architecture, protocol, deploy, roadmap
```

## License

UNLICENSED / private.
