using System;
using System.Collections.Generic;
using System.IO;
using System.Web.Script.Serialization;

namespace ParkPlaza.Zk9500Bridge
{
    internal sealed class BridgeConfig
    {
        public int Port { get; set; }
        public string CapabilitySecret { get; set; }
        public string[] AllowedOrigins { get; set; }
        public string DataDirectory { get; set; }
        public int DefaultTimeoutMs { get; set; }
        public int DeviceIndex { get; set; }

        public static BridgeConfig Load(string path)
        {
            if (!File.Exists(path))
                throw new InvalidOperationException("Missing bridge.config.json. Copy bridge.config.json.example and configure it first.");

            BridgeConfig config = new JavaScriptSerializer().Deserialize<BridgeConfig>(File.ReadAllText(path));
            if (config == null) throw new InvalidOperationException("bridge.config.json is invalid.");
            if (config.Port < 1024 || config.Port > 65535) throw new InvalidOperationException("Port must be between 1024 and 65535.");
            if (String.IsNullOrWhiteSpace(config.CapabilitySecret) || config.CapabilitySecret.Length < 32 || config.CapabilitySecret.IndexOf("change", StringComparison.OrdinalIgnoreCase) >= 0)
                throw new InvalidOperationException("CapabilitySecret must be a private random value of at least 32 characters.");
            if (config.AllowedOrigins == null || config.AllowedOrigins.Length == 0)
                throw new InvalidOperationException("AllowedOrigins must contain at least one exact development origin.");
            if (config.DefaultTimeoutMs < 5000 || config.DefaultTimeoutMs > 120000) config.DefaultTimeoutMs = 30000;
            if (String.IsNullOrWhiteSpace(config.DataDirectory))
                config.DataDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ParkPlaza", "Zk9500Bridge");
            config.DataDirectory = Environment.ExpandEnvironmentVariables(config.DataDirectory);
            return config;
        }

        public bool IsAllowedOrigin(string origin)
        {
            if (String.IsNullOrEmpty(origin)) return true;
            foreach (string allowed in AllowedOrigins)
                if (String.Equals(origin, allowed, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}
