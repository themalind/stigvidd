import ExpoModulesCore
import CoreLocation

// Isolates the iOS 18+ Core Location APIs (`CLLocationUpdate.liveUpdates` +
// `CLBackgroundActivitySession`) so the surrounding module still compiles and runs
// on older iOS, where these types don't exist. The background activity session is
// what keeps the app receiving location while backgrounded/pocketed — behaviour the
// classic continuous-updates API used by expo-location cannot deliver reliably.
@available(iOS 18.0, *)
final class LiveLocationEngine {
  private var session: CLBackgroundActivitySession?
  private var task: Task<Void, Never>?
  private let onFix: (CLLocation) -> Void

  init(onFix: @escaping (CLLocation) -> Void) {
    self.onFix = onFix
  }

  func start() {
    guard task == nil else { return }
    // The session MUST be created before liveUpdates() begins and held for the
    // whole recording: releasing it invalidates the background grant, so iOS stops
    // delivering updates the moment the app leaves the foreground.
    session = CLBackgroundActivitySession()
    task = Task { [weak self] in
      do {
        for try await update in CLLocationUpdate.liveUpdates(.fitness) {
          if Task.isCancelled { break }
          if let location = update.location {
            self?.onFix(location)
          }
        }
      } catch {
        // The stream ended or errored (e.g. authorization revoked). A fresh
        // start() re-establishes it; nothing to recover here.
      }
    }
  }

  func stop() {
    task?.cancel()
    task = nil
    session?.invalidate()
    session = nil
  }
}

public final class ExpoLiveLocationModule: Module {
  // Raw fixes buffered natively so they survive JS being suspended in the
  // background. JS drains them and runs each through its own evaluatePoint filter,
  // so there is a single source of truth for what becomes a recorded point and the
  // Android/iOS pipelines stay identical.
  private var buffer: [[String: Any]] = []
  private let bufferQueue = DispatchQueue(label: "com.stigvidd.livelocation.buffer")
  // The disk copy exists only to recover fixes if the process is killed; the
  // in-memory buffer is the live record and JS drains it every couple of seconds.
  // Rewriting the whole file on every fix (~1/s) is wasteful, so writes are
  // throttled to this interval — a kill loses at most this many seconds of fixes.
  private var lastPersist = Date.distantPast
  private let persistInterval: TimeInterval = 5
  // Typed as Any? so the property itself needs no availability annotation; it is
  // cast to LiveLocationEngine behind an #available check before use.
  private var engine: Any?

  private var storeURL: URL {
    let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return dir.appendingPathComponent("stigvidd-live-fixes.json")
  }

  public func definition() -> ModuleDefinition {
    Name("ExpoLiveLocation")

    Events("onLocation")

    OnCreate {
      // Recover any fixes persisted before a previous termination so a killed
      // recording can still be stitched back together after the app relaunches.
      self.loadBuffer()
    }

    // True only where the modern, background-capable API is available and reliable
    // (iOS 18+). Callers fall back to the expo-location pipeline otherwise.
    Function("isAvailable") { () -> Bool in
      if #available(iOS 18.0, *) { return true }
      return false
    }

    AsyncFunction("start") {
      if #available(iOS 18.0, *) {
        guard self.engine == nil else { return }
        let engine = LiveLocationEngine { [weak self] location in
          self?.handleFix(location)
        }
        self.engine = engine
        engine.start()
      }
    }

    AsyncFunction("stop") {
      if #available(iOS 18.0, *) {
        (self.engine as? LiveLocationEngine)?.stop()
        self.engine = nil
      }
    }

    // Returns every buffered fix and clears the buffer (and its disk copy) so each
    // fix is ingested exactly once by JS.
    AsyncFunction("drain") { () -> [[String: Any]] in
      return self.drainBuffer()
    }
  }

  private func handleFix(_ location: CLLocation) {
    let fix: [String: Any] = [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000.0,
    ]
    bufferQueue.sync {
      buffer.append(fix)
      // Throttled: persist only once the interval has elapsed since the last write.
      let now = Date()
      if now.timeIntervalSince(lastPersist) >= persistInterval {
        persist()
        lastPersist = now
      }
    }
    // Live tail for the foreground map. Dropped harmlessly when no JS listener is
    // attached (app backgrounded); the buffered copy is the durable record.
    sendEvent("onLocation", fix)
  }

  private func drainBuffer() -> [[String: Any]] {
    var drained: [[String: Any]] = []
    bufferQueue.sync {
      drained = buffer
      buffer = []
      // Force a write so the cleared buffer is durable immediately, bypassing the
      // throttle — otherwise a kill right after a drain could recover already-drained
      // fixes and double-count them.
      persist()
      lastPersist = Date()
    }
    return drained
  }

  // Persists the current buffer to disk. Must be called on bufferQueue.
  private func persist() {
    do {
      let data = try JSONSerialization.data(withJSONObject: buffer)
      try data.write(to: storeURL, options: .atomic)
    } catch {
      // Best-effort durability; the in-memory buffer still backs the live session.
    }
  }

  private func loadBuffer() {
    bufferQueue.sync {
      guard let data = try? Data(contentsOf: storeURL),
            let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
      else {
        return
      }
      buffer = parsed
    }
  }
}
