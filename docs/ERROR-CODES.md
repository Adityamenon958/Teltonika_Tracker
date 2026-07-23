# Error Codes

Stable `code` values used by `AppError` / `ProtocolError`.

| Code | Meaning | Typical action |
|------|---------|----------------|
| `CONFIG_INVALID` | Bad/missing env at boot | Process exits |
| `AUTH_REJECTED` | Invalid or unauthorized IMEI | Login `0x00` + close |
| `PROTOCOL_ERROR` | Malformed packet / CRC / framing | Close, no ACK |
| `UNSUPPORTED_CODEC` | Codec ID not registered | Close, no ACK |
| `VALIDATION_FAILED` | Mapped record failed validation | Close, no ACK |
| `DB_ERROR` | Mongo read/write failure | Close, no ACK (retry) |
| `BUFFER_OVERFLOW` | Per-socket buffer exceeded | Close |
| `INTERNAL` | Unexpected operational error | Close |

Operational errors are caught per connection so one bad device does not crash the process.  
`unhandledRejection` / `uncaughtException` still exit so PM2 can restart.
