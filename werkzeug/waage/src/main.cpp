/*
 * Die Waage von Boxenstopp: ein ESP32 liest die Wägezelle über einen HX711
 * und schickt die Gramm an Supabase Realtime (Broadcast auf einem Kanal).
 * Die App hört dort zu (js/waage.js) – im Kochmodus zählt sie dann mit,
 * was in die Schale kommt (js/wiegen.js).
 *
 * Die Waage ist absichtlich dumm: Sie sendet nur kalibrierte Gramm ohne
 * Tara, empfängt nichts und hat weder Display noch Tasten. Tara, Ziel und
 * „passt“ macht die App. Kalibriert wird einmal über den seriellen Monitor:
 *
 *   t         Nullpunkt: nichts auf der Waage, dann t
 *   c 1000    Kalibrieren: ein bekanntes Gewicht drauf (1 kg Zucker), dann c
 *             und die Gramm – beides bleibt im Flash (Preferences)
 *   r         den rohen Wert zeigen
 *   ?         Stand: WLAN, Kalibrierung, letzter Wert, gesendete Nachrichten
 *
 * Gesendet wird 5-mal die Sekunde, solange sich in der letzten Minute etwas
 * getan hat (die App erkennt am gleichmäßigen Strom, wann ein Wert steht),
 * danach nur noch alle 10 Sekunden; eine Änderung weckt sofort wieder. Die
 * App meldet „Waage aus“, wenn 40 Sekunden nichts kommt.
 *
 * Schaltung: Wägezelle → HX711 (E+ rot, E- schwarz, A- weiß, A+ grün), HX711
 * VCC → 3V3, GND → GND, DT → GPIO 16, SCK → GPIO 4 (config.h). Siehe README.md.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <HX711.h>
#include "config.h"

// Messen: so oft liest der HX711 (er liefert 10 Werte die Sekunde)
static const unsigned long MESS_MS = 100;
// Senden: wach (in der letzten Minute hat sich etwas getan) alle 200 ms, sonst alle 10 s
static const unsigned long SENDE_MS = 200;
static const unsigned long SENDE_SCHLAF_MS = 10000;
static const unsigned long SCHLAF_NACH_MS = 60000;
static const float AENDERUNG_G = 0.5f;
static const float RUHE_G = 1.0f;

HX711 zelle;
Preferences ablage;
WiFiClientSecure netz;
HTTPClient http;

static float faktor = 1.0f;     // rohe Einheiten je Gramm
static long nullpunkt = 0;      // roher Wert bei leerer Waage
static float gramm = 0;         // der letzte Wert
static float gesendet = NAN;    // der letzte gesendete Wert
static unsigned long zuletztGesendet = 0;
static unsigned long ruheSeit = 0;
static unsigned long zuletztGemessen = 0;
static unsigned long nachrichten = 0;
static unsigned long fehler = 0;
static String url;

static void led(bool an) { digitalWrite(PIN_LED, an ? HIGH : LOW); }

static void kalibrierungLaden() {
  ablage.begin("waage", true);
  faktor = ablage.getFloat("faktor", 1.0f);
  nullpunkt = ablage.getLong("null", 0);
  ablage.end();
  if (!(faktor > 0.0001f) || isnan(faktor)) faktor = 1.0f;
  zelle.set_scale(faktor);
  zelle.set_offset(nullpunkt);
}

static void kalibrierungSpeichern() {
  ablage.begin("waage", false);
  ablage.putFloat("faktor", faktor);
  ablage.putLong("null", nullpunkt);
  ablage.end();
}

static void wlanVerbinden() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("WLAN: verbinde mit %s", WLAN_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WLAN_SSID, WLAN_PASS);
  unsigned long start = millis();
  bool an = false;
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    led(an = !an);
    delay(250);
    Serial.print('.');
  }
  led(false);
  if (WiFi.status() == WL_CONNECTED) Serial.printf("\nWLAN: da, %s\n", WiFi.localIP().toString().c_str());
  else Serial.println("\nWLAN: nicht da – probiere es gleich wieder");
}

static void httpStarten() {
  http.end();
  // Der anon-Schlüssel ist öffentlich und die Gramm sind kein Geheimnis: ohne Zertifikatsprüfung,
  // damit die Waage nicht eines Tages an einem ausgetauschten Wurzelzertifikat scheitert.
  netz.setInsecure();
  http.setReuse(true);
  http.setTimeout(4000);
  http.begin(netz, url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
}

static bool senden(float g, bool ruhig) {
  if (WiFi.status() != WL_CONNECTED) return false;
  char body[64];
  snprintf(body, sizeof body, "{\"g\":%.1f,\"s\":%d,\"n\":%lu}", g, ruhig ? 1 : 0, nachrichten);
  led(true);
  int code = http.POST((uint8_t*)body, strlen(body));
  http.getString(); // die Antwort leer lesen, damit die Verbindung offen bleibt
  led(false);
  if (code == 202 || code == 200) { nachrichten++; return true; }
  fehler++;
  Serial.printf("Senden: HTTP %d\n", code);
  if (code < 0) httpStarten(); // Verbindung weg – neu aufbauen
  return false;
}

static void befehl(const String& zeile) {
  String z = zeile;
  z.trim();
  if (z == "t") {
    if (!zelle.wait_ready_timeout(2000)) { Serial.println("HX711 antwortet nicht – Verdrahtung prüfen"); return; }
    nullpunkt = zelle.read_average(15);
    zelle.set_offset(nullpunkt);
    kalibrierungSpeichern();
    Serial.printf("Nullpunkt gesetzt: %ld\n", nullpunkt);
    return;
  }
  if (z.startsWith("c ")) {
    float bekannt = z.substring(2).toFloat();
    if (bekannt < 10) { Serial.println("c <Gramm>, z. B. c 1000 mit 1 kg Zucker auf der Waage"); return; }
    if (!zelle.wait_ready_timeout(2000)) { Serial.println("HX711 antwortet nicht"); return; }
    long roh = zelle.read_average(15);
    faktor = (float)(roh - nullpunkt) / bekannt;
    if (faktor < 0) { faktor = -faktor; Serial.println("Hinweis: Die Zelle zählt verkehrt herum (A+ und A- tauschen) – ich rechne es um."); }
    zelle.set_scale(faktor);
    kalibrierungSpeichern();
    Serial.printf("Kalibriert: %.3f Einheiten je Gramm (roh %ld, Nullpunkt %ld)\n", faktor, roh, nullpunkt);
    return;
  }
  if (z == "r") { Serial.printf("roh: %ld\n", zelle.read_average(5)); return; }
  if (z == "?") {
    Serial.printf("WLAN %s (%s) | Nullpunkt %ld, Faktor %.3f | %.1f g | %lu gesendet, %lu Fehler | Kanal %s\n",
      WiFi.status() == WL_CONNECTED ? "da" : "weg", WiFi.localIP().toString().c_str(), nullpunkt, faktor, gramm, nachrichten, fehler, KANAL);
    return;
  }
  Serial.println("Befehle: t (Nullpunkt), c <Gramm> (kalibrieren), r (roh), ? (Stand)");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  delay(300);
  Serial.println("\nBoxenstopp-Waage");
  zelle.begin(PIN_DT, PIN_SCK);
  kalibrierungLaden();
  if (faktor == 1.0f && nullpunkt == 0) Serial.println("Noch nicht kalibriert: Waage leer lassen, t – dann 1 kg drauf, c 1000");
  else Serial.printf("Kalibrierung geladen: Nullpunkt %ld, Faktor %.3f\n", nullpunkt, faktor);
  url = String(SUPABASE_URL) + "/realtime/v1/api/broadcast/" + KANAL + "/events/g";
  wlanVerbinden();
  httpStarten();
  Serial.println("Befehle: t, c <Gramm>, r, ?");
}

void loop() {
  // Serielle Befehle
  static String zeile;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') { if (zeile.length()) befehl(zeile); zeile = ""; }
    else if (zeile.length() < 40) zeile += c;
  }

  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long letzterVersuch = 0;
    if (millis() - letzterVersuch > 5000) { letzterVersuch = millis(); wlanVerbinden(); if (WiFi.status() == WL_CONNECTED) httpStarten(); }
  }

  unsigned long jetzt = millis();
  if (jetzt - zuletztGemessen < MESS_MS) { delay(5); return; }
  if (!zelle.is_ready()) return; // der HX711 liefert 10 Werte die Sekunde – nur lesen, wenn einer da ist
  zuletztGemessen = jetzt;
  float roh = zelle.get_units(1);
  if (isnan(roh)) return;
  // Der letzte und der neue Wert gemittelt: glatt genug, und trotzdem schnell, wenn etwas dazukommt
  static float vorher = NAN;
  float neu = isnan(vorher) ? roh : (roh + vorher) / 2;
  vorher = roh;
  bool ruhig = fabsf(neu - gramm) < RUHE_G;
  if (!ruhig) ruheSeit = jetzt;
  gramm = neu;

  // Senden: wach im Takt, im Schlaf selten – eine Änderung (die ruheSeit zurücksetzt) weckt sofort
  bool geaendert = isnan(gesendet) || fabsf(gramm - gesendet) >= AENDERUNG_G;
  bool wach = jetzt - ruheSeit <= SCHLAF_NACH_MS;
  unsigned long takt = wach || geaendert ? SENDE_MS : SENDE_SCHLAF_MS;
  if (jetzt - zuletztGesendet >= takt && senden(gramm, ruhig && jetzt - ruheSeit > 1000)) { gesendet = gramm; zuletztGesendet = jetzt; }
}
