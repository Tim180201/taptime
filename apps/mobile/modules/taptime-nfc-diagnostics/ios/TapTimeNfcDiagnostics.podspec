Pod::Spec.new do |s|
  s.name = 'TapTimeNfcDiagnostics'
  s.version = '1.0.0'
  s.summary = 'iOS NFC lifecycle diagnostics without tag or account data'
  s.description = 'Allowlisted NFC phases in Apple unified logging.'
  s.license = { :type => 'Proprietary' }
  s.author = 'TapTim.e'
  s.homepage = 'https://github.com/Tim180201/taptime'
  s.source = { :git => 'https://github.com/Tim180201/taptime.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
