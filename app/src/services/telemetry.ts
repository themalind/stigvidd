import { logger, setLogSink, startLogLifecycle, LogRecord } from "./logger";

/**
 * Telemetry bootstrap: one call, safe to make unconditionally.
 *
 * Every piece inside no-ops when its `EXPO_PUBLIC_OO_*` variables are absent, so local
 * development, Jest and CI are unaffected — nothing is buffered and no network call is made.
 *
 * Called at module scope from app/_layout.tsx rather than in an effect, because RootLayout
 * returns null until fonts and the session have resolved; an effect would miss startup errors
 * entirely, which are exactly the ones worth having.
 */

const LOGS_URL = process.env.EXPO_PUBLIC_OO_LOGS_URL;
const LOGS_TOKEN = process.env.EXPO_PUBLIC_OO_LOGS_TOKEN;

let initialised = false;

/**
 * Ships batches to OpenObserve's bulk JSON ingest: POST /api/<org>/<stream>/_json with a JSON
 * array body.
 *
 * NOTE ON THE CREDENTIAL: anything in an EXPO_PUBLIC_* var is inlined into the JS bundle by
 * Metro and is trivially extractable from an installed APK or IPA. OpenObserve's `_json`
 * endpoint takes HTTP Basic — i.e. a real account — so the value here MUST be an ingest-only
 * account scoped to this one stream, treated as public, and rotatable. It must never be the
 * root account, which can read every stream including the backend's.
 */
function createHttpSink(url: string, token: string) {
  return async (records: LogRecord[]) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${token}`,
      },
      body: JSON.stringify(
        records.map((record) => ({
          _timestamp: new Date(record.timestamp).getTime() * 1000, // OpenObserve wants microseconds
          level: record.level,
          message: record.message,
          ...record.context,
        })),
      ),
    });

    if (!response.ok) {
      throw new Error(`log shipping failed: HTTP ${response.status}`);
    }
  };
}

/**
 * Installs the global JS error and unhandled-rejection handlers.
 *
 * Both CHAIN rather than replace: whatever handler is already installed (React Native's red
 * box, and the RUM SDK's own once it is added) still runs after ours. Replacing them would
 * silently disable crash reporting to gain logging, which is a bad trade.
 */
function installGlobalErrorHandlers(): void {
  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logger.error("Unhandled JS error", {
      name: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      isFatal,
    });

    previousHandler?.(error, isFatal);
  });

  // Promise rejections never reach ErrorUtils. React Native bundles a tracker for exactly
  // this; there are no types for it, hence the require.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rejectionTracking = require("promise/setimmediate/rejection-tracking");

  rejectionTracking.enable({
    allRejections: true,
    onUnhandled: (id: number, error: unknown) => {
      const rejection = error instanceof Error ? error : new Error(String(error));

      logger.error("Unhandled promise rejection", {
        rejectionId: id,
        errorMessage: rejection.message,
        stack: rejection.stack,
      });
    },
    onHandled: () => {
      // A rejection handled late is not an incident — deliberately silent.
    },
  });
}

export function initTelemetry(): void {
  if (initialised) return;

  initialised = true;

  if (LOGS_URL && LOGS_TOKEN) {
    setLogSink(createHttpSink(LOGS_URL, LOGS_TOKEN));
    startLogLifecycle();
  }

  installGlobalErrorHandlers();
}
