export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEventStream } = await import("./lib/event-stream");
    // Serve HTTP while the background producer connects or retries Supabase.
    void startEventStream();
  }
}
