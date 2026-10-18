import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "vn.vslv.app",
  appName: "VSLV",
  webDir: "out",
  backgroundColor: "#f4f8ff",
  android: { allowMixedContent: false },
  ios: { contentInset: "never" },
  server: {
    androidScheme: "https",
  },
};

export default config;
