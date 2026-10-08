import ExpoModulesCore
import AVFoundation
import CoreHaptics

public class TapTimeFeedbackModule: Module {
  private var haptics: CHHapticEngine?
  private var player: AVAudioPlayer?

  public func definition() -> ModuleDefinition {
    Name("TapTimeFeedback")
    AsyncFunction("perform") { (profile: FeedbackProfile) throws in
      try profile.validate()
      // Haptics and audio are independent best-effort channels.
      try? self.vibrate(profile)
      try? self.playTone(profile)
    }.runOnQueue(.main)
    OnDestroy {
      self.player?.stop()
      self.player = nil
      self.haptics?.stop(completionHandler: nil)
      self.haptics = nil
    }
  }

  private func vibrate(_ profile: FeedbackProfile) throws {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
    if haptics == nil {
      haptics = try CHHapticEngine()
      haptics?.isAutoShutdownEnabled = true
      haptics?.playsHapticsOnly = true
    }
    guard let engine = haptics else { return }
    try engine.start()
    var events: [CHHapticEvent] = []
    var time = 0.0
    for (duration, amplitude) in zip(profile.vibrationTimingsMs, profile.vibrationAmplitudes) {
      if amplitude > 0 && duration > 0 {
        events.append(CHHapticEvent(eventType: .hapticContinuous, parameters: [
          CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(amplitude / 255)),
          CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
        ], relativeTime: time, duration: duration / 1000))
      }
      time += duration / 1000
    }
    let pattern = try CHHapticPattern(events: events, parameters: [])
    try engine.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
  }

  private func playTone(_ profile: FeedbackProfile) throws {
    // Ambient mixes with other audio and respects the iPhone Ring/Silent switch.
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.ambient, mode: .default)
    try session.setActive(true)
    player?.stop()
    player = try AVAudioPlayer(data: profile.wave())
    player?.volume = Float(profile.toneVolume)
    player?.play()
  }
}

struct FeedbackProfile: Record {
  @Field var vibrationTimingsMs: [Double] = []
  @Field var vibrationAmplitudes: [Double] = []
  @Field var toneFrequenciesHz: [Double] = []
  @Field var toneDurationsMs: [Double] = []
  @Field var toneVolume: Double = 0

  func validate() throws {
    guard !vibrationTimingsMs.isEmpty, vibrationTimingsMs.count == vibrationAmplitudes.count,
      vibrationTimingsMs.allSatisfy({ $0.isFinite && (0...1000).contains($0) }),
      vibrationTimingsMs.reduce(0, +) <= 10000,
      vibrationAmplitudes.allSatisfy({ $0.isFinite && (0...255).contains($0) }),
      !toneFrequenciesHz.isEmpty, toneFrequenciesHz.count == toneDurationsMs.count,
      toneFrequenciesHz.allSatisfy({ $0.isFinite && (100...2000).contains($0) }),
      toneDurationsMs.allSatisfy({ $0.isFinite && (24...1000).contains($0) }),
      toneDurationsMs.reduce(0, +) <= 10000,
      toneVolume.isFinite, (0...1).contains(toneVolume)
    else { throw NSError(domain: "TapTimeFeedback", code: 1) }
  }

  // The same 16 kHz sine, 10 ms envelope and 24 ms tone gaps as Android.
  func wave() -> Data {
    let sampleRate = 16000
    var pcm = Data()
    for (index, frequency) in toneFrequenciesHz.enumerated() {
      let count = sampleRate * Int(toneDurationsMs[index]) / 1000
      for sample in 0..<count {
        let envelope = min(1, min(Double(sample) / 160, Double(count - sample) / 160))
        let value = Int16(sin(2 * .pi * frequency * Double(sample) / Double(sampleRate)) * Double(Int16.max) * envelope)
        pcm.appendLittleEndian(UInt16(bitPattern: value))
      }
      if index < toneFrequenciesHz.count - 1 { pcm.append(Data(count: sampleRate * 24 / 1000 * 2)) }
    }
    var wave = Data("RIFF".utf8)
    wave.appendLittleEndian(UInt32(36 + pcm.count))
    wave.append(Data("WAVEfmt ".utf8))
    wave.appendLittleEndian(UInt32(16))
    wave.appendLittleEndian(UInt16(1))
    wave.appendLittleEndian(UInt16(1))
    wave.appendLittleEndian(UInt32(sampleRate))
    wave.appendLittleEndian(UInt32(sampleRate * 2))
    wave.appendLittleEndian(UInt16(2))
    wave.appendLittleEndian(UInt16(16))
    wave.append(Data("data".utf8))
    wave.appendLittleEndian(UInt32(pcm.count))
    wave.append(pcm)
    return wave
  }
}

private extension Data {
  mutating func appendLittleEndian<T: FixedWidthInteger>(_ value: T) {
    var littleEndian = value.littleEndian
    Swift.withUnsafeBytes(of: &littleEndian) { append(contentsOf: $0) }
  }
}
