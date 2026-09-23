Pod::Spec.new do |s|
  s.name = 'TapTimeMonotonicClock'
  s.version = '1.0.0'
  s.summary = 'TapTim.e native offline clock'
  s.description = 'Persistent clock evidence for the TapTim.e offline queue.'
  s.license = { :type => 'Proprietary' }
  s.author = 'TapTim.e'
  s.homepage = 'https://github.com/Tim180201/taptime'
  s.source = { :git => 'https://github.com/Tim180201/taptime.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.resource_bundles = { 'TapTimeMonotonicClock_privacy' => ['PrivacyInfo.xcprivacy'] }
end
