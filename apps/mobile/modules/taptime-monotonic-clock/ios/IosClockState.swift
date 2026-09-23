import Foundation

/// D-082. Raw boot/continuous times stay native; JS receives only app-event intervals.
struct IosClockState: Codable {
  let bootMarker: String
  let bootTimeMilliseconds: Int64
  let originContinuousMilliseconds: Int64
  let lastContinuousMilliseconds: Int64

  var elapsedMilliseconds: Int64 { lastContinuousMilliseconds - originContinuousMilliseconds }

  private var isValid: Bool {
    !bootMarker.isEmpty && bootMarker.utf8.count <= 256
      && bootTimeMilliseconds >= 0 && bootTimeMilliseconds <= 9_007_199_254_740_991
      && originContinuousMilliseconds >= 0
      && lastContinuousMilliseconds >= originContinuousMilliseconds
      && lastContinuousMilliseconds <= 9_007_199_254_740_991
  }

  static func next(previous: IosClockState?, bootTimeMilliseconds: Int64,
                   continuousMilliseconds: Int64,
                   newMarker: () -> String = { UUID().uuidString }) -> IosClockState {
    if let previous, previous.isValid, previous.lastContinuousMilliseconds > 0 {
      // Strictly below the last RAW uptime, including immediately after device startup.
      let tolerance = min(Int64(120_000), previous.lastContinuousMilliseconds - 1)
      if abs(bootTimeMilliseconds - previous.bootTimeMilliseconds) <= tolerance
          && continuousMilliseconds >= previous.lastContinuousMilliseconds {
        return IosClockState(bootMarker: previous.bootMarker,
          bootTimeMilliseconds: previous.bootTimeMilliseconds,
          originContinuousMilliseconds: previous.originContinuousMilliseconds,
          lastContinuousMilliseconds: continuousMilliseconds)
      }
    }
    return IosClockState(bootMarker: newMarker(), bootTimeMilliseconds: bootTimeMilliseconds,
      originContinuousMilliseconds: continuousMilliseconds,
      lastContinuousMilliseconds: continuousMilliseconds)
  }
}
