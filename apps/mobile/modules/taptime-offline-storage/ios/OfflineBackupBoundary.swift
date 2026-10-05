import Foundation

enum OfflineBackupBoundary {
  static func exclude(_ directory: URL) throws {
    var url = directory
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try url.setResourceValues(values)
    guard try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true else {
      throw NSError(domain: "TapTimeOfflineStorage", code: 1)
    }
  }
}
