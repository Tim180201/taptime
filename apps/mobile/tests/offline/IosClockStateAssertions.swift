func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fatalError(message) }
}

let initial = IosClockState.next(previous: nil, bootTimeMilliseconds: 1_000_000,
  continuousMilliseconds: 600_000, newMarker: { "first" })
check(initial.bootMarker == "first", "first sample creates marker")
check(initial.elapsedMilliseconds == 0, "raw device uptime must stay native")
let disk = try JSONEncoder().encode(initial)
let restored = try JSONDecoder().decode(IosClockState.self, from: disk)
let restarted = IosClockState.next(previous: restored, bootTimeMilliseconds: 1_000_000,
  continuousMilliseconds: 620_000, newMarker: { "unexpected" })
check(restarted.bootMarker == "first", "app restart retains marker")
check(restarted.elapsedMilliseconds == 20_000, "reported value is an interval between app samples")

let asleep = IosClockState.next(previous: restarted, bootTimeMilliseconds: 1_000_000,
  continuousMilliseconds: 3_620_000, newMarker: { "unexpected" })
check(asleep.elapsedMilliseconds == 3_020_000, "continuous clock includes sleep")
let correction = IosClockState.next(previous: initial, bootTimeMilliseconds: 1_060_000,
  continuousMilliseconds: 610_000, newMarker: { "unexpected" })
check(correction.bootMarker == "first", "small time correction retained")
let boundary = IosClockState.next(previous: initial, bootTimeMilliseconds: 1_120_000,
  continuousMilliseconds: 610_000, newMarker: { "unexpected" })
check(boundary.bootMarker == "first", "inclusive maximum tolerance")
let shifted = IosClockState.next(previous: initial, bootTimeMilliseconds: 1_120_001,
  continuousMilliseconds: 610_000, newMarker: { "changed" })
check(shifted.bootMarker == "changed", "large calendar correction rotates marker")
let backwards = IosClockState.next(previous: initial, bootTimeMilliseconds: 1_000_000,
  continuousMilliseconds: 599_999, newMarker: { "backwards" })
check(backwards.bootMarker == "backwards", "counter rollback rotates marker")
let reboot = IosClockState.next(previous: initial, bootTimeMilliseconds: 2_000_000,
  continuousMilliseconds: 700_000, newMarker: { "reboot" })
check(reboot.bootMarker == "reboot", "reboot detected even when new uptime exceeds old sample")
let early = IosClockState.next(previous: nil, bootTimeMilliseconds: 1_000_000,
  continuousMilliseconds: 500, newMarker: { "early" })
let earlyReboot = IosClockState.next(previous: early, bootTimeMilliseconds: 1_000_500,
  continuousMilliseconds: 600, newMarker: { "early-reboot" })
check(earlyReboot.bootMarker == "early-reboot", "tolerance strictly below last observed uptime")
let zero = IosClockState.next(previous: nil, bootTimeMilliseconds: 1_000_000,
  continuousMilliseconds: 0, newMarker: { "zero" })
let afterZero = IosClockState.next(previous: zero, bootTimeMilliseconds: 1_000_000,
  continuousMilliseconds: 1, newMarker: { "after-zero" })
check(afterZero.bootMarker == "after-zero", "no valid strict tolerance at zero uptime")
let cumulative = IosClockState.next(previous: correction, bootTimeMilliseconds: 1_121_000,
  continuousMilliseconds: 620_000, newMarker: { "cumulative" })
check(cumulative.bootMarker == "cumulative", "small corrections cannot move the original boot anchor")
print("D-082 clock scenarios passed")
