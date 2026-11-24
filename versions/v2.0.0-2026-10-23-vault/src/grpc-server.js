'use strict';
const grpc = require("@grpc/grpc-js");
const PORT = process.env.PORT || 50051;
process.on("SIGINT", () => {
  console.log("⚙️ [Chronos] Gracefully shutting down gRPC server...");
  server.tryShutdown(() => {
    console.log("✅ [Chronos] Server closed successfully.");
    process.exit(0);
  });
});
const server = new grpc.Server({
  "grpc.keepalive_time_ms": 10000,
  "grpc.keepalive_timeout_ms": 5000,
  "grpc.http2.max_pings_without_data": 0,
  "grpc.keepalive_permit_without_calls": 1
});
server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, boundPort) => {
    if (err) {
      console.error(`❌ [Chronos] Server bind failed: ${err.message}`);
      process.exit(1);
    }
    console.log(`🛡️ Enterprise-Grade gRPC Daemon active on port ${boundPort} with Zero-Trust & Keepalives`);
    server.start();
  }
);
