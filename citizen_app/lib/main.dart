import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';

import 'screens/login_screen.dart';
import 'services/geo_alert_sync.dart';
import 'theme.dart';

/// Backend base URL. Videos are streamed from here too, e.g.
/// http://127.0.0.1:8000/videos/admin_blocked.mp4 (nothing is bundled in the app).
///  - Chrome / desktop / iOS simulator: 127.0.0.1
///  - Android emulator: 10.0.2.2 (the emulator's alias for your PC)
///  - Physical phone: use your PC's LAN IP, e.g. http://192.168.1.20:8000
String get kBackendBase {
  if (kIsWeb) return 'http://127.0.0.1:8000';
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:8000';
  return 'http://127.0.0.1:8000';
}

/// Shared by the home screen avatar and the profile popup.
final geoSync = GeoAlertSync(baseUrl: kBackendBase);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await geoSync.init();
  runApp(const CitizenApp());
}

class CitizenApp extends StatelessWidget {
  const CitizenApp({super.key});

  @override
  Widget build(BuildContext c) => MaterialApp(
        title: 'SafeCity',
        debugShowCheckedModeBanner: false,
        theme: appTheme,
        home: const LoginScreen(),
      );
}