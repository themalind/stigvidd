Pod::Spec.new do |s|
  s.name           = 'ExpoLiveLocation'
  s.version        = '1.0.0'
  s.summary        = 'iOS 18+ background location via modern Core Location'
  s.description    = 'Background location tracking using CLLocationUpdate.liveUpdates and CLBackgroundActivitySession, which keep delivering fixes while the app is backgrounded/pocketed — unlike the classic continuous-updates API.'
  s.author         = 'Stigvidd'
  s.homepage       = 'https://stigvidd.se'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
