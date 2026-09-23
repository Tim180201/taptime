import Darwin
import ExpoModulesCore
import Foundation

public class TapTimeMonotonicClockModule: Module {
  private let sampleLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("TapTimeMonotonicClock")
    Function("sample") { () throws -> [String: Any] in
      self.sampleLock.lock()
      defer { self.sampleLock.unlock() }

      let store = try self.stateURL()
      let previous: IosClockState?
      if FileManager.default.fileExists(atPath: store.path) {
        // Unreadable storage fails closed; malformed state starts a new proof generation.
        let data = try Data(contentsOf: store)
        previous = try? JSONDecoder().decode(IosClockState.self, from: data)
      } else {
        previous = nil
      }

      let bootTime = try self.bootTimeMilliseconds()
      var timebase = mach_timebase_info_data_t()
      guard mach_timebase_info(&timebase) == KERN_SUCCESS, timebase.denom != 0 else {
        throw ClockUnavailable()
      }
      // All readings occur in this synchronous critical section. Sampling boot time again
      // rejects a calendar adjustment that occurred during the paired clock readings.
      let continuous = Double(mach_continuous_time()) * Double(timebase.numer)
        / Double(timebase.denom) / 1_000_000
      let wall = Date().timeIntervalSince1970 * 1_000
      guard continuous.isFinite, wall.isFinite, continuous >= 0, wall >= 0,
            continuous <= 9_007_199_254_740_991, wall <= 9_007_199_254_740_991,
            bootTime == (try self.bootTimeMilliseconds()) else { throw ClockUnavailable() }
      let next = IosClockState.next(previous: previous, bootTimeMilliseconds: bootTime,
        continuousMilliseconds: Int64(continuous.rounded(.down)))
      try JSONEncoder().encode(next).write(to: store, options: [.atomic, .completeFileProtection])

      // The origin is the first native sample in this generation, NOT device boot time.
      // Anchor/delta sent by the unchanged offline contract are app-event intervals (35F9.1).
      return ["bootMarker": next.bootMarker,
              "elapsedRealtimeMilliseconds": Double(next.elapsedMilliseconds),
              "wallClockMilliseconds": floor(wall)]
    }
  }

  private func bootTimeMilliseconds() throws -> Int64 {
    var boot = timeval()
    var size = MemoryLayout<timeval>.size
    guard sysctlbyname("kern.boottime", &boot, &size, nil, 0) == 0,
          size == MemoryLayout<timeval>.size, boot.tv_sec >= 0,
          boot.tv_usec >= 0, boot.tv_usec < 1_000_000 else { throw ClockUnavailable() }
    return Int64(boot.tv_sec) * 1_000 + Int64(boot.tv_usec) / 1_000
  }

  private func stateURL() throws -> URL {
    var directory = try FileManager.default.url(for: .applicationSupportDirectory,
      in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("TapTimeMonotonicClock", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
    return directory.appendingPathComponent("state.json")
  }
}

private struct ClockUnavailable: Error {}
