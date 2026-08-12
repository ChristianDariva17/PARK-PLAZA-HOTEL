using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using libzkfpcsharp;

namespace ParkPlaza.Zk9500Bridge
{
    internal sealed class DeviceSnapshot
    {
        public bool SdkAvailable { get; set; }
        public bool Connected { get; set; }
        public int DeviceCount { get; set; }
        public int DeviceIndex { get; set; }
        public string ErrorCode { get; set; }
        public string Message { get; set; }
    }

    internal sealed class EnrollmentResult
    {
        public TemplateRecord Record { get; set; }
    }

    internal sealed class VerificationResult
    {
        public bool Matched { get; set; }
        public int Score { get; set; }
        public string TemplateReference { get; set; }
    }

    internal sealed class ZkFingerprintDevice : IDisposable
    {
        private const int TemplateCapacity = 2048;
        private readonly object sync = new object();
        private readonly int deviceIndex;
        private readonly ITemplateStore store;
        private IntPtr deviceHandle = IntPtr.Zero;
        private IntPtr databaseHandle = IntPtr.Zero;
        private byte[] imageBuffer;
        private bool initialized;
        private DeviceSnapshot snapshot;

        public ZkFingerprintDevice(int deviceIndex, ITemplateStore store)
        {
            this.deviceIndex = deviceIndex;
            this.store = store;
            snapshot = new DeviceSnapshot { DeviceIndex = deviceIndex, Message = "Device has not been initialized." };
            TryInitialize();
        }

        public DeviceSnapshot GetSnapshot()
        {
            lock (sync)
            {
                return new DeviceSnapshot { SdkAvailable = snapshot.SdkAvailable, Connected = snapshot.Connected, DeviceCount = snapshot.DeviceCount, DeviceIndex = snapshot.DeviceIndex, ErrorCode = snapshot.ErrorCode, Message = snapshot.Message };
            }
        }

        public DeviceSnapshot RefreshSnapshot()
        {
            lock (sync)
            {
                if (!snapshot.Connected)
                {
                    try { InitializeNoLock(); }
                    catch (Exception) { }
                }
                return new DeviceSnapshot { SdkAvailable = snapshot.SdkAvailable, Connected = snapshot.Connected, DeviceCount = snapshot.DeviceCount, DeviceIndex = snapshot.DeviceIndex, ErrorCode = snapshot.ErrorCode, Message = snapshot.Message };
            }
        }

        public EnrollmentResult Enroll(string subjectType, string subjectId, int timeoutMs, CancellationToken cancellationToken, Action<int> progress)
        {
            lock (sync)
            {
                EnsureReady();
                byte[][] samples = { new byte[TemplateCapacity], new byte[TemplateCapacity], new byte[TemplateCapacity] };
                byte[] merged = new byte[TemplateCapacity];
                int mergedLength = TemplateCapacity;
                DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
                try
                {
                    for (int index = 0; index < samples.Length; index++)
                    {
                        int sampleLength;
                        byte[] sample = Capture(deadline, cancellationToken, out sampleLength);
                        if (index > 0 && zkfp2.DBMatch(databaseHandle, sample, samples[index - 1]) <= 0)
                        {
                            index--;
                            continue;
                        }
                        Array.Copy(sample, samples[index], sampleLength);
                        Array.Clear(sample, 0, sample.Length);
                        progress(index + 1);
                    }
                    int result = zkfp2.DBMerge(databaseHandle, samples[0], samples[1], samples[2], merged, ref mergedLength);
                    if (result != zkfperrdef.ZKFP_ERR_OK) throw SdkError("enrollment_failed", "The SDK could not merge enrollment samples.", result);
                    return new EnrollmentResult { Record = store.Save(subjectType, subjectId, merged, mergedLength) };
                }
                finally
                {
                    foreach (byte[] sample in samples) Array.Clear(sample, 0, sample.Length);
                    Array.Clear(merged, 0, merged.Length);
                }
            }
        }

        public VerificationResult Verify(string subjectType, string subjectId, int timeoutMs, CancellationToken cancellationToken)
        {
            lock (sync)
            {
                EnsureReady();
                TemplateRecord record = store.Find(subjectType, subjectId);
                if (record == null) throw new BridgeException("template_not_found", "No fingerprint template exists for this subject.", 404);
                byte[] enrolled = store.Load(subjectType, subjectId);
                byte[] captured = null;
                try
                {
                    int capturedLength;
                    captured = Capture(DateTime.UtcNow.AddMilliseconds(timeoutMs), cancellationToken, out capturedLength);
                    int score = zkfp2.DBMatch(databaseHandle, captured, enrolled);
                    return new VerificationResult { Matched = score > 0, Score = score, TemplateReference = record.Reference };
                }
                finally
                {
                    if (captured != null) Array.Clear(captured, 0, captured.Length);
                    Array.Clear(enrolled, 0, enrolled.Length);
                }
            }
        }

