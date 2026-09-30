# SafeCity — Citizen App (P1)

## Setup
```bash
flutter create citizen_app --platforms=android,ios,web   # in an empty folder
# copy lib/ and pubspec.yaml from this project over it, then:
flutter pub get
flutter run                                              # mock data (default)
flutter run --dart-define=API=http://192.168.x.x:8000    # real P3 backend, falls back to mock
```
Android: in `android/app/src/main/AndroidManifest.xml` add inside `<manifest>`:
`<uses-permission android:name="android.permission.INTERNET"/>` and on `<application>`: `android:usesCleartextTraffic="true"`.
Backend must run with `--host 0.0.0.0`.
