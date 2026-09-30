import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../models/incident.dart';
import '../theme.dart';

class MapView extends StatefulWidget {
  final MapController controller;
  final List<Incident> incidents;
  final int selected;
  final ValueChanged<int> onPick;

  const MapView({
    super.key,
    required this.controller,
    required this.incidents,
    required this.selected,
    required this.onPick,
  });

  @override
  State<MapView> createState() => _MapViewState();
}

class _MapViewState extends State<MapView> {
  LatLng? userLocation;
  bool loadingLocation = true;
  String? locationError;

  @override
  void initState() {
    super.initState();
    _getUserLocation();
  }

  Future<void> _getUserLocation() async {
    try {
      // Check whether location services are enabled.
      final serviceEnabled =
          await Geolocator.isLocationServiceEnabled();

      if (!serviceEnabled) {
        setState(() {
          loadingLocation = false;
          locationError = 'Location services are disabled';
        });
        return;
      }

      // Check permission.
      LocationPermission permission =
          await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() {
          loadingLocation = false;
          locationError = 'Location permission denied';
        });
        return;
      }

      // Get actual device location.
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      final location = LatLng(
        position.latitude,
        position.longitude,
      );

      if (!mounted) return;

      setState(() {
        userLocation = location;
        loadingLocation = false;
        locationError = null;
      });

      // Move map to user's real location.
      widget.controller.move(location, 13.5);
    } catch (e) {
      if (!mounted) return;

      setState(() {
        loadingLocation = false;
        locationError = 'Unable to get location';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Fallback center so map still works before GPS loads.
    final center =
        userLocation ?? const LatLng(19.0760, 72.8777);

    return Stack(
      children: [
        FlutterMap(
          mapController: widget.controller,
          options: MapOptions(
            initialCenter: center,
            initialZoom: 12.8,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),

          children: [
            // DIRECT OPENSTREETMAP TILES — NO API KEY
            TileLayer(
              urlTemplate:
                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName:
                  'com.example.citizen_app',
            ),

            // Incident radius
            CircleLayer(
              circles: [
                for (final incident in widget.incidents)
                  CircleMarker(
                    point: LatLng(
                      incident.lat,
                      incident.lon,
                    ),
                    radius: 700,
                    useRadiusInMeter: true,
                    color: incident.color.withOpacity(0.14),
                    borderColor:
                        incident.color.withOpacity(0.5),
                    borderStrokeWidth: 1.5,
                  ),
              ],
            ),

            // Markers
            MarkerLayer(
              markers: [
                // REAL USER LOCATION
                if (userLocation != null)
                  Marker(
                    point: userLocation!,
                    width: 60,
                    height: 60,
                    child: const _Pulse(
                      color: kBlue,
                      size: 22,
                      icon: null,
                      still: false,
                    ),
                  ),

                // INCIDENT MARKERS
                for (var i = 0;
                    i < widget.incidents.length;
                    i++)
                  Marker(
                    point: LatLng(
                      widget.incidents[i].lat,
                      widget.incidents[i].lon,
                    ),
                    width: 96,
                    height: 96,
                    child: GestureDetector(
                      onTap: () =>
                          widget.onPick(i),
                      child: AnimatedScale(
                        scale: i == widget.selected
                            ? 1.2
                            : 0.9,
                        duration:
                            const Duration(milliseconds: 220),
                        curve: Curves.easeOut,
                        child: _Pulse(
                          color:
                              widget.incidents[i].color,
                          size: 44,
                          icon:
                              widget.incidents[i].icon,
                          still:
                              !widget.incidents[i].high,
                        ),
                      ),
                    ),
                  ),
              ],
            ),

            const RichAttributionWidget(
              alignment: AttributionAlignment.bottomLeft,
              attributions: [
                TextSourceAttribution(
                  'OpenStreetMap contributors',
                ),
              ],
            ),
          ],
        ),

        // Location loading indicator
        if (loadingLocation)
          Positioned(
            top: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 9,
              ),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius:
                    BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                    blurRadius: 10,
                    color: Colors.black12,
                  ),
                ],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child:
                        CircularProgressIndicator(
                      strokeWidth: 2,
                    ),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Locating you...',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight:
                          FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),

        // Permission/location error
        if (locationError != null)
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius:
                    BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(
                    blurRadius: 10,
                    color: Colors.black12,
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.location_off,
                    size: 18,
                    color: Colors.red,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      locationError!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight:
                            FontWeight.w600,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _getUserLocation,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _Pulse extends StatefulWidget {
  final Color color;
  final double size;
  final IconData? icon;
  final bool still;

  const _Pulse({
    required this.color,
    required this.size,
    required this.icon,
    this.still = false,
  });

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState
    extends State<_Pulse>
    with SingleTickerProviderStateMixin {

  late final AnimationController ac =
      AnimationController(
    vsync: this,
    duration:
        const Duration(milliseconds: 1800),
  )..repeat();

  @override
  void dispose() {
    ac.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: ac,
      builder: (_, __) {
        final t = ac.value;
        final s = widget.size;

        return Stack(
          alignment: Alignment.center,
          children: [
            if (!widget.still)
              Container(
                width: s + s * 1.2 * t,
                height: s + s * 1.2 * t,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color
                      .withOpacity(
                          .35 * (1 - t)),
                ),
              ),

            Container(
              width: s,
              height: s,
              decoration: BoxDecoration(
                color: widget.color,
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white,
                  width:
                      widget.icon == null
                          ? 4
                          : 3,
                ),
                boxShadow: [
                  BoxShadow(
                    color: widget.color
                        .withOpacity(.45),
                    blurRadius: 14,
                    offset:
                        const Offset(0, 4),
                  ),
                ],
              ),
              child: widget.icon == null
                  ? null
                  : Icon(
                      widget.icon,
                      color: Colors.white,
                      size: s * .5,
                    ),
            ),
          ],
        );
      },
    );
  }
}