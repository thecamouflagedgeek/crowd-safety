// Smoke test — verifies the app launches without crashing.
import 'package:flutter_test/flutter_test.dart';
import 'package:citizen_app/main.dart';

void main() {
  testWidgets('App launches smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const CitizenApp());
    // App renders the login / onboarding screen.
    expect(find.byType(CitizenApp), findsOneWidget);
  });
}
