const defaultSettings = {
  showOrbs: true,
  glassPlayer: true,
  autoplayNext: true,
  showOscilloscope: true,
  themePreset: "",
  oscColor: "#ff66cc",
  accent: "#ff66cc",
  accent2: "#ff9ee2",
  bg: "#0b0c10",
  bgSoft: "#12141b",
  bgElev: "#181c25",
  sidebar: "#0f131a",
  text: "#e6e8ef",
  muted: "#a6adbb",
  oscHeight: 48,
  oscWidth: 100,
  oscFftSize: 4096,
  oscLineWidth: 1,
};

const themePresets = {
  "dark-pink": {
    accent: "#ff66cc",
    accent2: "#ff9ee2",
    bg: "#0b0c10",
    bgSoft: "#12141b",
    bgElev: "#181c25",
    sidebar: "#0f131a",
    text: "#e6e8ef",
    muted: "#a6adbb",
  },
  "blue-neon": {
    accent: "#4dd7ff",
    accent2: "#88f2ff",
    bg: "#05080f",
    bgSoft: "#0c1421",
    bgElev: "#111b2b",
    sidebar: "#08101b",
    text: "#e8f4ff",
    muted: "#9bb0c4",
  },
  sunset: {
    accent: "#ff7a4b",
    accent2: "#ffb37a",
    bg: "#120a0b",
    bgSoft: "#1a1113",
    bgElev: "#24171b",
    sidebar: "#12090c",
    text: "#ffe8dd",
    muted: "#c7a59a",
  },
  forest: {
    accent: "#5fe39c",
    accent2: "#9af0c5",
    bg: "#0b100e",
    bgSoft: "#111a16",
    bgElev: "#18251f",
    sidebar: "#0c1411",
    text: "#e6f6ee",
    muted: "#9ab3a8",
  },
  mono: {
    accent: "#cfd6e1",
    accent2: "#ffffff",
    bg: "#0c0d10",
    bgSoft: "#12141a",
    bgElev: "#1a1d24",
    sidebar: "#0e1015",
    text: "#f3f6fb",
    muted: "#9aa3b2",
  },
};

const SETTINGS_API = `${window.FLOW_API_BASE || "http://127.0.0.1:8001"}/api/settings`;
let settingsApiAvailable = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function parseColorToRgb(color) {
  if (!color || typeof color !== "string") return null;
  const value = color.trim();
  if (value.startsWith("#")) {
    return hexToRgb(value);
  }
  if (value.startsWith("rgb")) {
    const parts = value.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    return [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])].map((n) =>
      Math.round(clamp(n, 0, 255))
    );
  }
  if (value.startsWith("hsl")) {
    const parts = value.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);
    return hslToRgb(((h % 360) + 360) % 360, clamp(s, 0, 100), clamp(l, 0, 100));
  }
  return null;
}

function colorToRgbString(color, fallback) {
  const rgb = parseColorToRgb(color) || parseColorToRgb(fallback);
  if (!rgb) return "255, 102, 204";
  return rgb.map((n) => Math.round(n)).join(", ");
}

function readStoredSettings() {
  try {
    const stored = localStorage.getItem("flow-settings");
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed.updatedAt !== "number") return {};
    return parsed;
  } catch (err) {
    console.warn("Failed to read settings from storage", err);
    return {};
  }
}

async function loadSettings() {
  let fileSettings = {};
  let apiSettings = {};
  try {
    const apiRes = await fetch(SETTINGS_API);
    if (apiRes.ok) {
      const payload = await apiRes.json();
      apiSettings = payload.settings || {};
      settingsApiAvailable = true;
    }
  } catch (err) {
    settingsApiAvailable = false;
  }

  try {
    const res = await fetch("src/data/settings.json", { cache: "no-store" });
    if (res.ok) {
      fileSettings = await res.json();
    }
  } catch (err) {
    console.warn("Failed to load settings.json", err);
  }

  const stored = readStoredSettings();
  const mergedFile = { ...fileSettings, ...apiSettings };
  const fileUpdated = Number(mergedFile.updatedAt || 0);
  const storedUpdated = Number(stored.updatedAt || 0);
  const preferStored = storedUpdated > 0 && storedUpdated >= fileUpdated;
  const settings = preferStored
    ? { ...defaultSettings, ...mergedFile, ...stored }
    : { ...defaultSettings, ...stored, ...mergedFile };
  window.flowSettings = settings;
  applySettings(settings);
  syncSettingsUI(settings);
  window.dispatchEvent(new CustomEvent("flow:settings", { detail: settings }));
  return settings;
}

