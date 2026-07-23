# Teltonika Protocol Notes (V1)

## IMEI login

1. Device opens TCP connection.
2. Device sends: `uint16 BE length` + IMEI ASCII (usually 15 digits).
3. Server responds with **1 byte**:
   - `0x01` = accept
   - `0x00` = reject
4. On reject, server closes the socket.

## AVL data packet (Codec 8)

```text
preamble (4) = 0x00000000
dataFieldLength (4) BE
dataField (N):
  codecId (1) = 0x08
  numberOfData1 (1)
  AVL records...
  numberOfData2 (1)  // must equal numberOfData1
crc (4) BE           // CRC-16/IBM of dataField only (stored in 4 bytes)
```

### Each AVL record (Codec 8)

- Timestamp: 8 bytes (ms since Unix epoch)
- Priority: 1 byte
- Longitude / Latitude: int32 / 10_000_000 → degrees
- Altitude: int16
- Angle: uint16
- Satellites: uint8
- Speed: uint16 (km/h)
- Event IO ID + IO element lists (1/2/4/8-byte)

## ACK

After successful DB insert, server sends **4-byte BE** integer = number of records stored.

If insert fails: **no ACK** (device retries).

## Device config (FMB920)

Set GPRS server host/IP to your Azure VM public IP/DNS and TCP port (`TCP_PORT`, default `5027`).
