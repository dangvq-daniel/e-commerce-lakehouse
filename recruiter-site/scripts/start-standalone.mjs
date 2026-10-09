// Container HOSTNAME identifies the machine; Render's proxy needs all interfaces.
process.env.HOSTNAME = "0.0.0.0";
await import("../.next/standalone/server.js");