function saveSettings(settings) {
  const stamped = { ...settings, updatedAt: Date.now() };
  localStorage.setItem("flow-settings", JSON.stringify(stamped));
  window.flowSettings = stamped;
  applySettings(stamped);
  window.dispatchEvent(new CustomEvent("flow:settings", { detail: stamped }));
  if (settingsApiAvailable) {
    fetch(SETTINGS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stamped),
    }).catch(() => {});
  }
}

function applySettings(settings) {
  const body = document.body;
  const player = document.querySelector(".player");
  const oscilloscope = document.querySelector(".oscilloscope-wrap");
  const orbs = document.querySelector(".bg-orbs");
  const root = document.documentElement;

  if (body) {
    body.classList.toggle("orbs-off", !settings.showOrbs);
  }
  if (orbs) {
    orbs.style.display = settings.showOrbs ? "block" : "none";
  }
  if (player) {
    player.classList.toggle("player-flat", !settings.glassPlayer);
  }
  if (oscilloscope) {
    oscilloscope.classList.toggle("hidden", !settings.showOscilloscope);
  }
  if (root) {
    root.style.setProperty("--osc-height", `${settings.oscHeight || defaultSettings.oscHeight}px`);
    root.style.setProperty("--osc-width", `${settings.oscWidth || defaultSettings.oscWidth}%`);
    root.style.setProperty("--accent", settings.accent || defaultSettings.accent);
    root.style.setProperty("--accent-2", settings.accent2 || defaultSettings.accent2);
    root.style.setProperty(
      "--accent-rgb",
      colorToRgbString(settings.accent, defaultSettings.accent)
    );
    root.style.setProperty(
      "--accent-2-rgb",
      colorToRgbString(settings.accent2, defaultSettings.accent2)
    );
    root.style.setProperty("--bg", settings.bg || defaultSettings.bg);
    root.style.setProperty("--bg-soft", settings.bgSoft || defaultSettings.bgSoft);
    root.style.setProperty("--bg-elev", settings.bgElev || defaultSettings.bgElev);
    root.style.setProperty("--sidebar", settings.sidebar || defaultSettings.sidebar);
    root.style.setProperty("--text", settings.text || defaultSettings.text);
    root.style.setProperty("--muted", settings.muted || defaultSettings.muted);
    root.style.setProperty("--osc-color", settings.oscColor || defaultSettings.oscColor);
  }
}

function syncSettingsUI(settings) {
  const orbs = document.getElementById("setting-orbs");
  const glass = document.getElementById("setting-glass");
  const autoplay = document.getElementById("setting-autoplay");
  const osc = document.getElementById("setting-osc");
  const oscHeight = document.getElementById("setting-osc-height");
  const oscWidth = document.getElementById("setting-osc-width");
  const oscFft = document.getElementById("setting-osc-fft");
  const oscLine = document.getElementById("setting-osc-line");
  const oscHeightValue = document.getElementById("osc-height-value");
  const oscWidthValue = document.getElementById("osc-width-value");
  const oscLineValue = document.getElementById("osc-line-value");
  const accent = document.getElementById("setting-accent");
  const accent2 = document.getElementById("setting-accent-2");
  const bg = document.getElementById("setting-bg");
  const bgSoft = document.getElementById("setting-bg-soft");
  const bgElev = document.getElementById("setting-bg-elev");
  const sidebar = document.getElementById("setting-sidebar");
  const text = document.getElementById("setting-text");
  const muted = document.getElementById("setting-muted");
  const presetSelect = document.getElementById("setting-theme-preset");
  const oscColor = document.getElementById("setting-osc-color");

  if (orbs) orbs.checked = settings.showOrbs;
  if (glass) glass.checked = settings.glassPlayer;
  if (autoplay) autoplay.checked = settings.autoplayNext;
  if (osc) osc.checked = settings.showOscilloscope;
  if (oscHeight) oscHeight.value = settings.oscHeight ?? defaultSettings.oscHeight;
  if (oscWidth) oscWidth.value = settings.oscWidth ?? defaultSettings.oscWidth;
  if (oscFft) oscFft.value = settings.oscFftSize ?? defaultSettings.oscFftSize;
  if (oscLine) oscLine.value = settings.oscLineWidth ?? defaultSettings.oscLineWidth;
  if (oscHeightValue) oscHeightValue.textContent = `${settings.oscHeight ?? defaultSettings.oscHeight}px`;
  if (oscWidthValue) oscWidthValue.textContent = `${settings.oscWidth ?? defaultSettings.oscWidth}%`;
  if (oscLineValue) oscLineValue.textContent = `${settings.oscLineWidth ?? defaultSettings.oscLineWidth}px`;
  if (accent) accent.value = settings.accent ?? defaultSettings.accent;
  if (accent2) accent2.value = settings.accent2 ?? defaultSettings.accent2;
  if (bg) bg.value = settings.bg ?? defaultSettings.bg;
  if (bgSoft) bgSoft.value = settings.bgSoft ?? defaultSettings.bgSoft;
  if (bgElev) bgElev.value = settings.bgElev ?? defaultSettings.bgElev;
  if (sidebar) sidebar.value = settings.sidebar ?? defaultSettings.sidebar;
  if (text) text.value = settings.text ?? defaultSettings.text;
  if (muted) muted.value = settings.muted ?? defaultSettings.muted;
  if (oscColor) oscColor.value = settings.oscColor ?? defaultSettings.oscColor;
  if (presetSelect) presetSelect.value = settings.themePreset || "";
}

