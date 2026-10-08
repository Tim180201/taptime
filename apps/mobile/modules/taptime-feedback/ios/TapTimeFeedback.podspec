Pod::Spec.new do |s|
  s.name = 'TapTimeFeedback'
  s.version = '1.0.0'
  s.summary = 'iOS haptic and audible result feedback'
  s.description = 'Shared result profiles with ambient audio and Core Haptics.'
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
