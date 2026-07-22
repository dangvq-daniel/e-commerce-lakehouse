export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEventStream } = await import("./lib/event-stream");
    await startEventStream();
  }
}