function initSettingsUI() {
  const orbs = document.getElementById("setting-orbs");
  const glass = document.getElementById("setting-glass");
  const autoplay = document.getElementById("setting-autoplay");
  const osc = document.getElementById("setting-osc");
  const oscHeight = document.getElementById("setting-osc-height");
  const oscWidth = document.getElementById("setting-osc-width");
  const oscFft = document.getElementById("setting-osc-fft");
  const oscLine = document.getElementById("setting-osc-line");
  const oscHeightValue = document.getElementById("osc-height-value");
  const oscWidthValue = document.getElementById("osc-width-value");
  const oscLineValue = document.getElementById("osc-line-value");
  const saveBtn = document.getElementById("save-settings");
  const saveStatus = document.getElementById("save-status");
  const resetBtn = document.getElementById("reset-settings");
  const resetLocalBtn = document.getElementById("reset-local");
  const accent = document.getElementById("setting-accent");
  const accent2 = document.getElementById("setting-accent-2");
  const bg = document.getElementById("setting-bg");
  const bgSoft = document.getElementById("setting-bg-soft");
  const bgElev = document.getElementById("setting-bg-elev");
  const sidebar = document.getElementById("setting-sidebar");
  const text = document.getElementById("setting-text");
  const muted = document.getElementById("setting-muted");
  const presetSelect = document.getElementById("setting-theme-preset");
  const randomBtn = document.getElementById("random-theme");
  const oscColor = document.getElementById("setting-osc-color");

  const collectSettings = () => ({
    ...defaultSettings,
    ...readStoredSettings(),
    showOrbs: orbs ? orbs.checked : defaultSettings.showOrbs,
    glassPlayer: glass ? glass.checked : defaultSettings.glassPlayer,
    autoplayNext: autoplay ? autoplay.checked : defaultSettings.autoplayNext,
    showOscilloscope: osc ? osc.checked : defaultSettings.showOscilloscope,
    themePreset: presetSelect ? presetSelect.value : defaultSettings.themePreset,
    oscHeight: oscHeight ? parseInt(oscHeight.value, 10) : defaultSettings.oscHeight,
    oscWidth: oscWidth ? parseInt(oscWidth.value, 10) : defaultSettings.oscWidth,
    oscFftSize: oscFft ? parseInt(oscFft.value, 10) : defaultSettings.oscFftSize,
    oscLineWidth: oscLine ? parseFloat(oscLine.value) : defaultSettings.oscLineWidth,
    oscColor: oscColor ? oscColor.value : defaultSettings.oscColor,
    accent: accent ? accent.value : defaultSettings.accent,
    accent2: accent2 ? accent2.value : defaultSettings.accent2,
    bg: bg ? bg.value : defaultSettings.bg,
    bgSoft: bgSoft ? bgSoft.value : defaultSettings.bgSoft,
    bgElev: bgElev ? bgElev.value : defaultSettings.bgElev,
    sidebar: sidebar ? sidebar.value : defaultSettings.sidebar,
    text: text ? text.value : defaultSettings.text,
    muted: muted ? muted.value : defaultSettings.muted,
  });

  const applyPaletteToInputs = (palette) => {
    if (!palette) return;
    if (accent) accent.value = palette.accent;
    if (accent2) accent2.value = palette.accent2;
    if (bg) bg.value = palette.bg;
    if (bgSoft) bgSoft.value = palette.bgSoft;
    if (bgElev) bgElev.value = palette.bgElev;
    if (sidebar) sidebar.value = palette.sidebar;
    if (text) text.value = palette.text;
    if (muted) muted.value = palette.muted;
    if (oscColor) oscColor.value = palette.accent;
  };

  const makeRandomPalette = () => {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const h = rand(0, 359);
    const accent = `hsl(${h}, 90%, 68%)`;
    const accent2 = `hsl(${(h + 25) % 360}, 85%, 75%)`;
    const bg = `hsl(${h}, 30%, 7%)`;
    const bgSoft = `hsl(${h}, 28%, 11%)`;
    const bgElev = `hsl(${h}, 26%, 16%)`;
    const sidebar = `hsl(${h}, 30%, 9%)`;
    const text = `hsl(${(h + 5) % 360}, 35%, 92%)`;
    const muted = `hsl(${(h + 10) % 360}, 18%, 70%)`;
    return { accent, accent2, bg, bgSoft, bgElev, sidebar, text, muted };
  };

  const markDirty = () => {
    if (saveStatus) saveStatus.textContent = "Not saved yet.";
    if (saveBtn) saveBtn.classList.remove("saved");
  };

  const updatePreview = () => {
    const settings = collectSettings();
    window.flowSettings = settings;
    applySettings(settings);
    window.dispatchEvent(new CustomEvent("flow:settings", { detail: settings }));
    if (oscHeightValue) oscHeightValue.textContent = `${settings.oscHeight}px`;
    if (oscWidthValue) oscWidthValue.textContent = `${settings.oscWidth}%`;
    if (oscLineValue) oscLineValue.textContent = `${settings.oscLineWidth}px`;
    markDirty();
  };

  const updateFromUI = () => {
    const settings = collectSettings();
    saveSettings(settings);
    if (saveStatus) saveStatus.textContent = "Saved locally.";
    if (saveBtn) {
      saveBtn.classList.remove("saved");
      requestAnimationFrame(() => saveBtn.classList.add("saved"));
    }
    if (oscHeightValue) oscHeightValue.textContent = `${settings.oscHeight}px`;
    if (oscWidthValue) oscWidthValue.textContent = `${settings.oscWidth}%`;
    if (oscLineValue) oscLineValue.textContent = `${settings.oscLineWidth}px`;
  };

  [
    orbs,
    glass,
    autoplay,
    osc,
    oscHeight,
    oscWidth,
    oscFft,
    oscLine,
    oscColor,
    accent,
    accent2,
    bg,
    bgSoft,
    bgElev,
    sidebar,
    text,
    muted,
    presetSelect,
  ].forEach(
    (input) => {
      if (input) {
        input.addEventListener("change", updatePreview);
      }
    }
  );

  if (oscHeight) {
    oscHeight.addEventListener("input", () => {
      if (oscHeightValue) oscHeightValue.textContent = `${oscHeight.value}px`;
      updatePreview();
    });
  }
  if (oscWidth) {
    oscWidth.addEventListener("input", () => {
      if (oscWidthValue) oscWidthValue.textContent = `${oscWidth.value}%`;
      updatePreview();
    });
  }
  if (oscLine) {
    oscLine.addEventListener("input", () => {
      if (oscLineValue) oscLineValue.textContent = `${oscLine.value}px`;
      updatePreview();
    });
  }

  [accent, accent2, bg, bgSoft, bgElev, sidebar, text, muted, oscColor].forEach((input) => {
    if (input) {
      input.addEventListener("input", () => {
        if (presetSelect) presetSelect.value = "";
        updatePreview();
      });
    }
  });

  if (presetSelect) {
    presetSelect.addEventListener("change", () => {
      const preset = themePresets[presetSelect.value];
      if (preset) {
        applyPaletteToInputs(preset);
      }
      updatePreview();
    });
  }

  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      const palette = makeRandomPalette();
      applyPaletteToInputs(palette);
      if (presetSelect) presetSelect.value = "";
      updatePreview();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", updateFromUI);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      saveSettings(defaultSettings);
      syncSettingsUI(defaultSettings);
      if (saveStatus) saveStatus.textContent = "Reset to defaults.";
      if (saveBtn) {
        saveBtn.classList.remove("saved");
        requestAnimationFrame(() => saveBtn.classList.add("saved"));
      }
    });
  }

  if (resetLocalBtn) {
    resetLocalBtn.addEventListener("click", async () => {
      localStorage.removeItem("flow-settings");
      const settings = await loadSettings();
      if (settings) {
        syncSettingsUI(settings);
        if (saveStatus) saveStatus.textContent = "Local storage reset.";
      }
      if (saveBtn) {
        saveBtn.classList.remove("saved");
        requestAnimationFrame(() => saveBtn.classList.add("saved"));
      }
    });
  }
}

const bootSettings = () => {
  loadSettings();
  initSettingsUI();
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootSettings);
} else {
  bootSettings();
}
