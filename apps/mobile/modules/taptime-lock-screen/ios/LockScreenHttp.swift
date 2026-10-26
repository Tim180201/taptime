import Foundation

/** One bounded, ephemeral request. No cookies, redirects, shared login client or membership header. */
final class LockHttp: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  private var continuation: CheckedContinuation<LockHttpResult, Never>?
  private var data = Data()
  private var code = 0
  private var invalid = false
  static func post(baseURL: String, path: String, bearer: String, version: String, body: Data) async -> LockHttpResult {
    guard let base = URL(string: baseURL), base.scheme == "https", base.host != nil,
      base.user == nil, base.password == nil, let url = URL(string: path, relativeTo: base)?.absoluteURL else { return .init(failure: .connect) }
    let delegate = LockHttp()
    return await withCheckedContinuation { continuation in
      delegate.continuation = continuation
      let config = URLSessionConfiguration.ephemeral
      config.httpCookieStorage = nil; config.httpShouldSetCookies = false; config.urlCache = nil
      config.timeoutIntervalForRequest = 6.5; config.timeoutIntervalForResource = 6.5
      config.waitsForConnectivity = false
      let queue = OperationQueue(); queue.maxConcurrentOperationCount = 1
      let session = URLSession(configuration: config, delegate: delegate, delegateQueue: queue)
      var request = URLRequest(url: url); request.httpMethod = "POST"; request.httpBody = body
      request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.setValue("application/vnd.taptime.lock-screen.v2+json", forHTTPHeaderField: "Accept")
      request.setValue(version, forHTTPHeaderField: "X-TapTime-App")
      session.dataTask(with: request).resume()
    }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    code = (response as? HTTPURLResponse)?.statusCode ?? 0
    invalid = code == 200 && (response.mimeType?.lowercased() != "application/json" || response.expectedContentLength > 16 * 1024)
    completionHandler(invalid ? .cancel : .allow)
  }
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive bytes: Data) {
    if data.count + bytes.count > 16 * 1024 { invalid = true; dataTask.cancel() } else { data.append(bytes) }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    let failure: LockFailure?
    if invalid { failure = .response }
    else if let error = error as? URLError {
      failure = [.notConnectedToInternet, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed].contains(error.code) ? .connect : .response
    } else { failure = error == nil ? nil : .response }
    continuation?.resume(returning: .init(code: code, body: data, failure: failure)); continuation = nil
    session.finishTasksAndInvalidate()
  }
}
