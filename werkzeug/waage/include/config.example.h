// Nach config.h kopieren und ausfüllen. config.h bleibt auf dem Rechner (.gitignore).
#pragma once

// Das WLAN zu Hause (2,4 GHz – 5 GHz kann der ESP32 nicht)
#define WLAN_SSID "mein-wlan"
#define WLAN_PASS "geheim"

// Aus dem Supabase-Projekt: Project Settings → API – dieselben Werte wie in der App unter Einstellungen → Waage
#define SUPABASE_URL "https://xyz.supabase.co"
#define SUPABASE_KEY "eyJ…"
#define KANAL "waage"

// Wo der HX711 am ESP32 hängt (DT = DOUT, SCK = PD_SCK)
#define PIN_DT 16
#define PIN_SCK 4

// Die eingebaute LED (ESP32 DevKit: 2) – blinkt beim Verbinden, leuchtet kurz beim Senden
#define PIN_LED 2
