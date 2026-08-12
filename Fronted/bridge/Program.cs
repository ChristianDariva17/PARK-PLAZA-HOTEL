using System;
using System.IO;

namespace ParkPlaza.Zk9500Bridge
{
    internal static class Program
    {
        private static HttpBridgeServer server;

        private static int Main()
        {
            try
            {
                string baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
                BridgeConfig config = BridgeConfig.Load(Path.Combine(baseDirectory, "bridge.config.json"));
                ITemplateStore store = new FileTemplateStore(config.DataDirectory);
                using (ZkFingerprintDevice device = new ZkFingerprintDevice(config.DeviceIndex, store))
                using (OperationManager operations = new OperationManager(device, new FileAuditLog(config.DataDirectory)))
                using (server = new HttpBridgeServer(config, device, operations))
                {
                    Console.CancelKeyPress += OnCancel;
                    server.Run();
                }
                return 0;
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("Bridge startup failed: " + exception.Message);
                return 1;
            }
        }

        private static void OnCancel(object sender, ConsoleCancelEventArgs eventArgs)
        {
            eventArgs.Cancel = true;
            if (server != null) server.Stop();
        }
    }
}