        private byte[] Capture(DateTime deadline, CancellationToken cancellationToken, out int templateLength)
        {
            byte[] captured = new byte[TemplateCapacity];
            while (DateTime.UtcNow < deadline)
            {
                cancellationToken.ThrowIfCancellationRequested();
                templateLength = TemplateCapacity;
                int result = zkfp2.AcquireFingerprint(deviceHandle, imageBuffer, captured, ref templateLength);
                if (result == zkfperrdef.ZKFP_ERR_OK) return captured;
                if (result == zkfperrdef.ZKFP_ERR_NO_DEVICE || result == zkfperrdef.ZKFP_ERR_NOT_OPENED || result == zkfperrdef.ZKFP_ERR_INVALID_HANDLE)
                {
                    CloseNoLock();
                    throw SdkError("reader_unavailable", "The fingerprint reader was disconnected or is unavailable.", result);
                }
                Thread.Sleep(150);
            }
            Array.Clear(captured, 0, captured.Length);
            templateLength = 0;
            throw new BridgeException("capture_timeout", "Fingerprint capture timed out.", 408);
        }

        private void EnsureReady()
        {
            if (deviceHandle != IntPtr.Zero && databaseHandle != IntPtr.Zero) return;
            try { InitializeNoLock(); }
            catch (Exception) { throw new BridgeException(snapshot.ErrorCode ?? "sdk_error", snapshot.Message, 503); }
            if (!snapshot.Connected) throw new BridgeException(snapshot.ErrorCode ?? "reader_unavailable", snapshot.Message, 503);
        }

        private void TryInitialize()
        {
            lock (sync)
            {
                try { InitializeNoLock(); }
                catch (Exception exception) { SetUnavailable(exception); }
            }
        }

        private void InitializeNoLock()
        {
            if (deviceHandle != IntPtr.Zero && databaseHandle != IntPtr.Zero) return;
            try
            {
                int result = zkfp2.Init();
                if (result != zkfperrdef.ZKFP_ERR_OK && result != zkfperrdef.ZKFP_ERR_ALREADY_INIT)
                    throw SdkError("sdk_initialization_failed", "ZKFinger SDK initialization failed.", result);
                initialized = true;
                int count = zkfp2.GetDeviceCount();
                if (count <= deviceIndex)
                {
                    snapshot = new DeviceSnapshot { SdkAvailable = true, Connected = false, DeviceCount = Math.Max(0, count), DeviceIndex = deviceIndex, ErrorCode = "reader_absent", Message = "No configured fingerprint reader is connected." };
                    return;
                }
                deviceHandle = zkfp2.OpenDevice(deviceIndex);
                if (deviceHandle == IntPtr.Zero) throw new BridgeException("reader_open_failed", "The fingerprint reader could not be opened.", 503);
                databaseHandle = zkfp2.DBInit();
                if (databaseHandle == IntPtr.Zero) throw new BridgeException("sdk_database_failed", "The SDK matching database could not be initialized.", 503);

                byte[] value = new byte[4];
                int size = 4;
                int width = 0;
                int height = 0;
                zkfp2.GetParameters(deviceHandle, 1, value, ref size);
                zkfp2.ByteArray2Int(value, ref width);
                size = 4;
                zkfp2.GetParameters(deviceHandle, 2, value, ref size);
                zkfp2.ByteArray2Int(value, ref height);
                if (width <= 0 || height <= 0) throw new BridgeException("reader_parameters_failed", "The fingerprint reader returned invalid image dimensions.", 503);
                imageBuffer = new byte[width * height];
                snapshot = new DeviceSnapshot { SdkAvailable = true, Connected = true, DeviceCount = count, DeviceIndex = deviceIndex, Message = "Fingerprint reader is ready." };
            }
            catch (Exception exception)
            {
                CloseNoLock();
                SetUnavailable(exception);
                throw;
            }
        }

        private void SetUnavailable(Exception exception)
        {
            Exception root = exception is TypeInitializationException && exception.InnerException != null ? exception.InnerException : exception;
            bool sdkMissing = root is FileNotFoundException || root is DllNotFoundException || root is BadImageFormatException;
            BridgeException bridge = root as BridgeException;
            snapshot = new DeviceSnapshot
            {
                SdkAvailable = !sdkMissing,
                Connected = false,
                DeviceIndex = deviceIndex,
                ErrorCode = sdkMissing ? "sdk_unavailable" : bridge != null ? bridge.Code : "sdk_error",
                Message = sdkMissing ? "The x86 ZKFinger SDK runtime or managed wrapper is unavailable." : root.Message
            };
        }

        private static BridgeException SdkError(string code, string message, int result)
        {
            return new BridgeException(code, message + " SDK code: " + result + ".", 503);
        }

        private void CloseNoLock()
        {
            if (databaseHandle != IntPtr.Zero) { zkfp2.DBFree(databaseHandle); databaseHandle = IntPtr.Zero; }
            if (deviceHandle != IntPtr.Zero) { zkfp2.CloseDevice(deviceHandle); deviceHandle = IntPtr.Zero; }
            if (initialized) { zkfp2.Terminate(); initialized = false; }
            if (imageBuffer != null) { Array.Clear(imageBuffer, 0, imageBuffer.Length); imageBuffer = null; }
        }

        public void Dispose()
        {
            lock (sync) { CloseNoLock(); }
        }
    }
}
