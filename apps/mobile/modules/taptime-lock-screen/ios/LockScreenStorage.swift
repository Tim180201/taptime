import Foundation
import Security
import UIKit

@MainActor final class LockFileStore: LockStandStorage {
  private func file() throws -> URL {
    var directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("TapTimeLockScreen", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var values = URLResourceValues(); values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
    return directory.appendingPathComponent("state.json")
  }
  func read() throws -> LockStand? {
    let url = try file()
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return try JSONDecoder().decode(LockStand.self, from: Data(contentsOf: url))
  }
  func write(_ stand: LockStand?) throws {
    var url = try file()
    if let stand {
      try JSONEncoder().encode(stand).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      var values = URLResourceValues(); values.isExcludedFromBackup = true; try url.setResourceValues(values)
    } else if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
  }
}

struct LockStorageUnavailable: Error {}
@MainActor final class LockKeychain: LockCapabilityStorage {
  // Separate from Expo SecureStore and authentication; not shared with the extension or backups.
  private let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.tim180201.mobile.lock-screen", kSecAttrAccount as String: "capability-v1",
    kSecAttrSynchronizable as String: false]
  func read(id: String) throws -> String? {
    var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(q as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data, let value = LockLogic.object(data),
      value["id"] as? String == id else { throw LockStorageUnavailable() }
    return value["capability"] as? String
  }
  func replace(id: String, capability: String) throws {
    guard UIApplication.shared.applicationState == .active else { throw LockStorageUnavailable() }
    let data = try JSONSerialization.data(withJSONObject: ["id": id, "capability": capability])
    let attributes: [String: Any] = [kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound { status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) }
    guard status == errSecSuccess else { throw LockStorageUnavailable() }
  }
  func remove() throws {
    guard UIApplication.shared.applicationState == .active else { throw LockStorageUnavailable() }
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else { throw LockStorageUnavailable() }
  }
}
