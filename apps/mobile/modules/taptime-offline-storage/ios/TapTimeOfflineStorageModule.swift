import ExpoModulesCore
import Foundation

public final class TapTimeOfflineStorageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TapTimeOfflineStorage")
    AsyncFunction("excludeSQLiteFromBackup") { (path: String) in
      guard let documents = self.appContext?.config.documentDirectory else {
        throw NSError(domain: "TapTimeOfflineStorage", code: 2)
      }
      let directory = documents.appendingPathComponent("SQLite", isDirectory: true).standardizedFileURL
      guard directory.path == URL(fileURLWithPath: path).standardizedFileURL.path else {
        throw NSError(domain: "TapTimeOfflineStorage", code: 3)
      }
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try OfflineBackupBoundary.exclude(directory)
    }
  }
}
